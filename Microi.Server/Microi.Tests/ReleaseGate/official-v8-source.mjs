import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const emptyDatabaseEngineKey = 'admin_get_empty_database_sanitization_sql';

export function officialEmptyDatabaseSource(model) {
 assert.equal(model?.PackageInfo?.OsClient, 'iTdos', 'Expected the official iTdos package');
 assert.equal(model?.ResourcePolicies?.ApiEngines?.[emptyDatabaseEngineKey]?.UpgradePolicy,
  'Managed', 'The official package must own the sanitization engine');
 assert.ok(Array.isArray(model.SysApiEngines), 'Missing official engine collection');
 const engines = model.SysApiEngines.filter(engine => engine?.ApiEngineKey === emptyDatabaseEngineKey);
 assert.equal(engines.length, 1, 'Expected exactly one official sanitization engine');
 const source = engines[0].ApiV8Code;
 assert.ok(typeof source === 'string' && source.trim(), 'Missing official engine source');
 // Compile the function body without executing V8 or touching a tenant database.
 new Function('V8', source);
 return source;
}

export function readOfficialEmptyDatabaseSource(workspace) {
 return officialEmptyDatabaseSource(JSON.parse(fs.readFileSync(path.join(workspace,
  'Microi.Server/OfficialApplications/Resource/app.microi.saas-engine.json'), 'utf8')));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
 assert.equal(process.argv.length, 3, 'Usage: official-v8-source.mjs <workspace>');
 readOfficialEmptyDatabaseSource(path.resolve(process.argv[2]));
 console.log('Official managed empty-database engine ownership and syntax verified.');
}
