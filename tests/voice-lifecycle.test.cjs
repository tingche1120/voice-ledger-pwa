const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

function makeApp(mode = "continuous") {
  const elements = new Map();
  const storage = new Map([["voice-ledger-recognition-mode", mode]]);
  const instances = [];
  function element(selector) {
    if (!elements.has(selector)) elements.set(selector, {
      hidden: selector === "#confirmBackdrop", value: "",
      classList: { add() {}, remove() {} },
      querySelector() { return { textContent: "" }; },
      focus() {},
    });
    return elements.get(selector);
  }
  class FakeSpeechRecognition {
    constructor() { instances.push(this); this.starts = 0; this.stops = 0; }
    start() { this.starts++; }
    stop() { this.stops++; }
  }
  const context = vm.createContext({
    document: { querySelector: element },
    localStorage: {
      getItem(key) { return storage.get(key) ?? null; },
      setItem(key, value) { storage.set(key, value); },
    },
    window: { webkitSpeechRecognition: FakeSpeechRecognition }, navigator: {},
    AbortController, setTimeout, clearTimeout,
    fetch: async () => ({ ok: true, status: 200, json: async () => ({
      result: { records: [{ note: "test", amount: 100, category: "餐飲", date: "2026-10-22", type: "expense" }] },
    }) }),
  });
  vm.runInContext(source.replace(/^init\(\);$/m, ""), context);
  vm.runInContext("renderPending = () => {}; render = () => {}; syncDateControls = () => {}; showToast = () => {};", context);
  return { element, instances, run: (code) => vm.runInContext(code, context) };
}

function result(text) {
  const entry = [{ transcript: text }];
  entry.isFinal = true;
  return { resultIndex: 0, results: [entry] };
}

async function main() {
  for (const mode of ["continuous", "single"]) {
    for (const action of ["savePending()", "closeConfirm()"] ) {
      const app = makeApp(mode);
      for (let count = 0; count < 3; count++) {
        assert.equal(app.run("startVoiceInput({ holdMode: true })"), true);
        assert.equal(app.instances.length, 1, "successive recordings must reuse the recognizer");
        const recognition = app.instances[0];
        recognition.onstart();
        recognition.onaudiostart();
        recognition.onspeechstart();
        recognition.onresult(result("test 100"));
        app.run("stopVoiceInput()");
        assert.equal(recognition.stops, count + 1, "stop is sent only once per session");
        recognition.onaudioend();
        recognition.onend();
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(app.element("#confirmBackdrop").hidden, false);
        app.run(action);
        assert.equal(app.run("activeRecognition === null && !isParsingPhrase"), true);
      }
      assert.equal(app.instances[0].starts, 3);
      console.log(`PASS: ${mode}, ${action}, three sessions on one recognizer`);
    }
  }

  const app = makeApp();
  app.run("startVoiceInput({ holdMode: true })");
  const first = app.instances[0];
  app.run("stopVoiceInput(); stopVoiceInput()");
  assert.equal(first.stops, 1, "stop is sent only once while waiting for end");
  const oldError = first.onerror;
  const oldEnd = first.onend;
  const oldResult = first.onresult;
  first.onerror({ error: "aborted" });
  assert.equal(app.run("startVoiceInput({ holdMode: true })"), false, "error must wait for end before restarting");
  first.onend();
  assert.equal(app.run("startVoiceInput({ holdMode: true })"), true);
  oldResult(result("stale 999"));
  oldError({ error: "aborted" });
  oldEnd();
  assert.equal(app.run("activeRecognition !== null"), true, "old callbacks cannot clear the current session");
  assert.equal(app.element("#quickText").value, "", "old results cannot populate a new session");
  first.onend();
  assert.equal(app.element("#confirmBackdrop").hidden, true, "failed/empty session must not open confirmation");
  console.log("PASS: error/end serialization, duplicate stop, stale callback isolation");
  console.log("NOTE: mocked speech events verify app lifecycle, not iPhone recognition availability.");
}

main().catch(error => { console.error(error); process.exitCode = 1; });
