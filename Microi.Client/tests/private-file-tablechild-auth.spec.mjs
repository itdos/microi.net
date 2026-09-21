import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
// zhy：回归锁定 TableChild 模块关联查询与物理表兼容分支。
import {
    resolveTableQueryTarget,
    tableChildRequiresModuleQuery
} from "../src/views/form-engine/utils/diy-table-query-target.js";

const formSource = await readFile(
    new URL("../src/views/form-engine/diy-form.vue", import.meta.url),
    "utf8"
);
const fileUploadSource = await readFile(
    new URL("../src/views/form-engine/diy-field-component/diy-fileupload.vue", import.meta.url),
    "utf8"
);
const imgUploadSource = await readFile(
    new URL("../src/views/form-engine/diy-field-component/diy-imgupload.vue", import.meta.url),
    "utf8"
);
const onlyOfficeSource = await readFile(
    new URL("../src/views/form-engine/diy-components/onlyoffice.vue", import.meta.url),
    "utf8"
);
const tableDataSource = await readFile(
    new URL("../src/views/form-engine/mixins/diy-table-data.mixin.js", import.meta.url),
    "utf8"
);
function occurrenceCount(source, value) {
    return source.split(value).length - 1;
}

test("standard form passes TableChild authorization context to upload fields", () => {
    assert.ok(
        occurrenceCount(formSource, ':TableChildAuth="TableChildAuth"') >= 2,
        "both form render branches must pass the delegated context"
    );
    assert.match(fileUploadSource, /TableChildAuth:\s*\{\s*type:\s*Object,\s*default:\s*null/s);
    assert.match(imgUploadSource, /TableChildAuth:\s*\{\s*type:\s*Object,\s*default:\s*null/s);
});

test("private file and image URL requests preserve the delegated context", () => {
    assert.ok(
        occurrenceCount(
            fileUploadSource,
            "_TableChildAuth: props.TableChildAuth || undefined"
        ) >= 3,
        "all private-file request paths, including the download selector, must preserve the delegated context"
    );
    assert.equal(
        occurrenceCount(
            imgUploadSource,
            "_TableChildAuth: props.TableChildAuth || undefined"
        ),
        2
    );
});

// zhy：TableChild 必须同时保留模块关联查询、授权链和父子外键范围。
test("TableChild module query preserves join engine, delegated auth and parent relation", () => {
    const auth = { ParentRowId: "parent-row" };
    const where = [{ Name: "ParentId", Value: "parent-row", Type: "=" }];
    const request = resolveTableQueryTarget(
        { ModuleEngineKey: "child-module", _TableChildAuth: auth, _Where: where },
        {
            sysMenuId: "child-menu",
            formEngineKey: "child_table",
            tableId: "child-table",
            isTableChild: true,
            tableChildRequiresModuleQuery: true
        }
    );

    assert.equal(request.ModuleEngineKey, "child-module");
    assert.equal(request.FormEngineKey, undefined);
    assert.strictEqual(request._TableChildAuth, auth);
    assert.strictEqual(request._Where, where);
    assert.doesNotMatch(tableDataSource, /delete param\.ModuleEngineKey/);
    assert.match(tableDataSource, /self\.ApplyTableChildAuthContext\(param\)/);
    assert.match(tableDataSource, /self\.SearchEqual\[self\.TableChildFkFieldName\] = relationValue/);
    assert.match(tableDataSource, /param\._Where = appendWhereList\(param\._Where, exactSearchWhere\)/);
    assert.match(tableDataSource, /param\._Where = normalizeMixedWhereList\(param\._Where\)/);
    assert.match(
        tableDataSource,
        /GetTableData-" \+ \(param\.ModuleEngineKey \|\| param\.FormEngineKey\)/
    );
    assert.ok(
        tableDataSource.indexOf("self.ApplyTableChildAuthContext(param)")
            < tableDataSource.indexOf("resolveTableQueryTarget(param")
    );
    assert.ok(
        tableDataSource.indexOf("resolveTableQueryTarget(param")
            < tableDataSource.indexOf("self.SearchEqual[self.TableChildFkFieldName] = relationValue")
    );
});

// zhy：模块 Key 为空时仍应使用当前子菜单进入关联查询。
test("TableChild uses SysMenuId as the module query key when ModuleEngineKey is empty", () => {
    const request = resolveTableQueryTarget(
        { ModuleEngineKey: "", _TableChildAuth: { ParentRowId: "parent-row" } },
        {
            sysMenuId: "child-menu",
            formEngineKey: "child_table",
            tableId: "child-table",
            isTableChild: true,
            tableChildRequiresModuleQuery: true
        }
    );

    assert.equal(request.ModuleEngineKey, "child-menu");
    assert.equal(request.FormEngineKey, undefined);
});

// zhy：无关联配置的普通 TableChild 保持原物理表路径，防止子菜单数据范围过滤为零条。
test("ordinary TableChild keeps the physical-table path that avoids child-menu data scope", () => {
    const auth = { ParentRowId: "parent-row" };
    const where = [{ Name: "ParentId", Value: "parent-row", Type: "=" }];
    const request = resolveTableQueryTarget(
        { ModuleEngineKey: "child-module", _TableChildAuth: auth, _Where: where },
        {
            sysMenuId: "child-menu",
            formEngineKey: "child_table",
            tableId: "child-table",
            isTableChild: true,
            tableChildRequiresModuleQuery: false
        }
    );

    assert.equal(request.ModuleEngineKey, undefined);
    assert.equal(request.FormEngineKey, "child_table");
    assert.strictEqual(request._TableChildAuth, auth);
    assert.strictEqual(request._Where, where);
});

// zhy：覆盖 SQL、关联表、序列化配置和跨表字段四种模块关联判定来源。
test("TableChild detects module joins from current and serialized menu configuration", () => {
    assert.equal(tableChildRequiresModuleQuery({ SqlJoin: "LEFT JOIN child B ON A.Id=B.Id" }, "main"), true);
    assert.equal(tableChildRequiresModuleQuery({ JoinTables: [{ Id: "joined" }] }, "main"), true);
    assert.equal(tableChildRequiresModuleQuery({ JoinTables: '[{"Id":"joined"}]' }, "main"), true);
    assert.equal(
        tableChildRequiresModuleQuery({ SelectFields: [{ TableId: "joined", Name: "Name" }] }, "main"),
        true
    );
    assert.equal(tableChildRequiresModuleQuery({ SelectFields: [{ TableId: "main" }] }, "main"), false);
});

// zhy：非 TableChild 模块列表不受兼容分支影响，继续使用原 ModuleEngineKey。
test("ordinary module lists keep their existing ModuleEngineKey behavior", () => {
    const request = resolveTableQueryTarget(
        { ModuleEngineKey: "normal-module" },
        {
            sysMenuId: "normal-menu",
            formEngineKey: "normal_table",
            tableId: "normal-table",
            isTableChild: false,
            tableChildRequiresModuleQuery: false
        }
    );

    assert.equal(request.ModuleEngineKey, "normal-module");
    assert.equal(request.FormEngineKey, undefined);
});

// zhy：验证小程序图片缺少 State 时，PC 仍识别为已上传。
test("cross-client image records with Path but no State are treated as uploaded", () => {
    assert.match(imgUploadSource, /const normalizeUploadItem = \(item, index = 0\)/);
    assert.match(
        imgUploadSource,
        /State: rawState === undefined \|\| rawState === null \|\| rawState === '' \? 1 : rawState/
    );
    assert.match(imgUploadSource, /trimmed\.startsWith\('\['\)/);
    assert.match(imgUploadSource, /item\.FilePathName \|\| item\.FullPath \|\| item\.Url/);
});

test("OnlyOffice session, private URL, metadata and save requests preserve the context", () => {
    assert.match(
        fileUploadSource,
        /tableChildAuth:\s*props\.TableChildAuth\s*\|\|\s*null/
    );
    assert.match(
        onlyOfficeSource,
        /this\.tableChildAuth\s*=\s*this\.parseTableChildAuth/
    );
    assert.match(
        onlyOfficeSource,
        /tableChildAuth:\s*this\.tableChildAuth/
    );
    assert.equal(
        occurrenceCount(
            onlyOfficeSource,
            "_TableChildAuth: this.tableChildAuth || undefined"
        ),
        3
    );
});
