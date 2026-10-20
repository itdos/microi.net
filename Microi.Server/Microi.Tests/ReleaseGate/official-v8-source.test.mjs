import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {officialEmptyDatabaseSource, readOfficialEmptyDatabaseSource, emptyDatabaseEngineKey as key} from './official-v8-source.mjs';

const model = () => ({PackageInfo: {OsClient: 'iTdos'},
 ResourcePolicies: {ApiEngines: {[key]: {UpgradePolicy: 'Managed'}}},
 SysApiEngines: [{ApiEngineKey: key, ApiV8Code: 'return { Code: 1 };'}]});

test('official package source works without any pulled tenant engine copy', () => {
 const root = fs.mkdtempSync(path.join(os.tmpdir(), 'microi-official-v8-'));
 try {
  const directory = path.join(root, 'Microi.Server/OfficialApplications/Resource');
  fs.mkdirSync(directory, {recursive: true});
  fs.writeFileSync(path.join(directory, 'app.microi.saas-engine.json'), JSON.stringify(model()));
  assert.equal(readOfficialEmptyDatabaseSource(root), 'return { Code: 1 };');
  assert.equal(fs.existsSync(path.join(root, 'Microi-V8-Engine')), false);
 } finally { fs.rmSync(root, {recursive: true}); }
});
test('ownership and source validation never execute tenant code', () => {
 const value = model(); value.SysApiEngines[0].ApiV8Code = 'throw new Error("must not run");';
 assert.equal(officialEmptyDatabaseSource(value), value.SysApiEngines[0].ApiV8Code);
});
test('another tenant package is rejected', () => {
 const value = model(); value.PackageInfo.OsClient = 'other';
 assert.throws(() => officialEmptyDatabaseSource(value), /official iTdos/);
});
test('missing or CreateIfMissing ownership is rejected', () => {
 for (const policy of [undefined, {UpgradePolicy: 'CreateIfMissing'}]) {
  const value = model(); value.ResourcePolicies.ApiEngines[key] = policy;
  assert.throws(() => officialEmptyDatabaseSource(value), /must own/);
 }
});
test('absent and duplicate official engine declarations are rejected', () => {
 for (const count of [0, 2]) {
  const value = model(); value.SysApiEngines = Array.from({length: count}, () => value.SysApiEngines[0]);
  assert.throws(() => officialEmptyDatabaseSource(value), /exactly one/);
 }
});
test('empty and invalid source are rejected before regression execution', () => {
 for (const source of ['', '  ', null, 'return {']) {
  const value = model(); value.SysApiEngines[0].ApiV8Code = source;
  assert.throws(() => officialEmptyDatabaseSource(value));
 }
});
