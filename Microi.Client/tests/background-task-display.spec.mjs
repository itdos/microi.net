import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
    getBackgroundTaskEta,
    getBackgroundTaskProgress,
    isActiveBackgroundTask,
    mergeBackgroundTaskSummaries,
    shouldPollBackgroundTasks
} from "../src/utils/background-task-display.js";

test("a detail response remains visible when a task summary arrives during loading", () => {
    const loadingRow = { Id: "storage-task", Status: "Running", DetailLoading: true };
    const rows = mergeBackgroundTaskSummaries([loadingRow], [{ Id: "storage-task", Status: "Running", Progress: 15 }]);
    Object.assign(loadingRow, { Error: "OBJECT_STORAGE_UNREACHABLE", DetailLoaded: true, DetailLoading: false });
    assert.equal(rows[0].Error, "OBJECT_STORAGE_UNREACHABLE");
    assert.equal(rows[0].DetailLoading, false);
    assert.equal(rows[0].Progress, 15);
});

test("stopping an errored task preserves its failure details while a successful retry clears them", () => {
    const row = { Id: "storage-task", Status: "Running", Error: "Storage unavailable", DetailLoaded: true };
    const stopped = mergeBackgroundTaskSummaries([row], [{ Id: "storage-task", Status: "Canceled" }])[0];
    assert.equal(stopped.Error, "Storage unavailable");
    const succeeded = mergeBackgroundTaskSummaries([stopped], [{ Id: "storage-task", Status: "Succeeded" }])[0];
    assert.equal(succeeded.Error, "");
    assert.equal(succeeded.DetailLoaded, false);
});

test("unknown work is indeterminate instead of a fake ten percent", () => {
    const view = getBackgroundTaskProgress({
        Status: "Running",
        Progress: 0,
        ProgressMode: "Indeterminate",
        Current: 0,
        Total: 0
    });
    assert.equal(view.indeterminate, true);
    assert.equal(view.text, "估算中");
});

test("unit progress shows the real denominator", () => {
    const view = getBackgroundTaskProgress({
        Status: "Running",
        Progress: 25,
        ProgressMode: "Units",
        Current: 250,
        Total: 1000
    });
    assert.deepEqual(view, { percentage: 25, indeterminate: false, text: "250/1000 (25%)" });
});

test("failed work keeps its last real progress", () => {
    const view = getBackgroundTaskProgress({ Status: "Failed", Progress: 37, ProgressMode: "Units", Current: 370, Total: 1000 });
    assert.equal(view.percentage, 37);
    assert.equal(view.text, "370/1000 (37%)");
});

test("active tasks trigger polling fallback and eta is explicit", () => {
    assert.equal(isActiveBackgroundTask({ Status: "Retrying" }), true);
    assert.equal(shouldPollBackgroundTasks([{ Status: "Succeeded" }, { Status: "Retrying" }]), true);
    const eta = getBackgroundTaskEta({
        Status: "Running",
        EstimatedEndTime: "2026-07-28T10:30:00",
        RemainingSeconds: 600,
        RemainingText: "10m 0s",
        EstimateConfidence: "Medium"
    }, { confidenceMedium: "中等可信" });
    assert.match(eta, /10:30:00/);
    assert.match(eta, /10m 0s/);
    assert.match(eta, /中等可信/);
});

