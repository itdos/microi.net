import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../src/views/form-engine/mixins/diy-table-actions.mixin.js", import.meta.url),
  "utf8",
);

test("background-task foundation package installs in foreground to break the bootstrap cycle", () => {
  assert.match(source, /IsBackgroundTaskBootstrapPackage\(value\)/);
  assert.match(source, /app\.microi\.background-task/);
  assert.match(source, /packageInfo\.Name[\s\S]*?后台任务基础能力/);
  assert.match(
    source,
    /IsBackgroundTaskBootstrapPackage\(row\)[\s\S]*?ApiEngine\.Run\("import-microi-store-package", backgroundParam\)/,
  );
  assert.match(
    source,
    /IsBackgroundTaskBootstrapPackage\(packageInfo\)[\s\S]*?ApiEngine\.Run\("import-microi-store-package", importParam\)/,
  );
});

test("ordinary app-store packages still use persistent background tasks", () => {
  assert.match(
    source,
    /ApiEngine\.RunBackground\("import-microi-store-package", backgroundParam, backgroundTitle/,
  );
  assert.match(
    source,
    /ApiEngine\.RunBackground\([\s\S]*?"import-microi-store-package",[\s\S]*?importParam/,
  );
});
