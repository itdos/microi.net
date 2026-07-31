import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const formSource = await readFile(
    new URL("../src/views/form-engine/diy-form.vue", import.meta.url),
    "utf8"
);

test("report designer sends the report table id to GetDiyFieldList", () => {
    const reportBranch = formSource.match(
        /if \(self\.PageType == "Report"\) \{([\s\S]*?)\n\s*\} else \{/
    );

    assert.ok(reportBranch, "report-mode field request branch should exist");
    assert.match(
        reportBranch[1],
        /getFieldListParam\.TableId\s*=\s*self\.TableId/
    );
    assert.match(
        reportBranch[1],
        /getFieldListParam\._Where\s*=\s*\[\["TableId",\s*"=",\s*self\.TableId\]\]/
    );
    assert.ok(
        reportBranch[1].indexOf("getFieldListParam.TableId = self.TableId") <
            reportBranch[1].indexOf("Url: apiGetDiyField"),
        "TableId must be attached before the GetDiyFieldList request is queued"
    );
});
