import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(testsDir, "..");

test("Redis keeps the authenticated shell and AI workflow is an external MicroService", async () => {
    const router = await readFile(path.join(clientRoot, "src/router/index.js"), "utf8");
    const redisStart = router.indexOf('path: "/mci-redis-manager"');
    const redisEnd = router.indexOf('path: "/mic/renderer-embed/:Id"', redisStart);
    const redisRoute = router.slice(redisStart, redisEnd);
    assert.match(redisRoute, /component:\s*Layout/);
    assert.match(redisRoute, /anonymous:\s*true/);
    assert.match(redisRoute, /hideShellForAnonymous:\s*true/);
    const redisManager = await readFile(path.join(clientRoot, "src/views/system/mci-redis-manager.vue"), "utf8");
    assert.match(redisManager, /hydrateAuthenticatedUser/);
    assert.match(redisManager, /DiyApi\.GetCurrentUser\(\)/);
    assert.match(redisManager, /diyStore\.setCurrentUser\(result\.Data\)/);

    for (const route of ["/blueprint/list", "/state-machine/list", "/flow-engine/list", "/process-mining"]) {
        assert.equal(router.includes(`path: "${route}"`), false, route);
    }
    for (const route of ["/3d-engine/designer", "/3d-engine/renderer"]) {
        assert.equal(router.includes(`path: "${route}"`), false, `${route} must be provided by the published MicroService`);
    }

    assert.match(router, /redirect:\s*"\/micro-app\/microi-ai-workflow\/relationship"/);
    await assert.rejects(access(path.join(clientRoot, "src/views/ai-workflow")));
});
