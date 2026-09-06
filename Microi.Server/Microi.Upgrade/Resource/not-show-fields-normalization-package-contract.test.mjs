import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const resourceRoot = path.dirname(fileURLToPath(import.meta.url));
const packageModel = JSON.parse(fs.readFileSync(
  path.join(resourceRoot, 'app.microi.module-engine.json'),
  'utf8',
));

test('module engine package advertises the NotShowFields runtime contract', () => {
  const packageInfo = packageModel.PackageInfo;
  assert.equal(packageInfo.Version, 'v7.6.4');
  assert.equal(packageInfo.ChangeLog.Version, packageInfo.Version);
  assert.equal(packageInfo.ChangeLog.ChangeType, 'Fix');
  assert.match(String(packageInfo.ChangeHistory), /v7\.6\.2[^\n]*NotShowFields/);
  assert.ok(packageInfo.RequiredPlatformCapabilities.includes(
    'ClientFeature:NotShowFieldsNullSafeV1',
  ));
  assert.ok(packageInfo.RequiredPlatformCapabilities.includes(
    'ServerFeature:SysMenuNotShowFieldsNormalizationV1',
  ));
});
