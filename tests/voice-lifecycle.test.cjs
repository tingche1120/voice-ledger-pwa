const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

function makeApp(mode = "continuous") {
  const elements = new Map();
  const storage = new Map([["voice-ledger-recognition-mode", mode]]);
  const instances = [];
  const timers = new Map();
  let timerSequence = 0;
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
    constructor() { instances.push(this); this.starts = 0; this.stops = 0; this.aborts = 0; }
    start() { this.starts++; }
    stop() { this.stops++; }
    abort() { this.aborts++; }
  }
  const context = vm.createContext({
    document: { querySelector: element },
    localStorage: {
      getItem(key) { return storage.get(key) ?? null; },
      setItem(key, value) { storage.set(key, value); },
    },
    window: { webkitSpeechRecognition: FakeSpeechRecognition }, navigator: {},
    AbortController,
    setTimeout(callback) { const id = ++timerSequence; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); },
    fetch: async () => ({ ok: true, status: 200, json: async () => ({
      result: { records: [{ note: "test", amount: 100, category: "餐飲", date: "2026-10-22", type: "expense" }] },
    }) }),
  });
  vm.runInContext(source.replace(/^init\(\);$/m, ""), context);
  vm.runInContext("renderPending = () => {}; render = () => {}; syncDateControls = () => {}; showToast = () => {};", context);
  return {
    element,
    instances,
    run: (code) => vm.runInContext(code, context),
    runTimers() { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach((callback) => callback()); },
  };
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
        assert.equal(app.instances.length, count + 1, "every recording must create a fresh recognizer");
        const recognition = app.instances[count];
        recognition.onstart();
        recognition.onaudiostart();
        recognition.onspeechstart();
        recognition.onresult(result("test 100"));
        app.run("stopVoiceInput()");
        assert.equal(recognition.stops, 1, "stop is sent only once per fresh session");
        recognition.onaudioend();
        recognition.onend();
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(app.element("#confirmBackdrop").hidden, false);
        app.run(action);
        assert.equal(app.run("activeRecognition === null && !isParsingPhrase"), true);
        assert.equal(recognition.aborts, 1, "ended recognition must be explicitly released");
        assert.equal(recognition.onstart, null, "ended recognition callbacks must be detached");
      }
      assert.equal(app.instances.length, 3);
      assert.deepEqual(app.instances.map((recognition) => recognition.starts), [1, 1, 1]);
      console.log(`PASS: ${mode}, ${action}, three fresh recognizers with hard teardown`);
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
  const second = app.instances[1];
  oldResult(result("stale 999"));
  oldError({ error: "aborted" });
  oldEnd();
  assert.equal(app.run("activeRecognition !== null"), true, "old callbacks cannot clear the current session");
  assert.equal(app.element("#quickText").value, "", "old results cannot populate a new session");
  second.onend();
  assert.equal(app.element("#confirmBackdrop").hidden, true, "failed/empty session must not open confirmation");
  console.log("PASS: error/end serialization, duplicate stop, stale callback isolation");

  const watchdogApp = makeApp();
  watchdogApp.run("startVoiceInput({ holdMode: true })");
  const stalled = watchdogApp.instances[0];
  stalled.onstart();
  stalled.onaudiostart();
  watchdogApp.runTimers();
  assert.equal(stalled.aborts, 1, "audio without speech must be aborted after the watchdog timeout");
  assert.match(watchdogApp.element("#voiceDiagnosticLog").value, /mic-watchdog-timeout/);
  console.log("PASS: audio-start without speech triggers microphone watchdog cleanup");
  console.log("NOTE: mocked speech events verify app lifecycle, not iPhone recognition availability.");
}

main().catch(error => { console.error(error); process.exitCode = 1; });
