import assert from "node:assert/strict";
import test from "node:test";
import { buildMicroAppRouteAliases, resolveMicroAppMenuPaths } from "../src/router/micro-app-route-alias.js";

test("legacy, key and id MicroApp routes resolve to one route record", () => {
    assert.deepEqual(buildMicroAppRouteAliases({
        primaryPath: "/legacy/calendar",
        friendlyPath: "/micro-app/factory-app/factory-calendar",
        serviceId: "01ABC",
        routePath: "/factory-calendar"
    }), [
        "/micro-app/factory-app/factory-calendar",
        "/micro-app/01ABC/factory-calendar"
    ]);
});

test("the active canonical route is not repeated as an alias", () => {
    assert.deepEqual(buildMicroAppRouteAliases({
        primaryPath: "/micro-app/01ABC/home",
        friendlyPath: "/micro-app/factory-app/home",
        serviceId: "01ABC",
        routePath: "home"
    }), ["/micro-app/factory-app/home"]);
});

test("an installed MicroService menu keeps its historical URL as the primary route", () => {
    assert.deepEqual(resolveMicroAppMenuPaths({
        menuUrl: "/plugin/processRoute-plugin/home",
        friendlyPath: "/micro-app/loctek-custom-pages/process-route"
    }), {
        legacyMenuUrl: "/plugin/processRoute-plugin/home",
        primaryPath: "/plugin/processRoute-plugin/home"
    });
});

test("a canonical MicroApp URL is not mistaken for a legacy bookmark", () => {
    assert.deepEqual(resolveMicroAppMenuPaths({
        menuUrl: "/micro-app/loctek-custom-pages/process-route",
        friendlyPath: "/micro-app/loctek-custom-pages/process-route"
    }), {
        legacyMenuUrl: "",
        primaryPath: "/micro-app/loctek-custom-pages/process-route"
    });
});
