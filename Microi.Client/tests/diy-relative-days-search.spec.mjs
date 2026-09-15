import assert from "node:assert/strict";
import test from "node:test";

import {
    createRelativeDaysFilter,
    getRelativeDaysSearchConfig,
    resolveRelativeDaysFilters
} from "../src/views/form-engine/utils/diy-relative-days-search.js";

const field = {
    Name: "HetongDQSJ",
    Label: "距合同到期天数",
    Config: {
        RelativeDaysSearch: {
            Enabled: true,
            TargetField: "HetongJSSJ",
            Mode: "FutureWithin",
            Min: 0,
            Max: 3650,
            TimeZone: "Asia/Shanghai",
            Unit: "天"
        }
    }
};

test("builds an inclusive-today and exclusive-end contract expiry range", () => {
    const result = createRelativeDaysFilter(field, "30");
    assert.equal(result.error, "");
    assert.deepEqual(
        resolveRelativeDaysFilters([result.filter], new Date("2026-09-14T16:30:00.000Z")),
        [
            ["HetongJSSJ", ">=", "2026-09-15"],
            ["HetongJSSJ", "<", "2026-10-16"]
        ]
    );
});

test("zero days only includes contracts expiring today", () => {
    const result = createRelativeDaysFilter(field, 0, "Diy_Dingdan.");
    assert.deepEqual(
        resolveRelativeDaysFilters([result.filter], new Date("2026-09-15T03:00:00.000Z")),
        [
            ["Diy_Dingdan.HetongJSSJ", ">=", "2026-09-15"],
            ["Diy_Dingdan.HetongJSSJ", "<", "2026-09-16"]
        ]
    );
});

test("rejects non-integer and out-of-range input", () => {
    assert.match(createRelativeDaysFilter(field, "1.5").error, /整数/);
    assert.match(createRelativeDaysFilter(field, -1).error, /0 至 3650/);
    assert.match(createRelativeDaysFilter(field, 3651).error, /0 至 3650/);
});

test("disabled configuration falls back to ordinary field search", () => {
    assert.equal(getRelativeDaysSearchConfig({ Config: { RelativeDaysSearch: { Enabled: false } } }), null);
});

test("cached raw days are resolved again against the current business date", () => {
    const result = createRelativeDaysFilter(field, 1);
    const firstDay = resolveRelativeDaysFilters([result.filter], new Date("2026-12-31T15:59:00.000Z"));
    const nextDay = resolveRelativeDaysFilters([result.filter], new Date("2026-12-31T16:01:00.000Z"));
    assert.deepEqual(firstDay, [
        ["HetongJSSJ", ">=", "2026-12-31"],
        ["HetongJSSJ", "<", "2027-01-02"]
    ]);
    assert.deepEqual(nextDay, [
        ["HetongJSSJ", ">=", "2027-01-01"],
        ["HetongJSSJ", "<", "2027-01-03"]
    ]);
});
