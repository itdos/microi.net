import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
    getBoundWorkflowDesignId,
    getWorkflowDesignPath,
    isWorkflowMenuBinding
} from "../src/utils/workflow-menu-binding.js";

test("workflow menu binding requires the trusted OpenType and a trimmed FlowDesignId", () => {
    assert.equal(getBoundWorkflowDesignId({ OpenType: "WorkFlow", FlowDesignId: "  flow-1  " }), "flow-1");
    assert.equal(isWorkflowMenuBinding({ OpenType: "WorkFlow", FlowDesignId: "flow-1" }), true);
    assert.equal(getBoundWorkflowDesignId({ OpenType: "Diy", FlowDesignId: "flow-1" }), "");
    assert.equal(getBoundWorkflowDesignId({ OpenType: "workflow", FlowDesignId: "flow-1" }), "");
    assert.equal(getBoundWorkflowDesignId({ OpenType: "WorkFlow", FlowDesignId: "   " }), "");
});

test("workflow design path encodes the trusted flow design id", () => {
    assert.equal(
        getWorkflowDesignPath({ OpenType: "WorkFlow", FlowDesignId: " flow/id 1 " }),
        "/wf/flow-design/flow%2Fid%201"
    );
    assert.equal(getWorkflowDesignPath({ OpenType: "Diy", FlowDesignId: "flow-1" }), "");
});

test("workflow design entries share the menu binding and authenticated route metadata", async () => {
    const [permissionSource, tagsSource, tableSource, operationsSource] = await Promise.all([
        readFile(new URL("../src/pinia/modules/permission.js", import.meta.url), "utf8"),
        readFile(new URL("../src/layout/components/TagsView/index.vue", import.meta.url), "utf8"),
        readFile(new URL("../src/views/form-engine/diy-table.vue", import.meta.url), "utf8"),
        readFile(new URL("../src/views/form-engine/mixins/diy-table-operations.mixin.js", import.meta.url), "utf8")
    ]);

    assert.match(permissionSource, /FlowDesignId:\s*item\.FlowDesignId/);
    assert.match(permissionSource, /_SelectFields\s*:\s*\[[^\]]*"OpenType"[^\]]*"FlowDesignId"/s);
    assert.match(tagsSource, /canShowWorkflowDesign\(selectedTag\)/);
    assert.match(tagsSource, /Number\(this\.canShowWorkflowDesign\(tag\)\)/);
    assert.match(tagsSource, /getWorkflowDesignPath\(\(tag && tag\.meta\) \|\| \{\}\)/);
    assert.match(tableSource, /v-if="IsWorkFlowMenu\(\)" @click="OpenWorkFlowDesign\(\)"/);
    assert.match(operationsSource, /IsWorkFlowMenu\(\)\s*\{[\s\S]*?getBoundWorkflowDesignId\(this\.SysMenuModel\)/);
    assert.match(operationsSource, /OpenWorkFlowDesign\(\)[\s\S]*?getWorkflowDesignPath\(self\.SysMenuModel\)/);
});
