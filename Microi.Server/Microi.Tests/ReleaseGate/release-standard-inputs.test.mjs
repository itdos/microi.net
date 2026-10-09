import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {snapshotStandardInputs} from '../../tools/release-standard-inputs.mjs';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'microi-standard-candidate-'));
  t.after(() => fs.rm(root, {recursive: true, force: true}));
  const applications = Array.from({length: 6}, (_, i) => ({appKey: 'app-' + i}));
  const contract = {schemaVersion: 1, sourceParent: 'private-products', target: {apiBase: 'https://api.itdos.com', osClient: 'iTdos'}, applications};
  const file = path.join(root, 'AI-Project/标准产品套件/source-contract.json');
  await fs.mkdir(path.dirname(file), {recursive: true});
  await fs.writeFile(file, JSON.stringify(contract));
  for (const app of applications) {
    const folder = path.join(root, contract.sourceParent, app.appKey, 'tests');
    await fs.mkdir(folder, {recursive: true});
    await fs.writeFile(path.join(folder, 'fixture.mjs'), 'original');
  }
  return {root, contract, file};
}

async function declaredOfficialInputs(root) {
  const applications = ['microi-ai-cad', 'ai-employee-center', 'mci-email', 'microi-3d-engine'].map(AppKey => ({
    AppKey, SourceRoot: 'private-official/' + AppKey, FileCount: 1,
    Files: [{Path: 'src/real-test-input.js', Size: 8, Sha256: 'a'.repeat(64)}]
  }));
  const repositories = [{RepositoryKey: 'microi.openclaw', SourceRoot: 'private-official/worker', FileCount: 1,
    Files: [{Path: 'src/worker.js', Size: 8, Sha256: 'b'.repeat(64)}]}];
  const contract = {SchemaVersion: 1, Origin: {ApiBase: 'https://api.itdos.com', OsClient: 'iTdos'}, Applications: applications, Repositories: repositories};
  const file = path.join(root, 'Microi.Server/Microi.Tests/V8/official-application-source-contract.json');
  await fs.mkdir(path.dirname(file), {recursive: true}); await fs.writeFile(file, JSON.stringify(contract));
  for (const app of [...applications, ...repositories]) {
    const full = path.join(root, app.SourceRoot, app.Files[0].Path);
    await fs.mkdir(path.dirname(full), {recursive: true}); await fs.writeFile(full, 'original');
  }
  return {contract, file, applications, repositories};
}

async function declaredLotteryInputs(root) {
  const SourceRoot = 'private-lottery/source', appRoot = path.join(root, 'private-lottery');
  const contract = {SchemaVersion: 1, AppKey: 'event-lottery-studio', SourceRoot,
    BehaviorTest: 'test/behavior.test.mjs', DeliveryTests: ['../test/delivery.test.mjs']};
  const sourceContract = {schemaVersion: 2, applicationKey: contract.AppKey,
    sourceFiles: ['package-contract.json', 'main.js', 'test/behavior.test.mjs']};
  const deliveryContract = {schemaVersion: 2, applicationKey: contract.AppKey,
    deliveryFiles: ['test/delivery.test.mjs', 'scripts/helper.mjs', 'cluster-acceptance/scenarios.json']};
  const file = path.join(root, 'Microi.Server/Microi.Tests/V8/event-lottery-release.json');
  await fs.mkdir(path.dirname(file), {recursive: true}); await fs.writeFile(file, JSON.stringify(contract));
  await fs.mkdir(path.join(appRoot, 'source'), {recursive: true});
  await fs.writeFile(path.join(appRoot, 'package-contract.json'), JSON.stringify(deliveryContract));
  await fs.writeFile(path.join(appRoot, 'source/package-contract.json'), JSON.stringify(sourceContract));
  for (const name of [...sourceContract.sourceFiles.filter(name => name !== 'package-contract.json').map(name => 'source/' + name), ...deliveryContract.deliveryFiles]) {
    const full = path.join(appRoot, name); await fs.mkdir(path.dirname(full), {recursive: true}); await fs.writeFile(full, 'original');
  }
  return {contract, file, appRoot, sourceContract, deliveryContract};
}

