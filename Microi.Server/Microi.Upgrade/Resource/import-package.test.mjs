import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("./import-package.js", import.meta.url), "utf8");
const functionSource = source.match(/var countPageTabs = function \(value\) \{[\s\S]*?\n\};/);

assert.ok(functionSource, "countPageTabs helper should exist");

const context = {};
vm.runInNewContext(`${functionSource[0]}\nresult = countPageTabs;`, context);
const countPageTabs = context.result;

test("PageTabs only preserves a real multi-tab target", () => {
  const cases = [
    [null, 0],
    [undefined, 0],
    ["", 0],
    ["[]", 0],
    ["{}", 0],
    ["invalid-json", 0],
    ["[{}]", 1],
    ["[{},{}]", 2],
    [[], 0],
    [[{}], 1],
    [[{}, {}], 2]
  ];

  for (const [value, expected] of cases) {
    assert.equal(countPageTabs(value), expected, `unexpected count for ${JSON.stringify(value)}`);
  }
  assert.match(source, /existingPageTabsCount\s*>\s*1/);
});

test("self-contained offline applications prefer embedded files over public ZIP URLs", () => {
  assert.match(source, /embeddedSourceFiles[\s\S]*?embeddedSourceFiles\.length[\s\S]*?downloadApplicationZip\(packageAssets\.SourceZip/);
  assert.match(source, /embeddedBuildAssets[\s\S]*?embeddedBuildAssets\.length[\s\S]*?downloadApplicationZip\(packageAssets\.BuildZip/);
});
