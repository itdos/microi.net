import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
    buildPageTabQuery,
    findPageTabTargetRoute,
    getPageTabRouteViewKey,
    hasConfiguredModuleMetrics,
    hasConfiguredPageTabs,
    shouldReusePageTabRoute
} from "../src/utils/page-tab-route-runtime.js";

test("route metadata exposes geometry hints for module and PageTabs skeletons", () => {
    assert.equal(hasConfiguredPageTabs(JSON.stringify([
        { Name: "待办", IsVisible: true },
        { Name: "已办", IsVisible: true }
    ])), true);
    assert.equal(hasConfiguredPageTabs([{ Name: "", IsVisible: true }]), false);
    assert.equal(hasConfiguredModuleMetrics(JSON.stringify({
        Views: [{ Scene: "List", Layout: { Hero: { Metrics: [{ Key: "todo" }] } } }]
    })), true);
    assert.equal(hasConfiguredModuleMetrics({ Views: [{ Scene: "Detail", Layout: { Hero: { Metrics: [{}] } } }] }), false);
});

test("PageTabs update only the current business entry query", () => {
    assert.deepEqual(buildPageTabQuery({ Keyword: "A", FormDataId: "x", Id: "y" }, "与我相关"), {
        Keyword: "A",
        Tab: "与我相关"
    });
    const routes = [
        { name: "todo", meta: { Id: "menu-todo", DiyTableId: "table-todo" } },
        { name: "copy", meta: { Id: "menu-copy", DiyTableId: "table-copy" } }
    ];
    assert.equal(findPageTabTargetRoute(routes, "menu-copy")?.name, "copy");
    assert.equal(findPageTabTargetRoute(routes, "missing"), null);
});

test("a table route carrying Tab reuses its Vue instance and access tab", () => {
    const route = {
        path: "/mic-home-work-todo",
        fullPath: "/mic-home-work-todo?Tab=与我相关",
        query: { Tab: "与我相关" },
        meta: { DiyTableId: "table-todo" }
    };
    assert.equal(shouldReusePageTabRoute(route), true);
    assert.equal(getPageTabRouteViewKey(route), "/mic-home-work-todo");
    assert.equal(shouldReusePageTabRoute({ ...route, meta: { microAppHost: true } }), false);
});

test("record workbench query changes reuse the current Vue instance", () => {
    const route = {
        path: "/system-config",
        fullPath: "/system-config?RecordId=row-1",
        query: { RecordId: "row-1" },
        meta: { DiyTableId: "table-config" }
    };
    assert.equal(getPageTabRouteViewKey(route), "/system-config");
    assert.equal(getPageTabRouteViewKey({
        ...route,
        fullPath: "/system-config?RecordId=row-1&ViewMode=Table",
        query: { RecordId: "row-1", ViewMode: "Table" }
    }), "/system-config");
});

test("diy-table keeps one shell while loading a target module context", async () => {
    const [tableSource, dataSource, schemaSource, styleSource, tagsStoreSource] = await Promise.all([
        readFile(new URL("../src/views/form-engine/diy-table.vue", import.meta.url), "utf8"),
        readFile(new URL("../src/views/form-engine/mixins/diy-table-data.mixin.js", import.meta.url), "utf8"),
        readFile(new URL("../src/views/form-engine/mixins/diy-table-schema.mixin.js", import.meta.url), "utf8"),
        readFile(new URL("../src/styles/diy-table.scss", import.meta.url), "utf8"),
        readFile(new URL("../src/pinia/modules/tagsView.js", import.meta.url), "utf8")
    ]);

    assert.match(tableSource, /SwitchPageTabModule/);
    assert.match(tableSource, /path:\s*currentRoute\.path/);
    assert.doesNotMatch(tableSource, /name:\s*targetRoute\.name/);
    assert.match(tableSource, /module-shell-skeleton/);
    assert.match(tableSource, /module-page-tabs-skeleton/);
    assert.match(tableSource, /PageTabName:\s*tabModel\.Name/);
    assert.match(dataSource, /ContextVersion/);
    assert.match(dataSource, /ResolveInitialPageTabTarget/);
    assert.match(dataSource, /PageTabName:\s*param\.PageTabName/);
    assert.match(schemaSource, /PageTabHostTabs/);
    assert.match(schemaSource, /hasOwnProperty\.call\(options, "PageTabName"\)/);
    assert.match(styleSource, /mciModuleSkeletonShift/);
    assert.match(styleSource, /prefers-reduced-motion/);
    assert.match(tagsStoreSource, /shouldReusePageTabRoute/);
});
