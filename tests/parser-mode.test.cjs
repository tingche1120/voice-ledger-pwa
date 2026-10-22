const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

assert.ok(html.includes('id="parserModeSelect"'), "設定頁需要 AI／本機解析切換開關");
assert.ok(source.includes('els.parserModeSelect.addEventListener("change", handleParserModeChange)'), "解析方式選項需要接上事件");

function makeApp(savedMode) {
  const elements = new Map();
  const storage = new Map();
  if (savedMode) storage.set("voice-ledger-parser-mode", savedMode);
  let fetchCount = 0;

  function element(selector) {
    if (!elements.has(selector)) elements.set(selector, {
      hidden: selector === "#confirmBackdrop",
      value: "",
      textContent: "",
      disabled: false,
      classList: { add() {}, remove() {} },
      querySelector() { return { textContent: "", disabled: false }; },
      focus() {},
    });
    return elements.get(selector);
  }

  const context = vm.createContext({
    document: { querySelector: element },
    localStorage: {
      getItem(key) { return storage.get(key) ?? null; },
      setItem(key, value) { storage.set(key, value); },
    },
    window: { setTimeout, clearTimeout },
    navigator: {}, AbortController, setTimeout, clearTimeout,
    fetch: async () => {
      fetchCount++;
      return {
        ok: true,
        status: 200,
        json: async () => ({ result: { records: [{
          note: "AI 午餐", amount: 100, category: "餐飲", type: "expense", date: "2026-10-22",
        }] } }),
      };
    },
  });
  vm.runInContext(source.replace(/^init\(\);$/m, ""), context);
  vm.runInContext("renderPending = () => {}; showToast = () => {};", context);
  return { context, element, storage, get fetchCount() { return fetchCount; } };
}

async function main() {
  const ai = makeApp();
  await vm.runInContext('handlePhrase("午餐100")', ai.context);
  assert.equal(ai.fetchCount, 1, "預設 AI 模式必須呼叫 AI");
  assert.equal(ai.element("#confirmMode").textContent, "AI 已解析");

  const local = makeApp("local");
  await vm.runInContext('handlePhrase("午餐100")', local.context);
  assert.equal(local.fetchCount, 0, "本機模式不得呼叫 AI");
  assert.equal(local.element("#confirmMode").textContent, "本機解析");
  assert.match(local.element("#voiceDiagnosticLog").value, /LOCAL #1 parse-start/);

  local.element("#parserModeSelect").value = "ai";
  vm.runInContext("handleParserModeChange()", local.context);
  assert.equal(local.storage.get("voice-ledger-parser-mode"), "ai");
  assert.match(local.element("#voiceDiagnosticLog").value, /parser-mode-changed parser=ai/);

  const invalid = makeApp("unknown");
  await vm.runInContext('handlePhrase("午餐100")', invalid.context);
  assert.equal(invalid.fetchCount, 1, "未知設定值應安全回到 AI 模式");
  console.log("PASS: AI／本機解析切換、持久化、診斷標記與安全預設");
}

main().catch(error => { console.error(error); process.exitCode = 1; });
