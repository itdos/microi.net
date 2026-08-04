import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const tableSource = await readFile(
  new URL("../src/views/form-engine/diy-table.vue", import.meta.url),
  "utf8",
);
const tableUiSource = await readFile(
  new URL("../src/views/form-engine/mixins/diy-table-ui.mixin.js", import.meta.url),
  "utf8",
);
const designerSource = await readFile(
  new URL("../src/views/form-engine/diy-design.vue", import.meta.url),
  "utf8",
);

test("audit columns open the same advanced header search as ordinary fields", () => {
  for (const field of ["CreateTime", "UserName", "UpdateTime"]) {
    const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(
      tableSource,
      new RegExp(`showColHeaderMenu\\(getSystemAuditField\\('${escaped}'`),
      `${field} has no advanced-search header menu`,
    );
  }
  assert.match(tableUiSource, /getSystemAuditField\(fieldName, fallbackLabel\)/);
  assert.match(tableUiSource, /DiyCommon\.SysDefaultField/);
  assert.match(tableUiSource, /self\._colFilters\[fieldName\]/);
  assert.match(tableUiSource, /self\._getDefaultOperator\(field\)/);
});

test("designer refreshes field metadata after automatic fixed-field repair", () => {
  assert.match(designerSource, /\/api\/FormEngine\/GetExceptionFieldList/);
  assert.match(designerSource, /result\.DataAppend && Number\(result\.DataAppend\.Repaired \|\| 0\) > 0/);
  assert.match(designerSource, /fieldForm\.GetDiyField\(null, false\)/);
});
