import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {snapshotStandardInputs} from '../../tools/release-standard-inputs.mjs';
import {snapshotCandidate, changedCandidate} from '../../tools/release-candidate.mjs';
import {execFileSync} from 'node:child_process';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'microi-standard-candidate-'));
  t.after(() => fs.rm(root, {recursive: true, force: true}));
  const applications = Array.from({length: 6}, (_, i) => ({appKey: 'app-' + i, requirements: i < 2 ? 'shared.md' : 'app-' + i + '.md'}));
  const contract = {schemaVersion: 1, sourceParent: 'private-products', requirementsRoot: 'private-requirements', target: {apiBase: 'https://api.itdos.com', osClient: 'iTdos'}, applications};
  const file = path.join(root, 'AI-Project/标准产品套件/source-contract.json');
  await fs.mkdir(path.dirname(file), {recursive: true});
  await fs.writeFile(file, JSON.stringify(contract));
  await fs.mkdir(path.join(root, contract.requirementsRoot));
  for (const name of new Set(applications.map(app => app.requirements)))
    await fs.writeFile(path.join(root, contract.requirementsRoot, name), 'declared requirements');
  for (const app of applications) {
    const folder = path.join(root, contract.sourceParent, app.appKey, 'tests');
    await fs.mkdir(folder, {recursive: true});
    await fs.writeFile(path.join(folder, 'fixture.mjs'), 'original');
  }
  return {root, contract, file};
}

