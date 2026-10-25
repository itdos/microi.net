import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import test from 'node:test';
import descriptor from '../file-resource-manifest.mjs';
import { manifest, contract } from '../build-file-resource-install-materials.mjs';
import { mapMasterIdentities } from '../sync-file-resource-master-identities.mjs';

test('install scope excludes existing config mutations, tenant data, roles, menus and workers', () => {
  assert.deepEqual(manifest.tables.map(t => t.name).sort(), ['mci_file_replica', 'mci_file_resource', 'mci_file_traffic_window']);
  for (const key of ['roles','modules','permissions','events','dataSources','pages','printTemplates','workflows','jobs']) assert.deepEqual(manifest[key], []);
  assert.equal(contract.configurationIsWrittenByThisManifest, false);
  assert.equal(contract.allowCrossTenantRegistration, false);
  assert.equal(contract.seedResources, false);
  assert.deepEqual(contract.genericPackageDefaults, { FileServerBakThresholdGiB: null, FileServerBakWindowHours: 24 });
  assert.equal(contract.publicRoutingEnabled, false);
});

test('planned ordered indexes match package DDL and preserve unknown measurements as nullable', () => {
  const pkg = JSON.parse(fs.readFileSync(new URL('../../Resource/app.microi.sys-log.json', import.meta.url), 'utf8'));
  for (const table of manifest.tables) {
    assert.equal(table.fields.length, descriptor.tables.find(t=>t.name===table.name).fields.length);
    for (const index of table.indexes) {
      const ddl = pkg.DDLStatements.find(d=>d.TableName===table.name && d.DDL.includes('INDEX `'+index.name+'`')).DDL;
      assert(ddl.includes('(' + index.columns.map(c=>'`'+c+'`').join(', ') + ')'));
      assert.equal(/^CREATE UNIQUE/.test(ddl), index.unique);
    }
    for (const field of table.fields) {
      assert.equal(field.readonly, 1);
      assert.equal(field.formWidth, undefined);
      const col=pkg.PhysicalColumns.find(c=>c.TABLE_NAME===table.name && c.COLUMN_NAME===field.name);
      assert.equal(col.IS_NULLABLE, 'YES');
      if (['Bytes','Requests','VerifiedSize'].includes(field.name)) assert.equal(col.COLUMN_DEFAULT, null);
    }
  }
});

test('manager source is exact and the planning contract does not assert a trusted writer already exists', () => {
  const code = fs.readFileSync(new URL('../engines/mci-file-resource-manager.js', import.meta.url), 'utf8');
  assert.equal(manifest.engines.length, 1);
  assert.equal(manifest.engines[0].code, code);
  assert.equal(manifest.engines[0].allowAnonymous, false);
  assert.equal(contract.sourceHashes.manager, crypto.createHash('sha256').update(code).digest('hex'));
  assert(contract.securityLimitations.some(x=>x.includes('generic CRUD')));
  assert(contract.activationBlockers.some(x=>x.includes('Trusted backend write boundary')));
  assert(contract.officialMasterRule.includes('including ValidateOnly'));
});

test('committed install artifacts reproduce the current declaration and manager source', () => {
  const saved = fs.readFileSync(new URL('../file-resource-install/manifest.json', import.meta.url), 'utf8');
  assert.equal(saved, JSON.stringify(manifest, null, 2) + '\n');
  const savedContract = JSON.parse(fs.readFileSync(new URL('../file-resource-install/installation-contract.json', import.meta.url), 'utf8'));
  assert.deepEqual(savedContract, {...contract, manifestFileSha256:crypto.createHash('sha256').update(saved).digest('hex')});
});

test('shared configuration candidates reuse each live master field identity exactly once', () => {
  const map = JSON.parse(fs.readFileSync(new URL('../file-resource-install/official-master-field-identities-20261025.json', import.meta.url), 'utf8'));
  for (const name of map.packages) {
    const pkg=JSON.parse(fs.readFileSync(new URL('../../Resource/'+name, import.meta.url), 'utf8'));
    for (const identity of map.fields) {
      const rows=pkg.DiyFields.filter(f=>f.TableId===map.tableId && f.Name===identity.name);
      assert.equal(rows.length,1);
      assert.equal(rows[0].Id,identity.id);
      assert.equal(pkg.DiyFields.filter(f=>f.Id===identity.id).length,1);
      if(identity.previousCandidateId) assert(!pkg.DiyFields.some(f=>f.Id===identity.previousCandidateId));
    }
  }
});

test('master table, field, DDL and engine identities match without changing executable code or unrelated resources', () => {
  const identities=JSON.parse(fs.readFileSync(new URL('../file-resource-install/official-master-catalog-identities-20261025.json',import.meta.url),'utf8'));
  const pkg=JSON.parse(fs.readFileSync(new URL('../../Resource/app.microi.sys-log.json',import.meta.url),'utf8'));
  assert.deepEqual(mapMasterIdentities(pkg,identities),pkg);
  const bad=structuredClone(identities); bad.osClient='microi_demo';
  assert.throws(()=>mapMasterIdentities(pkg,bad));
  for(const t of manifest.tables) {
    const actual=pkg.DiyTables.filter(x=>x.Name===t.name); assert.equal(actual.length,1);
    assert.equal(actual[0].Id,identities.tableIds[t.name]);
    assert(pkg.DDLStatements.filter(x=>x.TableName===t.name).every(x=>x.TableId===actual[0].Id));
  }
});