test("task center is event driven and shows a full creation datetime", () => {
    const component = readFileSync(
        new URL("../src/layout/components/BackgroundTaskCenter.vue", import.meta.url),
        "utf8"
    );

    assert.match(component, /ws\.on\("ReceiveBackgroundTaskList", this\.handleTaskList\)/);
    assert.match(component, /formatDateTime\(row\.CreateTime\)/);
    assert.match(component, /getFullYear\(\)[\s\S]*?getMonth\(\)[\s\S]*?getDate\(\)[\s\S]*?getHours\(\)/);
    assert.doesNotMatch(component, /taskPollTimer|scheduleTaskPolling|shouldPollBackgroundTasks/);
    assert.doesNotMatch(component, /setInterval\([\s\S]{0,220}BackgroundTask\/List/);
});

test("notification center keeps pagination reachable in a short viewport", () => {
    const component = readFileSync(
        new URL("../src/layout/components/BackgroundTaskCenter.vue", import.meta.url),
        "utf8"
    );

    assert.match(component, /:global\(\.el-dialog\.microi-notification-dialog\)\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;/);
    assert.match(component, /:global\(\.el-dialog\.microi-notification-dialog > \.el-dialog__body\)\s*\{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?overflow-y:\s*auto;[\s\S]*?scrollbar-gutter:\s*stable;/);
});

test("task results distinguish business navigation from downloadable artifacts", () => {
    const component = readFileSync(
        new URL("../src/layout/components/BackgroundTaskCenter.vue", import.meta.url),
        "utf8"
    );

    assert.match(component, /v-if="getTaskOpenUrl\(row\)"[\s\S]*?@click\.stop="openTaskResult\(row\)"/);
    assert.match(component, /data\.OpenUrl \|\| data\.openUrl \|\| result\.OpenUrl \|\| result\.openUrl/);
    assert.match(component, /normalizeNotificationLink\([\s\S]*?window\.location\.origin/);
    assert.match(component, /v-if="getTaskDownloadUrl\(row\)"[\s\S]*?downloadTaskResult\(row\)/);
    assert.doesNotMatch(component, /row\.HasResult \|\| getTaskDownloadUrl\(row\)/);
});

test("platform app notices fail closed and refresh only after maintenance reaches a terminal state", () => {
    const component = readFileSync(
        new URL("../src/layout/components/BackgroundTaskCenter.vue", import.meta.url),
        "utf8"
    );

    assert.match(component, /Action:\s*"CheckPlatformApps"/);
    assert.match(component, /InstalledVersions:\s*installedVersions/);
    assert.match(component, /normalizeOfficialAppNotices\(result\)/);
    assert.match(component, /this\.storeNotices = \[\];[\s\S]*?this\.storeLoadError = error\?\.message/);
    assert.match(component, /v-if="!storeLoading && storeLoadError"/);
    assert.match(component, /hasCompletedPlatformMaintenanceTransition\(rows\)/);
    assert.match(component, /consumeCompletedPlatformMaintenanceTransitions\(\{/);
    assert.match(component, /registeredTaskIds:\s*this\.platformMaintenanceTaskIds/);
    assert.match(component, /await this\.checkOfficialApps\(true\)/);
    assert.match(component, /createCoalescedTrailingRunner\([\s\S]*?runOfficialAppCheck/);
    assert.match(component, /createCoalescedTrailingRunner\([\s\S]*?runOfficialAppsRefreshAfterMaintenance/);
    assert.doesNotMatch(component, /this\.storeLoading\s*&&\s*attempt\s*<\s*20/);
    assert.match(component, /beforeUnmount\(\)\s*\{[\s\S]*?invalidateOfficialAppCheckWork\(true\)/);
    assert.match(component, /officialAppExecutionScope\(\)\s*\{[\s\S]*?invalidateOfficialAppCheckWork\(\)/);
    assert.match(component, /invalidateOfficialAppCheckWork\(dispose = false\)[\s\S]*?this\.storeNotices = \[\];[\s\S]*?this\.lastStoreCheckTime = 0/);
    assert.match(component, /runOfficialAppCheck\(force\)[\s\S]*?checkGeneration[\s\S]*?isOfficialAppCheckCurrent\(checkGeneration\)[\s\S]*?requestOfficialStoreList[\s\S]*?isOfficialAppCheckCurrent\(checkGeneration\)[\s\S]*?this\.storeNotices/);
    assert.doesNotMatch(component, /handleBackgroundTaskStarted\([^)]*\)\s*\{[\s\S]{0,300}checkOfficialApps/);
});

test("marketplace install completion refreshes permissions, routes and the left menu without a page reload", () => {
    const component = readFileSync(
        new URL("../src/layout/components/BackgroundTaskCenter.vue", import.meta.url),
        "utf8"
    );
    const host = readFileSync(
        new URL("../src/views/micro-app/host.vue", import.meta.url),
        "utf8"
    );
    const dynamicRoutes = readFileSync(
        new URL("../src/utils/dynamic-menu-routes.js", import.meta.url),
        "utf8"
    );

    assert.match(host, /type === "background-task:created"[\s\S]*?microi-background-task-started/);
    assert.match(component, /isMarketplaceInstallTask\(item\)/);
    assert.match(component, /key === "import-microi-store-package"/);
    assert.match(component, /consumeCompletedMarketplaceInstallTransitions\(rows\)/);
    assert.match(component, /scheduleMarketplaceInstallTaskPoll\(String\(taskId\)\)/);
    assert.match(component, /Action:\s*"Status"[\s\S]*?TaskId:\s*id/);
    assert.match(component, /pollMarketplaceInstallTask[\s\S]*?await this\.refreshMenusAfterMarketplaceInstall\(\)/);
    assert.match(component, /clearMarketplaceInstallTaskPollTimers\(\)/);
    assert.match(component, /await DiyCommon\.RefreshAppStores\(\)/);
    assert.match(component, /await refreshDynamicMenuRoutes\(/);
    assert.match(dynamicRoutes, /permissionStore\.generateRoutes/);
    assert.match(dynamicRoutes, /router\.removeRoute/);
    assert.match(dynamicRoutes, /router\.addRoute/);
    assert.doesNotMatch(component, /location\.reload\(/);
});
