const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const elements = new Map();

function element(selector) {
  if (!elements.has(selector)) {
    elements.set(selector, {
      hidden: selector === "#confirmBackdrop",
      value: "",
      scrollHeight: 0,
      scrollTop: 0,
      dataset: {},
      tagName: "DIV",
      className: "",
      classList: { add() {}, remove() {} },
      querySelector() { return { textContent: "" }; },
      getBoundingClientRect() { return { left: 0, top: 0, right: 0, bottom: 0 }; },
    });
  }
  return elements.get(selector);
}

const save = element("#saveConfirm");
save.id = "saveConfirm";
save.tagName = "BUTTON";
save.getBoundingClientRect = () => ({ left: 190, top: 700, right: 360, bottom: 746 });
save.closest = (selector) => (selector === "#saveConfirm" || selector === "#confirmBackdrop" ? save : null);

const toast = element("#toast");
toast.id = "toast";
toast.hidden = false;
toast.getBoundingClientRect = () => ({ left: 18, top: 610, right: 375, bottom: 660 });

const body = { tagName: "BODY", id: "", dataset: {}, closest() { return null; } };
const documentMock = {
  activeElement: body,
  querySelector: element,
  elementFromPoint() { return save; },
};

const context = vm.createContext({
  document: documentMock,
  localStorage: { getItem() { return null; }, setItem() {} },
  window: {
    innerWidth: 393,
    innerHeight: 852,
    visualViewport: { width: 393, height: 852, offsetTop: 0 },
  },
  navigator: {},
  AbortController,
  setTimeout,
  clearTimeout,
});

vm.runInContext(source.replace(/^init\(\);$/m, ""), context);
element("#confirmBackdrop").hidden = false;
context.saveTarget = save;

vm.runInContext(`
  logConfirmInteraction({ type: "pointerdown", target: saveTarget, clientX: 280, clientY: 723 });
  logConfirmGeometry();
`, context);

const log = element("#voiceDiagnosticLog").value;
assert.match(log, /\[DEBUG-save-a137\] capture-pointerdown target=#saveConfirm hit=#saveConfirm x=280 y=723 active=body/);
assert.match(log, /\[DEBUG-save-a137\] confirm-geometry save=190,700,360,746 toast=18,610,375,660 overlap=false/);
assert.doesNotMatch(log, /午餐|早餐|晚餐|咖啡/);
console.log("PASS: confirmation capture target, coordinates, focus and overlay geometry diagnostics");
