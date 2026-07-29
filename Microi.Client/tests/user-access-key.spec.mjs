import test from "node:test";
import assert from "node:assert/strict";
import {
    buildAccessLoginUrl,
    isAccessRouteAllowed,
    normalizeAccessRoute
} from "../src/views/system/components/user-access-key-utils.js";

test("auto-login URL keeps tenant and does not copy unrelated query parameters", () => {
    const url = buildAccessLoginUrl({
        origin: "http://localhost:61500",
        pathname: "/index.html",
        osClient: "iTdos",
        loginPath: "/#/access-login?access_key=masked&redirect=%2Fmic%2Fdashboard"
    });

    assert.equal(
        url,
        "http://localhost:61500/?OsClient=iTdos#/access-login?access_key=masked&redirect=%2Fmic%2Fdashboard"
    );
});

test("full page URL is converted to a clean hash route", () => {
    assert.equal(
        normalizeAccessRoute("http://localhost:61500/?OsClient=iTdos#/mic/data-dashboard/preview/abc?ShowClassicTop=0"),
        "/mic/data-dashboard/preview/abc"
    );
});

test("wildcard supports canonical and legacy values", () => {
    assert.equal(normalizeAccessRoute("/*"), "*");
    assert.equal(isAccessRouteAllowed(["*"], "/mic/anything"), true);
    assert.equal(isAccessRouteAllowed(["/mic/a"], "/mic/b"), false);
});
