import assert from "node:assert/strict";
import test from "node:test";

import { createStableJsonTableColumnFieldResolver } from "../src/views/form-engine/diy-field-component/json-table-column-field-runtime.js";

test("JSON 表格列复用稳定字段上下文并保留异步数据源结果", () => {
    const resolver = createStableJsonTableColumnFieldResolver((value) => value);
    const initial = resolver("menu", {
        Id: "field-menu",
        Name: "TargetSysMenuId",
        Config: { DataSource: "Sql" },
        Data: []
    }, "schema-v1");

    initial.Data = [{ Id: "menu-1", Name: "我的工作" }];
    initial._DataLoading = true;
    const reused = resolver("menu", {
        Id: "field-menu",
        Name: "TargetSysMenuId",
        Config: { DataSource: "Sql" },
        Data: []
    }, "schema-v1");

    assert.equal(reused, initial);
    assert.deepEqual(reused.Data, [{ Id: "menu-1", Name: "我的工作" }]);
    assert.equal(reused._DataLoading, true);
});

test("JSON 表格列的数据源配置变化时重置旧运行态", () => {
    const resolver = createStableJsonTableColumnFieldResolver();
    const initial = resolver("menu", {
        Id: "field-menu",
        Name: "TargetSysMenuId",
        Config: { DataSource: "Sql", Sql: "select old" },
        Data: []
    }, "schema-v1");
    initial.Data = [{ Id: "stale" }];
    initial._DataLoading = true;

    const updated = resolver("menu", {
        Id: "field-menu",
        Name: "TargetSysMenuId",
        Config: { DataSource: "Sql", Sql: "select new" },
        Data: []
    }, "schema-v2");

    assert.equal(updated, initial);
    assert.deepEqual(updated.Data, []);
    assert.equal(updated._DataLoading, false);
    assert.equal(updated._DataLoadingStartedAt, 0);
    assert.equal(updated.Config.Sql, "select new");
});
