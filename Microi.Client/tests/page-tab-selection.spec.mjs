import assert from "node:assert/strict";
import test from "node:test";
import {
    getVisiblePageTabs,
    resolveInitialPageTab
} from "../src/views/form-engine/mixins/page-tab-runtime.js";

const tabs = [
    { Id: "all", Name: "全部", IsVisible: false },
    { Id: "pending", Name: "未审核", IsVisible: true },
    { Id: "approved", Name: "已审核", IsVisible: true }
];

test("ordinary users select the first authorized PageTab instead of the first configured PageTab", () => {
    assert.deepEqual(getVisiblePageTabs(tabs).map((tab) => tab.Id), ["pending", "approved"]);
    assert.equal(resolveInitialPageTab(tabs)?.Id, "pending");
});

test("a visible PageTab from the URL is selected", () => {
    assert.equal(resolveInitialPageTab(tabs, { queryTab: "已审核" })?.Id, "approved");
});

test("a hidden PageTab from the URL is ignored", () => {
    assert.equal(resolveInitialPageTab(tabs, { queryTab: "全部" })?.Id, "pending");
});

test("an existing selection is preserved only while it remains visible", () => {
    assert.equal(resolveInitialPageTab(tabs, { currentTabId: "approved" })?.Id, "approved");
    assert.equal(resolveInitialPageTab(tabs, { currentTabId: "all" })?.Id, "pending");
});

test("zero authorized PageTabs returns a safe empty selection", () => {
    const hiddenTabs = tabs.map((tab) => ({ ...tab, IsVisible: false }));
    assert.equal(resolveInitialPageTab(hiddenTabs), null);
});
