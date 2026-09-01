import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const resourceRoot = path.dirname(fileURLToPath(import.meta.url));
const packageNames = [
  'app.microi.sys-config.json',
  'app.microi.saas-engine.json',
];
const expectedDefaultValue = `<div class="col-md-12">
     {{ OsVersion }}
</div>
<div class="col-md-12">
     Copyright © 2009 - {{ YYYY }}
</div>`;

function loadPackage(name) {
  return JSON.parse(fs.readFileSync(path.join(resourceRoot, name), 'utf8'));
}

function getMenuBottomField(model) {
  return model.DiyFields.find(field => field.Id === '89898852-4e10-405f-b607-89cfafa52172');
}

test('official packages declare the same dynamic menu footer default without tenant data', () => {
  for (const name of packageNames) {
    const model = loadPackage(name);
    const field = getMenuBottomField(model);

    assert.ok(field, `${name} must contain the canonical MenuBottomContent field`);
    assert.equal(field.Name, 'MenuBottomContent');
    assert.equal(field.DefaultValue, expectedDefaultValue);
    assert.ok(model.PackageInfo.RequiredPlatformCapabilities.includes(
      'ClientFeature:MenuBottomContentDefaultFooter',
    ));
    assert.equal(
      (model.DataSets || []).some(dataSet => String(dataSet.TableName).toLowerCase() === 'sys_config'),
      false,
      `${name} must not overwrite tenant-specific Sys_Config data`,
    );
  }
});

test('both package changelogs describe the dynamic placeholder boundary', () => {
  for (const name of packageNames) {
    const model = loadPackage(name);
    const changeLog = model.PackageInfo.ChangeLog;

    assert.match(changeLog.Content, /\{\{ YYYY \}\}/);
    assert.match(changeLog.Content, /不携带 Sys_Config 租户数据/);
  }
});
