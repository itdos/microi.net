import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../Common/MongoLegacyCompatibilityTests.cs',import.meta.url),'utf8');
const runner=fs.readFileSync(new URL('../run-tests.ps1',import.meta.url),'utf8');

test('default Full requires the detected current Mongo endpoint and exact version',()=>{
  const required=runner.slice(runner.indexOf('$required = @('),runner.indexOf('$missing = @('));
  assert.match(required,/"MICROI_TEST_MONGO_CURRENT"/);
  assert.match(required,/"MICROI_TEST_MONGO_CURRENT_VERSION"/);
  assert.doesNotMatch(required,/"MICROI_TEST_MONGO_LEGACY"/);
  assert.match(source,/\[MemberData\(nameof\(MongoServers\)\)\]/);
  assert.doesNotMatch(source,/\[InlineData\("MICROI_TEST_MONGO_(?:LEGACY|CURRENT)"/);
});

test('Mongo version evidence uses exact buildInfo equality before any tenant write',()=>{
  assert.match(source,/RunCommandAsync<BsonDocument>\(new BsonDocument\("buildInfo", 1\)/);
  assert.match(source,/Assert\.Equal\(expectedVersion, version\["version"\]\.AsString\)/);
  assert.doesNotMatch(source,/Assert\.StartsWith\(expectedVersion/);
  assert.match(source,/output\.WriteLine\([^\r\n]+actual buildInfo version=/);
  assert.ok(source.indexOf('Assert.Equal(expectedVersion, version["version"].AsString)')<source.indexOf('var firstTenant ='));
});

test('explicit additional Mongo matrix keeps endpoint uniqueness and complete behavior assertions',()=>{
  assert.match(source,/endpoints\.Add\(host \+ ":" \+ server\.Port\)/);
  assert.match(source,/server\.Host\.Equals\("localhost", StringComparison\.OrdinalIgnoreCase\)/);
  assert.match(source,/CurrentMongoFixtureRequiresExactVersionAndRejectsDuplicateMatrixEndpoints/);
  for(const contract of [/Assert\.Equal\(46, await collection\.CountDocumentsAsync/,/Assert\.Equal\(45, seen\.Distinct\(\)\.Count\(\)\)/,
    /Assert\.DoesNotContain\("foreign", seen\)/,/Assert\.DoesNotContain\("unrelated", seen\)/,
    /collection\.UpdateOneAsync/,/collection\.DeleteOneAsync/,/ListCollectionNamesAsync/,/DropDatabaseAsync\("sys_log_" \+ tenant/])assert.match(source,contract);
});

test('real Mongo compatibility cleanup waits only owned nonce databases with an independent bounded token',()=>{
  const cleanup=source.slice(source.lastIndexOf('        finally'));
  assert.match(source,/var firstTenant = "compat_" \+ Guid\.NewGuid\(\)\.ToString\("N"\)/);
  assert.match(source,/var otherTenant = "compat_" \+ Guid\.NewGuid\(\)\.ToString\("N"\)/);
  assert.match(source,/output\.WriteLine\([^\r\n]+fixture namespaces:/);
  assert.match(cleanup,/new CancellationTokenSource\(TimeSpan\.FromSeconds\(15\)\)/);
  assert.match(cleanup,/await Task\.WhenAll\(new\[\] \{ firstTenant, otherTenant \}/);
  assert.match(cleanup,/DropDatabaseAsync\("sys_log_" \+ tenant, cleanup\.Token\)/);
  assert.doesNotMatch(cleanup,/TestContext\.Current\.CancellationToken|ListDatabase/);
});
