import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const directory = dirname(fileURLToPath(import.meta.url));
const names = [
  'export-package.js', 'import-package.js', 'ai-app-publish-store.js', 'official-resource-api.js',
  'app.microi.form-engine.json', 'app.microi.module-engine.json', 'app.microi.saas-engine.json',
  'app.microi.sso.json', 'app.microi.store.json', 'app.microi.sys_user.json',
  'app.microi.sys-config.json', 'app.microi.message-notification.json',
  'app.microi.ai-engine.json', 'app.microi.sys-log.json',
];

// 在子进程中运行真实发布入口和合并实现，仅替换文件/网络边界为内存夹具。
// 任何发布、live 投影、外部进程或未声明文件访问立即失败；不会触碰真实资源。
async function probe(sourcePath, resourceDirectory, scenario) {
  const { SourceTextModule, SyntheticModule, createContext } = await import('node:vm');
  const core = await import(pathToFileURL(resolve(resourceDirectory, 'resource-sync-core.mjs')));
  const replica = await import(pathToFileURL(resolve(resourceDirectory, 'application-store-replica-sync.mjs')));
  const source = await readFile(sourcePath, 'utf8');
  const files = new Map();
  const remote = new Map();
  const calls = { reads: 0, writes: [], remoteReads: 0, remoteWrites: 0, projections: 0, mkdir: [] };
  const virtualDirectory = dirname(sourcePath);
  const changedName = 'app.microi.saas-engine.json';
  let nextVersion = '';
  if (!scenario.startsWith('conflict:')) {
  for (const name of names) {
    const content = core.canonicalizeResource(name, await readFile(resolve(resourceDirectory, name), 'utf8'));
    files.set(resolve(virtualDirectory, name), content);
    files.set(resolve(virtualDirectory, '.resource-sync-base', name), content);
    remote.set(name, { ResourceName: name, Content: content, Sha256: createHash('sha256').update(content).digest('hex'),
      AppVersion: name.endsWith('.json') ? JSON.parse(content).PackageInfo.Version : '' });
  }
  for (const { resourceName } of replica.applicationStoreReplicaMappings) {
    const key = resolve(virtualDirectory, resourceName);
    if (!files.has(key)) files.set(key, await readFile(resolve(resourceDirectory, resourceName), 'utf8'));
  }
  const storeName = replica.applicationStorePackageName;
  const synchronizedStore = replica.synchronizeApplicationStoreEngines(files.get(resolve(virtualDirectory, storeName)),
    new Map(replica.applicationStoreReplicaMappings.map(({ resourceName }) => [resourceName, files.get(resolve(virtualDirectory, resourceName))])));
  files.set(resolve(virtualDirectory, storeName), synchronizedStore);
  files.set(resolve(virtualDirectory, '.resource-sync-base', storeName), synchronizedStore);
  remote.set(storeName, { ResourceName: storeName, Content: synchronizedStore,
    Sha256: createHash('sha256').update(synchronizedStore).digest('hex'), AppVersion: JSON.parse(synchronizedStore).PackageInfo.Version });
  // 单独改变包描述，保持同版本的远端与共同基线；必须走真实自动升版路径。
  const original = JSON.parse(files.get(resolve(virtualDirectory, changedName)));
  const parts = String(original.PackageInfo.Version).replace(/^v/, '').split('.').map(Number);
  nextVersion = `v${parts[0]}.${parts[1]}.${parts[2] + 1}`;
  if (scenario !== 'unchanged') {
    original.PackageInfo.Description = `${original.PackageInfo.Description || ''} preparation regression`;
    files.set(resolve(virtualDirectory, changedName), core.canonicalizeResource(changedName, JSON.stringify(original)));
  }
  }
  const before = new Map(files);
  const argumentsForScenario = scenario.startsWith('conflict:')
    ? ['--prepare-candidate', scenario.slice('conflict:'.length)]
    : scenario === 'frozen-publish' ? ['--publish', '--require-unchanged-candidate'] : ['--prepare-candidate'];
  let output = '';
  let exitCode = null;
  let error = '';
  const context = createContext({ Buffer, URL, AbortSignal, setTimeout, clearTimeout,
    fetch: async () => { throw new Error('Unexpected HTTP request'); },
    process: {
      argv: [process.execPath, sourcePath, ...argumentsForScenario],
      env: { MICROI_UPGRADE_RESOURCE_TRANSPORT: 'mcp', MICROI_RELEASE_VERSION: nextVersion },
      execPath: process.execPath,
      stdout: { write: value => { output += value; } }, stderr: { write: value => { output += value; } },
      exit: code => { const stop = new Error('fixture exit'); stop.fixtureExit = code; throw stop; },
    },
  });
  const filesystem = {
    mkdir: async name => { calls.mkdir.push(String(name)); },
    readFile: async name => { calls.reads++; const key = resolve(String(name));
      if (!files.has(key)) { const missing = new Error(`Unexpected fixture file read: ${key}`); missing.code = 'ENOENT'; throw missing; }
      return files.get(key); },
    writeFile: async (name, content) => { const key = resolve(String(name));
      assert.ok(files.has(key), `Unexpected fixture file write: ${key}`);
      calls.writes.push(key); files.set(key, String(content)); },
  };
  const publisher = {
    readResourcesViaConfiguredMcp: async requested => { calls.remoteReads++; assert.deepEqual(Array.from(requested), names); return { resources: remote }; },
    publishResourcesViaConfiguredMcp: async () => { calls.remoteWrites++; throw new Error('Unexpected remote publication'); },
    reconcilePublishedApiEnginesViaConfiguredMcp: async () => { calls.projections++; throw new Error('Unexpected live projection'); },
  };
  const module = new SourceTextModule(source, { context, identifier: pathToFileURL(sourcePath).href,
    initializeImportMeta(meta) { meta.url = pathToFileURL(sourcePath).href; } });
  await module.link(async specifier => {
    const exports = specifier === 'node:fs/promises' ? filesystem
      : specifier === 'node:child_process' ? { execFile: () => { throw new Error('Unexpected external process'); } }
      : specifier === './mcp-resource-publisher.mjs' ? publisher
      : specifier === './resource-sync-core.mjs' ? core
      : specifier === './application-store-replica-sync.mjs' ? replica
      : await import(specifier);
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    }, { context });
  });
  try { await module.evaluate(); exitCode = 0; }
  catch (caught) { if (Object.hasOwn(caught, 'fixtureExit')) exitCode = caught.fixtureExit; else error = caught.message; }
  const baselineUnchanged = names.every(name => {
    const key = resolve(virtualDirectory, '.resource-sync-base', name); return files.get(key) === before.get(key);
  });
  return { exitCode, error, calls, baselineUnchanged, nextVersion,
    packageVersion: files.has(resolve(virtualDirectory, changedName))
      ? JSON.parse(files.get(resolve(virtualDirectory, changedName))).PackageInfo.Version : null,
    prepared: output.includes('Prepared release candidate: 14 resources; remote writes=0; synchronization baseline unchanged.'),
    changedFiles: names.filter(name => files.get(resolve(virtualDirectory, name)) !== before.get(resolve(virtualDirectory, name))),
  };
}

