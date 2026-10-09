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