test('Full 使用的忽略目录责任夹具变动必须改变冻结指纹，构建输出不影响候选', async t => {
  const {root} = await fixture(t), name = 'private-products/app-0/tests/fixture.mjs';
  await fs.writeFile(path.join(root, '.gitignore'), 'private-products/');
  const before = await snapshotStandardInputs(root);
  await fs.mkdir(path.join(root, 'private-products/app-0/dist'));
  await fs.writeFile(path.join(root, 'private-products/app-0/dist/build.js'), 'output');
  assert.deepEqual(await snapshotStandardInputs(root), before);
  await fs.writeFile(path.join(root, name), 'changed');
  assert.notEqual((await snapshotStandardInputs(root))[name], before[name]);
});

test('契约越界及私有源码目录联接失败关闭', async t => {
  const {root, contract, file} = await fixture(t);
  await fs.writeFile(file, JSON.stringify({...contract, sourceParent: '../outside'}));
  await assert.rejects(snapshotStandardInputs(root), /escapes/);
  await fs.writeFile(file, JSON.stringify(contract));
  const folder = path.join(root, 'private-products/app-0');
  await fs.rm(folder, {recursive: true});
  await fs.symlink(path.join(root, 'private-products/app-1'), folder, 'dir');
  await assert.rejects(snapshotStandardInputs(root), /symbolic link/);
});

test('两项 AI、邮箱和 worker 的精确声明输入全部冻结，不发现其它应用或未声明文件', async t => {
  const {root} = await fixture(t), inputs = await declaredOfficialInputs(root);
  await fs.writeFile(path.join(root, '.gitignore'), 'private-official/');
  const before = await snapshotStandardInputs(root);
  const selected = [...inputs.applications.slice(0, 3), ...inputs.repositories];
  for (const app of selected) {
    const name = app.SourceRoot + '/' + app.Files[0].Path;
    assert.ok(before[name], 'Full actual declared input is frozen: ' + name);
    await fs.writeFile(path.join(root, name), 'changed');
    assert.notEqual((await snapshotStandardInputs(root))[name], before[name]);
    await fs.writeFile(path.join(root, name), 'original');
  }
  const unused = inputs.applications[3];
  assert.equal(before[unused.SourceRoot + '/' + unused.Files[0].Path], undefined);
  await fs.writeFile(path.join(root, unused.SourceRoot, unused.Files[0].Path), 'unused app changed');
  await fs.writeFile(path.join(root, selected[0].SourceRoot, 'undeclared.js'), 'unrelated');
  assert.deepEqual(await snapshotStandardInputs(root), before);
});

test('唯一官方来源与源文件清单异常失败关闭', async t => {
  const {root} = await fixture(t), inputs = await declaredOfficialInputs(root);
  for (const source of ['../outside', '/absolute', 'C:\\outside', 'private-official/../worker']) {
    const invalid = structuredClone(inputs.contract); invalid.Applications[0].SourceRoot = source;
    await fs.writeFile(inputs.file, JSON.stringify(invalid));
    await assert.rejects(snapshotStandardInputs(root), /relative|escapes|Unsafe/);
  }
  const duplicate = structuredClone(inputs.contract); duplicate.Applications.push(duplicate.Applications[0]);
  await fs.writeFile(inputs.file, JSON.stringify(duplicate)); await assert.rejects(snapshotStandardInputs(root), /one owner/);
  const unsafeFile = structuredClone(inputs.contract); unsafeFile.Applications[0].Files[0].Path = '../outside';
  await fs.writeFile(inputs.file, JSON.stringify(unsafeFile)); await assert.rejects(snapshotStandardInputs(root), /relative|Unsafe/);
  const repeatedFile = structuredClone(inputs.contract); repeatedFile.Applications[0].Files.push(repeatedFile.Applications[0].Files[0]); repeatedFile.Applications[0].FileCount = 2;
  await fs.writeFile(inputs.file, JSON.stringify(repeatedFile)); await assert.rejects(snapshotStandardInputs(root), /Duplicate/);
  await fs.writeFile(inputs.file, JSON.stringify(inputs.contract));
  await fs.rm(path.join(root, inputs.applications[2].SourceRoot, inputs.applications[2].Files[0].Path));
  await assert.rejects(snapshotStandardInputs(root), /ENOENT/);
});