async function declaredOfficialInputs(root) {
  const applications = ['microi-ai-cad', 'ai-employee-center', 'mci-email', 'microi-3d-engine', 'unused-official-app'].map(AppKey => ({
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
  const worker = path.join(root, repositories[0].SourceRoot);
  execFileSync('git', ['init', '--quiet'], {cwd: worker});
  execFileSync('git', ['add', 'src/worker.js'], {cwd: worker});
  execFileSync('git', ['-c', 'user.name=Microi Fixture', '-c', 'user.email=fixture@local.invalid', 'commit', '--quiet', '-m', 'worker fixture'], {cwd: worker});
  repositories[0].GitCommit = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: worker, encoding: 'utf8'}).trim();
  await fs.writeFile(file, JSON.stringify(contract));
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
  const manifest = {schemaVersion: 2, app: {key: contract.AppKey}, engines: [
    {key: 'gateway', sourceFile: 'source/engines/gateway.js'}, {key: 'public', sourceFile: 'engines/public.js'}]};
  const file = path.join(root, 'Microi.Server/Microi.Tests/V8/event-lottery-release.json');
  await fs.mkdir(path.dirname(file), {recursive: true}); await fs.writeFile(file, JSON.stringify(contract));
  await fs.mkdir(path.join(appRoot, 'source'), {recursive: true});
  await fs.writeFile(path.join(appRoot, 'package-contract.json'), JSON.stringify(deliveryContract));
  await fs.writeFile(path.join(appRoot, 'source/package-contract.json'), JSON.stringify(sourceContract));
  await fs.writeFile(path.join(appRoot, 'manifest.json'), JSON.stringify(manifest));
  for (const name of [...sourceContract.sourceFiles.filter(name => name !== 'package-contract.json').map(name => 'source/' + name), ...deliveryContract.deliveryFiles]) {
    const full = path.join(appRoot, name); await fs.mkdir(path.dirname(full), {recursive: true}); await fs.writeFile(full, 'original');
  }
  for (const engine of manifest.engines) {
    const full = path.join(appRoot, engine.sourceFile); await fs.mkdir(path.dirname(full), {recursive: true}); await fs.writeFile(full, 'engine source');
  }
  return {contract, file, appRoot, sourceContract, deliveryContract, manifest};
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

test('两项 AI、邮箱、前端 Three 与 worker 的精确声明输入全部冻结，不发现其它应用或未声明文件', async t => {
  const {root} = await fixture(t), inputs = await declaredOfficialInputs(root);
  await fs.writeFile(path.join(root, '.gitignore'), 'private-official/');
  const before = await snapshotStandardInputs(root);
  const selected = [...inputs.applications.slice(0, 4), ...inputs.repositories];
  for (const app of selected) {
    const name = app.SourceRoot + '/' + app.Files[0].Path;
    assert.ok(before[name], 'Full actual declared input is frozen: ' + name);
    await fs.writeFile(path.join(root, name), 'changed');
    assert.notEqual((await snapshotStandardInputs(root))[name], before[name]);
    await fs.writeFile(path.join(root, name), 'original');
  }
  const unused = inputs.applications[4];
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
    ...inputs.deliveryContract.deliveryFiles.map(name => 'private-lottery/' + name), 'private-lottery/manifest.json',
    ...inputs.manifest.engines.map(engine => 'private-lottery/' + engine.sourceFile)].sort());
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

test('每个应用实际声明的需求文档冻结，去重共享文档且真实候选拒绝字节漂移', async t => {
  const {root, contract} = await fixture(t);
  execFileSync('git', ['init', '--quiet'], {cwd: root});
  await fs.writeFile(path.join(root, '.gitignore'), 'private-products/\nprivate-requirements/\n');
  const before = await snapshotCandidate(root, ['.']);
  const names = [...new Set(contract.applications.map(app => contract.requirementsRoot + '/' + app.requirements))];
  assert.equal(names.length, 5);
  for (const name of names) assert.ok(before.files[name], 'requirements input is frozen: ' + name);
  const name = names[0]; await fs.appendFile(path.join(root, name), '\nchanged');
  assert.deepEqual(changedCandidate(before, await snapshotCandidate(root, ['.'])), [name]);
});

test('需求声明缺失、越界、缺文件与文档联接均失败关闭', async t => {
  const {root, contract, file} = await fixture(t);
  for (const patch of [{requirementsRoot: '../outside'}, {requirementsRoot: 'C:\\outside'}]) {
    await fs.writeFile(file, JSON.stringify({...contract, ...patch}));
    await assert.rejects(snapshotStandardInputs(root), /relative|escapes|Unsafe/);
  }
  for (const requirements of [undefined, '../outside.md', '/absolute.md', 'C:\\outside.md']) {
    const invalid = structuredClone(contract); invalid.applications[0].requirements = requirements;
    await fs.writeFile(file, JSON.stringify(invalid));
    await assert.rejects(snapshotStandardInputs(root), /relative|escapes|Unsafe/);
  }
  await fs.writeFile(file, JSON.stringify(contract));
  const name = path.join(root, contract.requirementsRoot, contract.applications[0].requirements);
  await fs.rm(name); await assert.rejects(snapshotStandardInputs(root), /ENOENT/);
  await fs.symlink(path.join(root, contract.requirementsRoot, contract.applications[2].requirements), name, 'file');
  await assert.rejects(snapshotStandardInputs(root), /symbolic link/);
});

test('抽奖manifest与其中未列入源码合同的引擎正文都冻结且独立漂移', async t => {
  const {root} = await fixture(t), inputs = await declaredLotteryInputs(root);
  const before = await snapshotStandardInputs(root);
  for (const name of ['manifest.json', ...inputs.manifest.engines.map(engine => engine.sourceFile)]) {
    const key = 'private-lottery/' + name;
    assert.ok(before[key], 'manifest-owned input is frozen: ' + key);
    const original = await fs.readFile(path.join(inputs.appRoot, name));
    await fs.appendFile(path.join(inputs.appRoot, name), name === 'manifest.json' ? ' ' : '\nchanged');
    assert.notEqual((await snapshotStandardInputs(root))[key], before[key]);
    await fs.writeFile(path.join(inputs.appRoot, name), original);
  }
});

test('抽奖manifest缺失、归属错误、引擎正文缺失与跨应用或联接输入均失败关闭', async t => {
  const {root} = await fixture(t), inputs = await declaredLotteryInputs(root), manifestFile = path.join(inputs.appRoot, 'manifest.json');
  await fs.rm(manifestFile); await assert.rejects(snapshotStandardInputs(root), /ENOENT/);
  await fs.writeFile(manifestFile, JSON.stringify({...inputs.manifest, app: {key: 'other-app'}}));
  await assert.rejects(snapshotStandardInputs(root), /lottery.*manifest/i);
  for (const sourceFile of ['../outside.js', '/absolute.js', 'C:\\outside.js', 'source/../outside.js', undefined]) {
    const invalid = structuredClone(inputs.manifest); invalid.engines[0].sourceFile = sourceFile;
    await fs.writeFile(manifestFile, JSON.stringify(invalid));
    await assert.rejects(snapshotStandardInputs(root), /relative|escapes|Unsafe/);
  }
  await fs.writeFile(manifestFile, JSON.stringify(inputs.manifest));
  const body = path.join(inputs.appRoot, inputs.manifest.engines[0].sourceFile);
  await fs.rm(body); await assert.rejects(snapshotStandardInputs(root), /ENOENT/);
  await fs.symlink(path.join(root, 'private-products/app-0/tests/fixture.mjs'), body, 'file');
  await assert.rejects(snapshotStandardInputs(root), /symbolic link/);
});

test('官方worker实际独立Git HEAD每次捕获和验证均匹配合同，未声明文件提交也拒绝', async t => {
  const {root} = await fixture(t), inputs = await declaredOfficialInputs(root);
  execFileSync('git', ['init', '--quiet'], {cwd: root});
  await fs.writeFile(path.join(root, '.gitignore'), 'private-products/\nprivate-requirements/\nprivate-official/\n');
  const before = await snapshotCandidate(root, ['.']);
  assert.deepEqual(changedCandidate(before, await snapshotCandidate(root, ['.'])), []);
  const worker = path.join(root, inputs.repositories[0].SourceRoot);
  await fs.writeFile(path.join(worker, 'unlisted.txt'), 'same declared source, different HEAD');
  execFileSync('git', ['add', 'unlisted.txt'], {cwd: worker});
  execFileSync('git', ['-c', 'user.name=Microi Fixture', '-c', 'user.email=fixture@local.invalid', 'commit', '--quiet', '-m', 'HEAD drift'], {cwd: worker});
  await assert.rejects(snapshotCandidate(root, ['.']), /GitCommit|HEAD/);
});

test('官方worker不能借父仓Git HEAD通过合同，即使父HEAD正好等于声明值', async t => {
  const {root} = await fixture(t), inputs = await declaredOfficialInputs(root);
  execFileSync('git', ['init', '--quiet'], {cwd: root});
  await fs.writeFile(path.join(root, 'outer.txt'), 'parent repository');
  execFileSync('git', ['add', 'outer.txt'], {cwd: root});
  execFileSync('git', ['-c', 'user.name=Microi Fixture', '-c', 'user.email=fixture@local.invalid', 'commit', '--quiet', '-m', 'outer fixture'], {cwd: root});
  inputs.repositories[0].GitCommit = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim();
  await fs.writeFile(inputs.file, JSON.stringify(inputs.contract));
  await fs.rm(path.join(root, inputs.repositories[0].SourceRoot, '.git'), {recursive: true});
  await assert.rejects(snapshotStandardInputs(root), /independent Git|repository root/);
  await fs.writeFile(path.join(root, inputs.repositories[0].SourceRoot, '.git'), 'gitdir: ' + path.join(root, '.git').replaceAll('\\', '/') + '\n');
  await assert.rejects(snapshotStandardInputs(root), /independent Git|repository root/);
});

const xjyProfile = 'Microi-V8-Engine/集福鲤平台 (api.jifulii.com)/xjy.Product.Internal/接口引擎';
const xjyReaders = ['microi.uniapp/scripts/test-directory-card-config.mjs', 'microi.uniapp/scripts/test-task-assignee-search.mjs'];
async function syncedXjyInputs(root) {
  for (const reader of xjyReaders) {
    await fs.mkdir(path.dirname(path.join(root, reader)), {recursive: true}); await fs.writeFile(path.join(root, reader), 'actual fixed reader');
  }
  const names = ['移动端通讯录获取系统人员(get-sysUser-list)(get-sysUser-list).js', '售后服务订单指派(shouhoudd_zhipai).js']
    .map(name => xjyProfile + '/未分类/' + name);
  for (const name of names) { await fs.mkdir(path.dirname(path.join(root, name)), {recursive: true}); await fs.writeFile(path.join(root, name), 'synced engine'); }
  return names;
}

test('uniapp实际reader存在才冻结固定xjy profile精确Key输入与reader，其他租户同名源码不进入', async t => {
  const {root} = await fixture(t), absent = await snapshotStandardInputs(root);
  assert.ok(!Object.keys(absent).some(name => name.startsWith('Microi-V8-Engine/')));
  const names = await syncedXjyInputs(root), before = await snapshotStandardInputs(root);
  for (const name of [...names, ...xjyReaders]) {
    assert.ok(before[name], 'actual xjy reader input is frozen: ' + name);
    await fs.appendFile(path.join(root, name), '\nchanged');
    assert.notEqual((await snapshotStandardInputs(root))[name], before[name]);
    await fs.writeFile(path.join(root, name), name.endsWith('.js') ? 'synced engine' : 'actual fixed reader');
  }
  const other = names[0].replace('/xjy.Product.Internal/', '/other.Product.Internal/');
  await fs.mkdir(path.dirname(path.join(root, other)), {recursive: true}); await fs.writeFile(path.join(root, other), 'other tenant');
  assert.deepEqual(await snapshotStandardInputs(root), before);
});

test('xjy固定Key缺失、重复和profile联接失败关闭，不能回退其它租户的同名引擎', async t => {
  const {root} = await fixture(t), names = await syncedXjyInputs(root);
  const original = path.join(root, names[0]), other = path.join(root, names[0].replace('/xjy.Product.Internal/', '/other.Product.Internal/'));
  await fs.mkdir(path.dirname(other), {recursive: true}); await fs.writeFile(other, 'other tenant');
  await fs.rm(original); await assert.rejects(snapshotStandardInputs(root), /not found/);
  await fs.writeFile(original, 'synced engine');
  const duplicate = path.join(root, xjyProfile, 'other-category', 'duplicate(get-sysUser-list).js');
  await fs.mkdir(path.dirname(duplicate), {recursive: true}); await fs.writeFile(duplicate, 'duplicate');
  await assert.rejects(snapshotStandardInputs(root), /Ambiguous|Duplicate/);
  await fs.rm(duplicate);
  const linked = path.join(root, xjyProfile); await fs.rename(linked, linked + '-real'); await fs.symlink(linked + '-real', linked, 'dir');
  await assert.rejects(snapshotStandardInputs(root), /symbolic link/);
});

test('公共checkout即使有uniapp reader，没有中央产品合同也不强行要求私有xjy输入', async t => {
  const {root, file} = await fixture(t);
  await syncedXjyInputs(root); await fs.rm(file); await fs.rm(path.join(root, 'Microi-V8-Engine'), {recursive: true});
  assert.deepEqual(await snapshotStandardInputs(root), {});
});

const settingsReader = 'Microi.Server/OfficialApplications/Resource/tenant-system-settings-resource.test.mjs';
const tenantSmsSource = 'Microi-V8-Engine/Microi吾码 (api.itdos.com)/iTdos.Product.Internal/接口引擎/未分类/[系统]发送阿里云短信(send_sms_reg).js';
async function smsFixture(t) {
  const fixtureData = await fixture(t), {root, contract, file} = fixtureData;
  const original = path.join(root, contract.sourceParent);
  contract.sourceParent = 'Microi-V8-Engine/Microi吾码 (api.itdos.com)/iTdos.Product.Internal/AI应用';
  await fs.mkdir(path.dirname(path.join(root, contract.sourceParent)), {recursive: true});
  await fs.rename(original, path.join(root, contract.sourceParent));
  await fs.writeFile(file, JSON.stringify(contract));
  return fixtureData;
}

test('系统设置实际reader只追加固定主租户短信正文，真实候选拒绝忽略源码漂移', async t => {
  const {root} = await smsFixture(t), absent = await snapshotStandardInputs(root);
  assert.equal(absent[tenantSmsSource], undefined);
  await fs.mkdir(path.dirname(path.join(root, settingsReader)), {recursive: true});
  await fs.writeFile(path.join(root, settingsReader), 'actual tracked reader');
  await fs.mkdir(path.dirname(path.join(root, tenantSmsSource)), {recursive: true});
  await fs.writeFile(path.join(root, tenantSmsSource), 'canonical SMS source');
  const standard = await snapshotStandardInputs(root);
  assert.ok(standard[tenantSmsSource]);
  assert.equal(standard[settingsReader], undefined, 'reader由原tracked候选冻结，不重复加入standard清单');
  assert.equal(Object.keys(standard).length, Object.keys(absent).length + 1);
  execFileSync('git', ['init', '--quiet'], {cwd: root});
  await fs.writeFile(path.join(root, '.gitignore'), 'private-products/\nprivate-requirements/\nMicroi-V8-Engine/\n');
  const before = await snapshotCandidate(root, ['.']);
  await fs.appendFile(path.join(root, tenantSmsSource), '\nchanged');
  assert.deepEqual(changedCandidate(before, await snapshotCandidate(root, ['.'])), [tenantSmsSource]);
});

test('系统设置短信正文缺失不能回退别租户，正文联接失败关闭', async t => {
  const {root} = await smsFixture(t);
  await fs.mkdir(path.dirname(path.join(root, settingsReader)), {recursive: true});
  await fs.writeFile(path.join(root, settingsReader), 'actual tracked reader');
  const other = path.join(root, tenantSmsSource.replace('/iTdos.Product.Internal/', '/other.Product.Internal/'));
  await fs.mkdir(path.dirname(other), {recursive: true}); await fs.writeFile(other, 'other tenant SMS');
  await assert.rejects(snapshotStandardInputs(root), /ENOENT/);
  const canonical = path.join(root, tenantSmsSource);
  await fs.mkdir(path.dirname(canonical), {recursive: true}); await fs.symlink(other, canonical, 'file');
  await assert.rejects(snapshotStandardInputs(root), /symbolic link/);
});

async function founderFixture(t) {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'microi-founder-solution-'));
  t.after(() => fs.rm(root, {recursive: true, force: true}));
  execFileSync('git', ['init', '--quiet'], {cwd: root});
  await fs.writeFile(path.join(root, '.gitignore'), 'Microi.Server/Microi.Anderson.sln\n');
  const server = path.join(root, 'Microi.Server'), project = 'Microi.Core/Microi.Core.csproj';
  await fs.mkdir(path.dirname(path.join(server, project)), {recursive: true});
  await fs.writeFile(path.join(server, project), '<Project />');
  const declaration = (type, target) => 'Project("{' + type + '}") = "Core", "' + target + '", "{00000000-0000-0000-0000-000000000001}"\nEndProject\n';
  const type = '9A19103F-16F7-4668-BE54-9A1E7A4F7556';
  const body = 'Microsoft Visual Studio Solution File, Format Version 12.00\n'
    + declaration('2150E333-8FDC-42A3-9474-1A3956D46DE8', 'Plugins') + declaration(type, project.replaceAll('/', '\\'));
  return {root, server, project, declaration, type, body, file: path.join(server, 'Microi.Anderson.sln')};
}

