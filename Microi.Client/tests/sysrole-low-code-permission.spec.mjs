import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { compileScript, compileTemplate, parse } from "@vue/compiler-sfc";

const componentUrls = [
    new URL("../src/views/system/components/sysrole-permission-field.vue", import.meta.url),
    new URL("../src/views/system/components/sysrole-table-permission.vue", import.meta.url),
    new URL("../src/views/system/components/sysrole-menu-permission-row.vue", import.meta.url)
];

for (const componentUrl of componentUrls) {
    test(`${componentUrl.pathname.split("/").at(-1)} 可以通过 Vue SFC 编译`, () => {
        const source = readFileSync(componentUrl, "utf8");
        const parsed = parse(source, { filename: componentUrl.pathname });
        assert.deepEqual(parsed.errors, []);
        if (parsed.descriptor.script || parsed.descriptor.scriptSetup) {
            compileScript(parsed.descriptor, { id: componentUrl.pathname });
        }
        if (parsed.descriptor.template) {
            const result = compileTemplate({
                source: parsed.descriptor.template.content,
                filename: componentUrl.pathname,
                id: componentUrl.pathname
            });
            assert.deepEqual(result.errors, []);
        }
    });
}

test("低代码角色权限组件同时加载和提交菜单、表直连权限", () => {
    const source = readFileSync(componentUrls[0], "utf8");
    assert.match(source, /<SysroleTablePermission/u);
    assert.match(source, /\["Id", "FkId", "Type", "Permission"\]/u);
    assert.match(source, /Table:\s*\(this\.tableLimits/u);
    assert.match(source, /tablePermission\.flushPendingSync\(\)/u);
    assert.match(source, /ensureRoleMenuPathReadable/u);
});

test("表直连编辑器支持只读态并在保存前等待服务端策略", () => {
    const source = readFileSync(componentUrls[1], "utf8");
    assert.match(source, /readonly:\s*\{/u);
    assert.match(source, /GetDirectTableGrantPolicies/u);
    assert.match(source, /async flushPendingSync\(\)/u);
    assert.match(source, /!this\.policyReady \|\| this\.policyLoadFailed/u);
});
