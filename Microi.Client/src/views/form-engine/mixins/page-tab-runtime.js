export function getVisiblePageTabs(pageTabs) {
    if (!Array.isArray(pageTabs)) return [];
    return pageTabs.filter((tab) => tab && tab.IsVisible == true);
}

export function resolveInitialPageTab(pageTabs, options = {}) {
    const visibleTabs = getVisiblePageTabs(pageTabs);
    if (visibleTabs.length === 0) return null;

    const queryTab = options.queryTab;
    if (queryTab !== undefined && queryTab !== null && String(queryTab) !== "") {
        const requestedTab = visibleTabs.find((tab) => String(tab.Name) === String(queryTab));
        if (requestedTab) return requestedTab;
    }

    const currentTabId = options.currentTabId;
    if (currentTabId !== undefined && currentTabId !== null && String(currentTabId) !== "") {
        const currentTab = visibleTabs.find((tab) => String(tab.Id) === String(currentTabId));
        if (currentTab) return currentTab;
    }

    return visibleTabs[0];
}
