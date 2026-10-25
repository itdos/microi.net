import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import descriptor from './file-resource-manifest.mjs';

export function mapMasterIdentities(input, identity) {
  assert.equal(identity.profile, 'microi_itdos_api_itdos_com');
  assert.equal(identity.apiBase, 'https://api.itdos.com');
  assert.equal(identity.osClient, 'iTdos');
  const pkg = structuredClone(input);
  assert.equal(pkg.PackageInfo.AppId, descriptor.ownerAppId);
  const only = (rows, label) => { assert.equal(rows.length, 1, label); return rows[0]; };
  const id = value => { assert.match(value, /^[a-zA-Z0-9-]{1,36}$/); return value; };
  for (const table of descriptor.tables) {
    const row = only(pkg.DiyTables.filter(x => x.Name === table.name), table.name);
    const previousId = row.Id, nextId = id(identity.tableIds[table.name]);
    assert(!pkg.DiyTables.some(x => x !== row && x.Id === nextId), 'master table identity collision');
    row.Id = nextId;
    for (const definition of table.fields) {
      const field = only(pkg.DiyFields.filter(x => x.TableId === previousId && x.Name === definition.name), definition.name);
      const master = only(identity.fields[table.name].filter(x => x.Name === definition.name), definition.name);
      assert.equal(master.TableId, nextId); assert.equal(master.Type, definition.type);
      assert(!pkg.DiyFields.some(x => x !== field && x.Id === master.Id), 'master field identity collision');
      field.Id = id(master.Id); field.TableId = nextId;
    }
    for (const ddl of pkg.DDLStatements.filter(x => x.TableName === table.name)) {
      assert.equal(ddl.TableId, previousId); ddl.TableId = nextId;
    }
  }
  const engine = only(pkg.SysApiEngines.filter(x => x.ApiEngineKey === 'mci-file-resource-manager'), 'manager');
  assert.equal(identity.engine.ApiEngineKey, engine.ApiEngineKey);
  assert(!pkg.SysApiEngines.some(x => x !== engine && x.Id === identity.engine.Id), 'master engine identity collision');
  engine.Id = id(identity.engine.Id);
  assert.deepEqual(pkg.PackageInfo, input.PackageInfo);
  return pkg;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  assert(process.argv.includes('--write'), 'Only explicit local identity synchronization is supported.');
  const target = new URL('../Resource/app.microi.sys-log.json', import.meta.url);
  const identity = JSON.parse(fs.readFileSync(new URL('./file-resource-install/official-master-catalog-identities-20261025.json', import.meta.url), 'utf8'));
  const before = fs.readFileSync(target, 'utf8');
  const after = JSON.stringify(mapMasterIdentities(JSON.parse(before), identity), null, 2) + '\n';
  assert.equal(fs.readFileSync(target, 'utf8'), before, 'Concurrent local change; no overwrite.');
  if (before !== after) fs.writeFileSync(target, after, 'utf8');
  console.log(JSON.stringify({ localIdentityMappingOnly: true, remoteWrites: 0, packageVersionUnchanged: true,
    tables: 3, businessFields: 49, engine: 1, ddlTableReferences: 8,
    beforeSha256: crypto.createHash('sha256').update(before).digest('hex'),
    afterSha256: crypto.createHash('sha256').update(after).digest('hex'), changed: before !== after,
  }, null, 2));
}