test('官方应用嵌套源码文件联接不能跨过指纹边界', async t => {
  const {root} = await fixture(t), inputs = await declaredOfficialInputs(root);
  const app = inputs.applications[0], target = path.join(root, app.SourceRoot, app.Files[0].Path);
  await fs.rm(target); await fs.symlink(path.join(root, inputs.applications[1].SourceRoot, inputs.applications[1].Files[0].Path), target, 'file');
  await assert.rejects(snapshotStandardInputs(root), /symbolic link/);
});

test('抽奖来源、交付测试与其声明的 helper/scenarios 均冻结，构建和恢复点不影响候选', async t => {
  const {root} = await fixture(t), inputs = await declaredLotteryInputs(root);
  const before = await snapshotStandardInputs(root);
  const declared = ['private-lottery/source/main.js', 'private-lottery/source/test/behavior.test.mjs',
    'private-lottery/test/delivery.test.mjs', 'private-lottery/scripts/helper.mjs', 'private-lottery/cluster-acceptance/scenarios.json'];
  for (const name of declared) {
    assert.ok(before[name], 'actual declared lottery input is frozen: ' + name);
    await fs.writeFile(path.join(root, name), 'changed'); assert.notEqual((await snapshotStandardInputs(root))[name], before[name]);
    await fs.writeFile(path.join(root, name), 'original');
  }
  for (const name of ['build/output.js', 'source/dist/output.js', '.deployment-state/receipt.json', 'source/undeclared.js']) {
    const full = path.join(inputs.appRoot, name); await fs.mkdir(path.dirname(full), {recursive: true}); await fs.writeFile(full, 'unrelated');
  }
  assert.deepEqual(await snapshotStandardInputs(root), before);
  const lotteryKeys = Object.keys(before).filter(name => name.startsWith('private-lottery/'));
  assert.deepEqual(lotteryKeys.sort(), ['private-lottery/package-contract.json', ...inputs.sourceContract.sourceFiles.map(name => 'private-lottery/source/' + name),
    ...inputs.deliveryContract.deliveryFiles.map(name => 'private-lottery/' + name)].sort());
});

test('抽奖唯一来源和交付入口越界、重复声明及联接均失败关闭', async t => {
  const {root} = await fixture(t), inputs = await declaredLotteryInputs(root);
  for (const patch of [{SourceRoot: '../outside'}, {BehaviorTest: '../test/delivery.test.mjs'}, {DeliveryTests: ['../../another-app/test.mjs']}]) {
    await fs.writeFile(inputs.file, JSON.stringify({...inputs.contract, ...patch}));
    await assert.rejects(snapshotStandardInputs(root), /relative|escapes|Unsafe/);
  }
  await fs.writeFile(inputs.file, JSON.stringify(inputs.contract));
  await fs.writeFile(path.join(inputs.appRoot, 'source/package-contract.json'), JSON.stringify({...inputs.sourceContract, sourceFiles: ['main.js', 'main.js']}));
  await assert.rejects(snapshotStandardInputs(root), /Duplicate/);
  await fs.writeFile(path.join(inputs.appRoot, 'source/package-contract.json'), JSON.stringify(inputs.sourceContract));
  const helper = path.join(inputs.appRoot, 'scripts/helper.mjs');
  await fs.rm(helper); await fs.symlink(path.join(root, 'private-products/app-0/tests/fixture.mjs'), helper, 'file');
  await assert.rejects(snapshotStandardInputs(root), /symbolic link/);
});

test('公共 checkout 没有独立夹具时保留原兼容边界', async t => {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'microi-public-candidate-'));
  t.after(() => fs.rm(root, {recursive: true, force: true}));
  await declaredOfficialInputs(root); await declaredLotteryInputs(root);
  await fs.rm(path.join(root, 'private-official'), {recursive: true});
  await fs.rm(path.join(root, 'private-lottery'), {recursive: true});
  assert.deepEqual(await snapshotStandardInputs(root), {});
});
