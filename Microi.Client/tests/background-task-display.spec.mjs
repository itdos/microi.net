import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
    getBackgroundTaskEta,
    getBackgroundTaskProgress,
    isActiveBackgroundTask,
    shouldPollBackgroundTasks
} from "../src/utils/background-task-display.js";

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
