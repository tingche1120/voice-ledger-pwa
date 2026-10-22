const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const elements = new Map();
function element(selector) {
  if (!elements.has(selector)) elements.set(selector, { value: "", hidden: true, classList: { add() {}, remove() {} }, querySelector() { return {}; } });
  return elements.get(selector);
}
const context = vm.createContext({
  document: { querySelector: element },
  localStorage: { getItem() { return null; }, setItem() {} },
  window: {}, navigator: {},
});
vm.runInContext(source.replace(/^init\(\);$/m, ""), context);

function parse(text) {
  context.testText = text;
  return vm.runInContext("parsePhrase(testText)", context);
}

let rows = parse("24號午餐100");
assert.equal(rows.length, 1);
assert.equal(rows[0].amount, 100);
assert.equal(rows[0].category, "餐飲");
assert.match(rows[0].date, /-24$/);

rows = parse("勞健保8月到10月12000");
assert.equal(rows.length, 1);
assert.equal(rows[0].amount, 12000);
assert.match(rows[0].note, /8月到10月/);

rows = parse("買百香果 2,600");
assert.equal(rows.length, 1);
assert.equal(rows[0].amount, 2600);

rows = parse("訂閱 Claude Code 650");
assert.equal(rows.length, 1);
assert.equal(rows[0].amount, 650);
assert.match(rows[0].note, /Claude Code/);

console.log("PASS: 24號、期間文字、千分位與中英混合解析基線");
