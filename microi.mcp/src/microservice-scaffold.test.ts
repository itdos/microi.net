import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  buildVueMicroServiceScaffoldPlan,
  scaffoldVueMicroService,
} from './microservice-scaffold.js';

function createAiApplicationsDirectory(): { root: string; aiApplicationsDirectory: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'microi-vue-scaffold-'));
  const aiApplicationsDirectory = path.join(root, 'AI应用');
  fs.mkdirSync(aiApplicationsDirectory);
  return { root, aiApplicationsDirectory };
}

function scaffoldOptions(aiApplicationsDirectory: string) {
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
    assert.equal(plan.fileContents.has('vite.config.ts'), true);
    assert.equal(plan.fileContents.has('tsconfig.json'), true);
    assert.equal(plan.fileContents.has('src/main.ts'), true);
    assert.equal(plan.fileContents.has('src/env.d.ts'), true);
    assert.equal(plan.fileContents.has('src/microi.ts'), true);
    assert.equal(plan.fileContents.has('src/routes.ts'), true);
    assert.equal(plan.fileContents.has('vite.config.js'), false);
    assert.equal(plan.fileContents.has('src/main.js'), false);
    const packageModel = JSON.parse(plan.fileContents.get('package.json') || '{}') as {
      engines?: Record<string, string>;
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    assert.equal(packageModel.engines?.node, '^20.19.0 || >=22.12.0');
    assert.deepEqual(packageModel.dependencies, { vue: '3.5.40' });
    assert.deepEqual(packageModel.devDependencies, {
      '@vitejs/plugin-vue': '6.0.8',
      typescript: '5.9.3',
      vite: '7.3.6',
      'vue-tsc': '3.3.9',
    });
    assert.equal(packageModel.scripts?.typecheck, 'vue-tsc --noEmit');
    assert.equal(packageModel.scripts?.build, 'npm run typecheck && vite build');
    assert.equal(Object.hasOwn(packageModel.dependencies || {}, 'pinia'), false);
    assert.equal(Object.hasOwn(packageModel.dependencies || {}, 'vue-router'), false);
    assert.match(plan.fileContents.get('src/App.vue') || '', /<script setup lang="ts">/u);
    for (const route of plan.routes) {
      assert.match(plan.fileContents.get(route.sourceFile) || '', /<script setup lang="ts">/u);
    }
    assert.match(plan.fileContents.get('index.html') || '', /src="\/src\/main\.ts"/u);
    assert.match(plan.fileContents.get('vite.config.ts') || '', /base:\s*'\.\/'/u);
    assert.match(plan.fileContents.get('vite.config.ts') || '', /assetsDir:\s*'assets'/u);
    const tsConfig = JSON.parse(plan.fileContents.get('tsconfig.json') || '{}') as {
      compilerOptions?: Record<string, unknown>;
    };
    assert.equal(tsConfig.compilerOptions?.strict, true);
    assert.equal(tsConfig.compilerOptions?.moduleResolution, 'Bundler');
    assert.equal(tsConfig.compilerOptions?.noUncheckedIndexedAccess, true);
    assert.equal(tsConfig.compilerOptions?.verbatimModuleSyntax, true);
    assert.match(plan.fileContents.get('src/microi.ts') || '', /createMicroiV8/u);
    assert.match(plan.fileContents.get('src/microi.ts') || '', /appliedHostToken/u);
    assert.match(plan.fileContents.get('src/routes.ts') || '', /MicroServiceRoute/u);
    const sdk = plan.fileContents.get('src/utils/microi.v8.js') || '';
    assert.match(sdk, /\/apiengine\//u);
    assert.doesNotMatch(sdk, /\/api\/ApiEngine\/Run/u);
    const styles = plan.fileContents.get('src/style.css') || '';
    assert.match(styles, /min-height:\s*var\(--micro-app-available-height,\s*100vh\)/u);
    assert.doesNotMatch(styles, /min-height:\s*100vh/u);
    assert.equal(fs.existsSync(plan.targetDirectory), false);
  } finally {
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
    const routeManifest = JSON.parse(fs.readFileSync(path.join(first.targetDirectory, 'microi.routes.json'), 'utf8')) as Array<Record<string, unknown>>;
    assert.equal(routeManifest.length, 2);
    assert.equal(routeManifest.filter(route => route.isHome === true).length, 1);
    assert.equal(fs.existsSync(path.join(first.targetDirectory, 'src/pages/ContextTestPage.vue')), true);
    assert.equal(fs.existsSync(path.join(first.targetDirectory, 'src/pages/InteractionTestPage.vue')), true);
    assert.equal(fs.existsSync(path.join(first.targetDirectory, 'vite.config.ts')), true);
    assert.equal(fs.existsSync(path.join(first.targetDirectory, 'tsconfig.json')), true);
    assert.equal(fs.existsSync(path.join(first.targetDirectory, 'src/main.ts')), true);
    assert.equal(fs.existsSync(path.join(first.targetDirectory, 'src/env.d.ts')), true);

    const appVue = path.join(first.targetDirectory, 'src/App.vue');
    fs.appendFileSync(appVue, '\n<!-- preserved-local-edit -->\n');
    const second = scaffoldVueMicroService(options);
    assert.equal(second.created, false);
    assert.equal(second.skipped, true);
    assert.match(fs.readFileSync(appVue, 'utf8'), /preserved-local-edit/u);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Vue MicroService scaffold retries transient Windows rename failures', () => {
  const { root, aiApplicationsDirectory } = createAiApplicationsDirectory();
  const renameSync = fs.renameSync;
  let attempts = 0;
  try {
    fs.renameSync = ((oldPath: fs.PathLike, newPath: fs.PathLike) => {
      attempts += 1;
      if (attempts < 3) {
        const error = new Error('temporary directory lock') as NodeJS.ErrnoException;
        error.code = 'EPERM';
        throw error;
      }
      renameSync(oldPath, newPath);
    }) as typeof fs.renameSync;

    const result = scaffoldVueMicroService(scaffoldOptions(aiApplicationsDirectory));
    assert.equal(result.created, true);
    assert.equal(attempts, 3);
    assert.equal(fs.existsSync(result.targetDirectory), true);
  } finally {
    fs.renameSync = renameSync;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Vue MicroService scaffold refuses non-AI directories and conflicting projects', () => {
  const { root, aiApplicationsDirectory } = createAiApplicationsDirectory();
  try {
    assert.throws(
      () => buildVueMicroServiceScaffoldPlan(scaffoldOptions(root)),
      /名为“AI应用”的目录/u,
    );
    const target = path.join(aiApplicationsDirectory, 'mcp-ai-vue-test');
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, 'README.md'), 'unrelated');
    assert.throws(
      () => scaffoldVueMicroService(scaffoldOptions(aiApplicationsDirectory)),
      /拒绝覆盖/u,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