test('被忽略的创建人方案即使无标准产品契约也冻结，出现、消失及等长字节漂移均被实际候选拒绝', async t => {
  const f = await founderFixture(t), name = 'Microi.Server/Microi.Anderson.sln';
  const absent = await snapshotCandidate(f.root, ['.']);
  await fs.writeFile(f.file, f.body); const present = await snapshotCandidate(f.root, ['.']);
  assert.deepEqual(changedCandidate(absent, present), [name]);
  assert.ok((await snapshotStandardInputs(f.root))[name]);
  await fs.writeFile(f.file, f.body.replace('Plugins', 'Folders'));
  assert.deepEqual(changedCandidate(present, await snapshotCandidate(f.root, ['.'])), [name]);
  await fs.rm(f.file);
  assert.deepEqual(changedCandidate(present, await snapshotCandidate(f.root, ['.'])), [name]);
});

test('创建人方案拒绝绝对、外部、未知、重复及无法解析的项目路径', async t => {
  const f = await founderFixture(t), header = 'Microsoft Visual Studio Solution File, Format Version 12.00\n';
  for (const target of ['../Microi.Core/Microi.Core.csproj', '/outside.csproj', 'C:\\outside.csproj', '\\\\server\\outside.csproj', 'C:outside.csproj', 'unknown/unknown.csproj', 'Microi.Core/../Microi.Core/Microi.Core.csproj']) {
    await fs.writeFile(f.file, header + f.declaration(f.type, target));
    await assert.rejects(snapshotStandardInputs(f.root), /Unsafe/);
  }
  await fs.writeFile(f.file, f.body + f.declaration(f.type, f.project));
  await assert.rejects(snapshotStandardInputs(f.root), /duplicate/);
  await fs.writeFile(f.file, header + 'Project("broken declaration")\n');
  await assert.rejects(snapshotStandardInputs(f.root), /Malformed/);
  await fs.writeFile(f.file, header + f.declaration('00000000-0000-0000-0000-000000000000', f.project));
  await assert.rejects(snapshotStandardInputs(f.root), /Unsafe/);
});

