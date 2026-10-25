import assert from 'node:assert/strict';
import fs from 'node:fs';
import descriptor from './file-resource-manifest.mjs';

export const masterCatalogMetadata = JSON.parse(fs.readFileSync(new URL('./file-resource-install/official-master-catalog-metadata-20261025.json', import.meta.url), 'utf8'));
export const baseFieldNames = ['Id', 'CreateTime', 'UpdateTime', 'UserId', 'UserName', 'IsDeleted'];

// Merge only the missing platform-owned base fields and this single new engine.
// Business fields, physical DDL and every shared/unowned resource stay untouched.
export function alignMasterCatalogMetadata(input) {
  const master = masterCatalogMetadata;
  assert.equal(master.profile, 'microi_itdos_api_itdos_com');
  assert.equal(master.apiBase, 'https://api.itdos.com');
  assert.equal(master.osClient, 'iTdos');
  assert.equal(master.ownerAppId, descriptor.ownerAppId);
  assert.equal(input.PackageInfo.AppId, master.ownerAppId);
  assert.equal(master.DiyTables.length, 3); assert.equal(master.DiyFields.length, 67);
  assert.deepEqual(master.DataSets, []);
  const pkg = structuredClone(input);
  for (const definition of descriptor.tables) {
    const table = pkg.DiyTables.find(row => row.Name === definition.name);
    const source = master.DiyTables.find(row => row.Name === definition.name);
    assert.equal(table?.Id, source?.Id, 'map the verified master identities before metadata alignment');
    for (const name of baseFieldNames) {
      const fields = master.DiyFields.filter(row => row.TableId === source.Id && row.Name === name);
      assert.equal(fields.length, 1, definition.name + '/' + name);
      const field = structuredClone(fields[0]);
      const existing = pkg.DiyFields.filter(row => row.TableId === table.Id && row.Name === name);
      assert(existing.length <= 1, 'duplicate base field');
      assert(!pkg.DiyFields.some(row => row.Id === field.Id && row !== existing[0]), 'base field identity collision');
      if (existing.length) pkg.DiyFields[pkg.DiyFields.indexOf(existing[0])] = field;
      else pkg.DiyFields.push(field);
    }
  }
  assert.equal(master.SysApiEngines.length, 1);
  const engine = master.SysApiEngines[0];
  assert.equal(engine.ApiEngineKey, 'mci-file-resource-manager');
  const code = fs.readFileSync(new URL('./engines/mci-file-resource-manager.js', import.meta.url), 'utf8');
  assert.equal(code, engine.ApiV8Code, 'canonical source must match the complete master export');
  const index = pkg.SysApiEngines.findIndex(row => row.ApiEngineKey === engine.ApiEngineKey);
  assert(index >= 0); assert.equal(pkg.SysApiEngines[index].Id, engine.Id);
  pkg.SysApiEngines[index] = structuredClone(engine);
  pkg.PackageInfo.FieldCount = pkg.DiyFields.length;
  return pkg;
}
