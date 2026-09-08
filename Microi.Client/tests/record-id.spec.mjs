import assert from "node:assert/strict";
import test from "node:test";
import {
    hasScalarRecordId,
    normalizeRecordId,
    shouldReuseRecordWorkbenchRoute,
    ownsRecordWorkbenchRoute,
    verifyWorkbenchRecord
} from "../src/utils/record-id.js";

test("record ids accept scalar values and reject transport-breaking objects", () => {
    assert.equal(normalizeRecordId("  row-id  "), "row-id");
    assert.equal(normalizeRecordId(123), "123");
    assert.equal(normalizeRecordId({}), "");
    assert.equal(normalizeRecordId([]), "");
    assert.equal(normalizeRecordId(null), "");
    assert.equal(hasScalarRecordId({ Id: "nested" }), false);
});

test("record workbench query changes reuse one module tab", () => {
    assert.equal(shouldReuseRecordWorkbenchRoute({ query: { RecordId: "row-1" }, meta: {} }), true);
    assert.equal(shouldReuseRecordWorkbenchRoute({ query: { ViewMode: "Table" }, meta: {} }), true);
    assert.equal(shouldReuseRecordWorkbenchRoute({ query: {}, meta: {} }), false);
    assert.equal(shouldReuseRecordWorkbenchRoute({
        query: { RecordId: "row-1" },
        meta: { microAppHost: true }
    }), false);
});

test("cached modules cannot copy their record id into a different route", () => {
    assert.equal(ownsRecordWorkbenchRoute({ path: "/api-engine", meta: {} }, "/users", "users"), false);
    assert.equal(ownsRecordWorkbenchRoute({ path: "/users", meta: { Id: "api" } }, "/users", "users"), false);
    assert.equal(ownsRecordWorkbenchRoute({ path: "/users", meta: {} }, "/users", "users", true), false);
    assert.equal(ownsRecordWorkbenchRoute({ path: "/users", meta: { Id: "users" } }, "/users", "users"), true);
});

test("deep links support records outside the current page and reject missing records", async () => {
    const rows = [{ Id: "page-1" }];
    const read = async (id) => ({ Code: 1, Data: { Id: id } });
    assert.deepEqual(await verifyWorkbenchRecord("other-page", rows, read), { status: "found" });
    assert.deepEqual(await verifyWorkbenchRecord("deleted", rows, async () => ({ Code: 2, Msg: "NoExistData" })), { status: "missing" });
    assert.deepEqual(await verifyWorkbenchRecord("page-1", rows, () => { throw Error("unneeded request"); }), { status: "found" });
});

test("permission and transport errors do not clear deep links as nonexistent", async () => {
    for (const Code of [0, 1001, 1002]) {
        assert.deepEqual(await verifyWorkbenchRecord("id", [], async () => ({ Code, Msg: "denied" })), { status: "error", message: "denied" });
    }
    assert.deepEqual(await verifyWorkbenchRecord("id", [], async () => { throw Error("offline"); }), { status: "error", message: "offline" });
    assert.equal((await verifyWorkbenchRecord("id", [], async () => ({ Code: 1, Data: { Id: "different" } }))).status, "error");
});
