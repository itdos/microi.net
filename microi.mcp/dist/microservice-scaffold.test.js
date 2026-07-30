import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildVueMicroServiceScaffoldPlan, scaffoldVueMicroService, } from './microservice-scaffold.js';
function createAiApplicationsDirectory() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'microi-vue-scaffold-'));
    const aiApplicationsDirectory = path.join(root, 'AI应用');
    fs.mkdirSync(aiApplicationsDirectory);
    return { root, aiApplicationsDirectory };
}
function scaffoldOptions(aiApplicationsDirectory) {
    return {
        aiApplicationsDirectory,
        appKey: 'mcp-ai-vue-test',
        name: 'MCP AI Vue 微服务测试',
        description: '验证 MCP 本地脚手架与双菜单路由。',
        apiBaseUrl: 'https://api.example.test',
        osClient: 'demo',
        buildVersion: 'v0.1.0',
        createdAt: '2026-07-29T00:00:00.000Z',
        routes: [
            { path: '/context-test', name: 'context-test', title: '上下文测试', isHome: true },
            { path: '/interaction-test', name: 'interaction-test', title: '交互测试' },
        ],
    };
}
test('Vue MicroService scaffold preflight declares exactly one page file per route', () => {
    const { root, aiApplicationsDirectory } = createAiApplicationsDirectory();
    try {
        const plan = buildVueMicroServiceScaffoldPlan(scaffoldOptions(aiApplicationsDirectory));
        assert.equal(plan.routes.length, 2);
        assert.deepEqual(plan.routes.map(route => route.sourceFile), [
            'src/pages/ContextTestPage.vue',
            'src/pages/InteractionTestPage.vue',
        ]);
        assert.equal(plan.files.filter(file => file.relativePath.startsWith('src/pages/')).length, 2);
        assert.equal(fs.existsSync(plan.targetDirectory), false);
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
test('Vue MicroService scaffold writes atomically and reruns without overwriting local edits', () => {
    const { root, aiApplicationsDirectory } = createAiApplicationsDirectory();
    try {
        const options = scaffoldOptions(aiApplicationsDirectory);
        const first = scaffoldVueMicroService(options);
        assert.equal(first.created, true);
        assert.equal(first.fileCount > 10, true);
        const routeManifest = JSON.parse(fs.readFileSync(path.join(first.targetDirectory, 'microi.routes.json'), 'utf8'));
        assert.equal(routeManifest.length, 2);
        assert.equal(routeManifest.filter(route => route.isHome === true).length, 1);
        assert.equal(fs.existsSync(path.join(first.targetDirectory, 'src/pages/ContextTestPage.vue')), true);
        assert.equal(fs.existsSync(path.join(first.targetDirectory, 'src/pages/InteractionTestPage.vue')), true);
        const appVue = path.join(first.targetDirectory, 'src/App.vue');
        fs.appendFileSync(appVue, '\n<!-- preserved-local-edit -->\n');
        const second = scaffoldVueMicroService(options);
        assert.equal(second.created, false);
        assert.equal(second.skipped, true);
        assert.match(fs.readFileSync(appVue, 'utf8'), /preserved-local-edit/u);
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
test('Vue MicroService scaffold refuses non-AI directories and conflicting projects', () => {
    const { root, aiApplicationsDirectory } = createAiApplicationsDirectory();
    try {
        assert.throws(() => buildVueMicroServiceScaffoldPlan(scaffoldOptions(root)), /名为“AI应用”的目录/u);
        const target = path.join(aiApplicationsDirectory, 'mcp-ai-vue-test');
        fs.mkdirSync(target);
        fs.writeFileSync(path.join(target, 'README.md'), 'unrelated');
        assert.throws(() => scaffoldVueMicroService(scaffoldOptions(aiApplicationsDirectory)), /拒绝覆盖/u);
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
//# sourceMappingURL=microservice-scaffold.test.js.map