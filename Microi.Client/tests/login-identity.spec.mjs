import test from "node:test";
import assert from "node:assert/strict";
import { getLoginIdentityName } from "./helpers/login-identity.mjs";

test("browser identity assertions use the actual login display name across response shapes", () => {
    for (const user of [{ Name: "Existing fixture user", Account: "fixture-user" }, { Account: "fixture-user" }]) {
        for (const Data of [user, { CurrentUser: user }, { User: user }]) {
            assert.equal(getLoginIdentityName({ Code: 1, Data }), user.Name || user.Account);
        }
    }
});

test("a successful code without a current identity cannot satisfy the logged-in UI assertion", () => {
    for (const response of [null, {}, { Code: 1 }, { Code: 1, Data: {} }, { Data: { Name: "   " } }]) {
        assert.throws(() => getLoginIdentityName(response), /missing the current user identity/);
    }
});