test('合法方案首部BOM和空白不改变解析，但其原始字节变化仍进入指纹', async t => {
  const f = await founderFixture(t), name = 'Microi.Server/Microi.Anderson.sln';
  await fs.writeFile(f.file, f.body); const before = await snapshotStandardInputs(f.root);
  await fs.writeFile(f.file, '\uFEFF\r\n' + f.body);
  const after = await snapshotStandardInputs(f.root);
  assert.ok(after[name]); assert.notEqual(after[name], before[name]);
});

test('创建人方案文件或项目目录联接、缺失项目均失败关闭', async t => {
  const f = await founderFixture(t);
  await fs.writeFile(f.file, f.body); await fs.rm(path.join(f.server, f.project));
  await assert.rejects(snapshotStandardInputs(f.root), /ENOENT/);
  await fs.writeFile(path.join(f.server, f.project), '<Project />');
  const renamed = path.join(f.root, 'actual.sln'); await fs.writeFile(renamed, f.body);
  await fs.rm(f.file); await fs.symlink(renamed, f.file, 'file');
  await assert.rejects(snapshotStandardInputs(f.root), /symbolic links/);
  await fs.rm(f.file); await fs.writeFile(f.file, f.body);
  const source = path.join(f.root, 'linked-project'); await fs.mkdir(source); await fs.writeFile(path.join(source, 'Microi.Core.csproj'), '<Project />');
  await fs.rm(path.join(f.server, 'Microi.Core'), {recursive: true}); await fs.symlink(source, path.join(f.server, 'Microi.Core'), 'dir');
  await assert.rejects(snapshotStandardInputs(f.root), /symbolic link/);
});
