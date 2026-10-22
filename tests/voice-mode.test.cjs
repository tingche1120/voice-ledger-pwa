const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.ok(html.includes('id="voiceModeSelect"'), "設定頁需要可切換的語音模式");
assert.ok(source.includes('els.voiceModeSelect.addEventListener("change", handleVoiceModeChange)'), "切換選項需要接上事件");

function makeApp(savedMode) {
  const elements = new Map();
  const storage = new Map();
  if (savedMode) storage.set("voice-ledger-recognition-mode", savedMode);
  const instances = [];

  function element(selector) {
    if (!elements.has(selector)) {
      elements.set(selector, {
        hidden: selector === "#confirmBackdrop",
        value: "",
        classList: { add() {}, remove() {} },
        querySelector() { return { textContent: "" }; },
        focus() {},
      });
    }
    return elements.get(selector);
  }

  class FakeSpeechRecognition {
    constructor() { instances.push(this); }
    start() { this.started = true; }
    stop() { this.stopped = true; }
  }

  const context = vm.createContext({
    document: { querySelector: element },
    localStorage: {
      getItem(key) { return storage.get(key) ?? null; },
      setItem(key, value) { storage.set(key, value); },
    },
    window: { webkitSpeechRecognition: FakeSpeechRecognition },
    navigator: {},
  });
  vm.runInContext(source.replace(/^init\(\);$/m, ""), context);
  return { context, element, instances, storage };
}

const app = makeApp();
vm.runInContext("startVoiceInput({ holdMode: true })", app.context);
assert.equal(app.instances[0].continuous, true, "預設模式應維持原本的持續辨識");
app.instances[0].onend();

app.element("#voiceModeSelect").value = "single";
vm.runInContext("handleVoiceModeChange(); startVoiceInput({ holdMode: true })", app.context);
assert.equal(app.instances[0].continuous, false, "單句模式應關閉持續辨識");
assert.equal(app.instances[0].interimResults, true, "按住說話仍需顯示暫時辨識文字");
assert.equal(app.storage.get("voice-ledger-recognition-mode"), "single");
assert.match(app.element("#voiceDiagnosticLog").value, /mode=single/);
app.instances[0].onend();

app.element("#voiceModeSelect").value = "continuous";
vm.runInContext("handleVoiceModeChange(); startVoiceInput({ holdMode: true })", app.context);
assert.equal(app.instances[0].continuous, true, "切回目前模式應還原原本行為");

const reopened = makeApp("single");
vm.runInContext("startVoiceInput({ holdMode: true })", reopened.context);
assert.equal(reopened.instances[0].continuous, false, "重開 App 後應記住實驗模式");

const invalid = makeApp("unknown");
vm.runInContext("startVoiceInput({ holdMode: true })", invalid.context);
assert.equal(invalid.instances[0].continuous, true, "未知設定值應安全回到目前模式");
console.log("PASS: 預設、切換、回復與重新開啟後的語音模式");
