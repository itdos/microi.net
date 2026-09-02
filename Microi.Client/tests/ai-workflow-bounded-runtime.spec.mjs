import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createBoundedAiWorkflowOverview } from "../src/views/ai-workflow/runtime.js";

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = path.resolve(testsDir, "../src");

test("AI workflow overview keeps rendering bounded and balanced", () => {
    const nodes = [];
    for (const type of ["table", "menu", "engine", "workflow"]) {
        for (let index = 0; index < 20; index += 1) {
            nodes.push({
                Id: `${type}_${index}`,
                Type: type,
                Label: `${type}-${index}`,
                Resource: {
                    Id: `${type}-resource-${index}`,
                    Name: `${type}-${index}`,
                    ApiV8Code: "x".repeat(10_000)
                },
                Details: { Fields: Array.from({ length: 100 }, (_, i) => ({ Id: i })) }
            });
        }
    }
    const edges = nodes.slice(1).map((node, index) => ({
        Id: `edge_${index}`,
        Source: nodes[index].Id,
        Target: node.Id
    }));
    const overview = createBoundedAiWorkflowOverview({
        Graph: { Nodes: nodes, Edges: edges },
        Stats: { GraphNodeCount: nodes.length, GraphEdgeCount: edges.length }
    }, 12);

    assert.equal(overview.Graph.Nodes.length, 12);
    assert.equal(new Set(overview.Graph.Nodes.map((node) => node.Type)).size, 4);
    assert.equal(overview.GraphTruncated, true);
    assert.equal(overview.Stats.AvailableGraphNodeCount, 80);
    assert.equal(overview.Stats.RenderedGraphNodeCount, 12);
    assert.deepEqual(overview.Graph.Nodes[0].Details, {});
    assert.equal("ApiV8Code" in overview.Graph.Nodes[0].Resource, false);
    assert.equal(overview.Inventory.Tables.length, 3);
    assert.equal(overview.Inventory.Menus.length, 3);
});

test("Redis manager uses the authenticated shell and duplicate AI aliases are retired", async () => {
    const router = await readFile(path.join(sourceRoot, "router/index.js"), "utf8");
    const redisStart = router.indexOf('path: "/mci-redis-manager"');
    const redisEnd = router.indexOf('path: "/mic/renderer-embed/:Id"', redisStart);
    const redisRoute = router.slice(redisStart, redisEnd);
    assert.match(redisRoute, /component:\s*Layout/);
    assert.match(redisRoute, /anonymous:\s*true/);
    assert.match(redisRoute, /hideShellForAnonymous:\s*true/);
    for (const route of ["/blueprint/list", "/state-machine/list", "/flow-engine/list", "/process-mining"]) {
        assert.equal(router.includes(`path: "${route}"`), false, route);
    }
    for (const route of ["/3d-engine/designer", "/3d-engine/renderer"]) {
        assert.equal(router.includes(`path: "${route}"`), false, `${route} must be provided by the published MicroService`);
    }
});

test("AI workflow waits for an explicit bounded load", async () => {
    const source = await readFile(path.join(sourceRoot, "views/ai-workflow/index.vue"), "utf8");
    const mountedStart = source.indexOf("mounted() {");
    const mountedEnd = source.indexOf("beforeUnmount() {", mountedStart);
    const mounted = source.slice(mountedStart, mountedEnd);
    assert.doesNotMatch(mounted, /loadOverview\s*\(/);
    assert.match(source, /MaxGraphNodes:\s*this\.graphLimit/);
    assert.match(source, /createBoundedAiWorkflowOverview/);
});
