import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const controllerDirectory = path.join(directory, 'Controllers');
const catalog = JSON.parse(fs.readFileSync(path.join(directory, 'api-ownership-catalog.json'), 'utf8'));

function controllerClasses() {
  const classes = new Set();
  for (const file of fs.readdirSync(controllerDirectory).filter((name) => name.endsWith('.cs'))) {
    const source = fs.readFileSync(path.join(controllerDirectory, file), 'utf8');
    for (const match of source.matchAll(/\bclass\s+([A-Za-z0-9_]+Controller)\b/g)) classes.add(match[1]);
  }
  return [...classes].sort();
}

test('every native Controller has an explicit owner and disposition', () => {
  const discovered = controllerClasses();
  const declared = Object.keys(catalog.Controllers).sort();
  assert.deepEqual(declared, discovered);
  const validDispositions = new Set(Object.keys(catalog.Dispositions));
  for (const [name, entry] of Object.entries(catalog.Controllers)) {
    assert.ok(entry.OwnerId, `${name} has no owner`);
    assert.ok(['Application', 'HostKernel'].includes(entry.OwnerType), `${name} owner type is invalid`);
    assert.ok(validDispositions.has(entry.Disposition), `${name} disposition is invalid`);
  }
});

test('SSO native business actions stay deleted and the package owns orchestration', () => {
  const ssoFiles = fs.readdirSync(controllerDirectory)
    .filter((name) => name.startsWith('SsoController') && name.endsWith('.cs'))
    .map((name) => fs.readFileSync(path.join(controllerDirectory, name), 'utf8'))
    .join('\n');
  const userSource = fs.readFileSync(path.join(controllerDirectory, 'SysUserController.cs'), 'utf8');
  for (const action of ['Capabilities', 'LegacyCapabilities', 'CompleteLogin', 'RotateClientSecret']) {
    assert.doesNotMatch(ssoFiles, new RegExp(`public\\s+(?:async\\s+)?[^\\n]+\\s${action}\\s*\\(`));
  }
  assert.doesNotMatch(userSource, /\bSsoPengrui\s*\(/);
  assert.equal(catalog.ActionOverrides.SsoController.ManagedApiEngines.length, 11);
});

test('password login remains an application-independent bootstrap boundary', () => {
  const login = catalog.ActionOverrides['SysUserController.Login'];
  assert.equal(login.Disposition, 'BootstrapIdentity');
  assert.match(login.Reason, /尚未安装应用/);
});