if (process.argv[2] === '--probe') {
  const result = await probe(resolve(process.argv[3]), resolve(process.argv[4]), process.argv[5]);
  process.stdout.write(JSON.stringify(result));
} else {
  function runProbe(scenario) {
    const child = spawnSync(process.execPath, ['--experimental-vm-modules', fileURLToPath(import.meta.url),
      '--probe', resolve(directory, 'refresh-resources.mjs'), directory, scenario],
    { encoding: 'utf8', windowsHide: true, timeout: 30000, maxBuffer: 2 * 1024 * 1024 });
    assert.equal(child.status, 0, child.stderr || child.stdout);
    return JSON.parse(child.stdout);
  }
  test('资源候选准备真实推进同版本包，成功退出且不发布、不投影、不推进共同基线', () => {
    const result = runProbe('changed');
    assert.equal(result.error, ''); assert.equal(result.exitCode, 0); assert.equal(result.prepared, true);
    assert.equal(result.packageVersion, result.nextVersion);
    assert.deepEqual(result.changedFiles, ['app.microi.saas-engine.json']);
    assert.equal(result.calls.remoteReads, 1); assert.equal(result.calls.remoteWrites, 0);
    assert.equal(result.calls.projections, 0); assert.equal(result.baselineUnchanged, true);
    assert.equal(result.calls.writes.length, 1);
  });
  test('资源候选已经一致时准备阶段零文件写入且不进行发布后回读', () => {
    const result = runProbe('unchanged');
    assert.equal(result.error, ''); assert.equal(result.exitCode, 0); assert.equal(result.prepared, true);
    assert.deepEqual(result.calls.writes, []); assert.equal(result.calls.remoteReads, 1);
    assert.equal(result.calls.remoteWrites, 0); assert.equal(result.calls.projections, 0); assert.equal(result.baselineUnchanged, true);
  });
  test('测试后严格发布仍在自动升版时拒绝候选漂移且零写入', () => {
    const result = runProbe('frozen-publish');
    assert.match(result.error, /官方资源候选已变化/); assert.equal(result.prepared, false);
    assert.deepEqual(result.calls.writes, []); assert.equal(result.calls.remoteWrites, 0);
    assert.equal(result.calls.projections, 0); assert.equal(result.baselineUnchanged, true);
  });
  for (const flag of ['--publish', '--validate-only', '--synchronize-local', '--initialize-base',
    '--repair-base-from-remote', '--bootstrap-missing', '--require-unchanged-candidate']) {
    test(`候选准备在任何文件或网络操作前拒绝不兼容参数 ${flag}`, () => {
      const result = runProbe(`conflict:${flag}`);
      assert.match(result.error, /--prepare-candidate 只能读取官网并准备本地候选/);
      assert.equal(result.calls.reads, 0); assert.deepEqual(result.calls.writes, []);
      assert.equal(result.calls.remoteReads, 0); assert.equal(result.calls.remoteWrites, 0);
      assert.equal(result.calls.projections, 0); assert.deepEqual(result.calls.mkdir, []);
    });
  }
  test('只有正式后端发布先准备资源再冻结测试，测试后仍严格发布', async () => {
    const release = await readFile(resolve(directory, '../../../Microi一键编译发布.sh'), 'utf8');
    const preparation = release.indexOf('refresh-resources.mjs --prepare-candidate --allow-verified-offline');
    const capture = release.indexOf('release-candidate.mjs capture');
    const publication = release.indexOf('refresh-resources.mjs --publish --allow-verified-offline --require-unchanged-candidate');
    assert.ok(preparation > 0 && preparation < capture && capture < publication);
    assert.match(release.slice(preparation - 350, preparation), /if \[ "\$PUBLISH_BACKEND" = true \] && \[ "\$MICROI_DOCKER_ONLY_HOTFIX" != true \] && \[ "\$MICROI_FULL_ONLY" != true \]; then/);
  });
}
