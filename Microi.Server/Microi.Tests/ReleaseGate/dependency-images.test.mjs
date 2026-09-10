import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {registryLocation,sourceByDigest} from '../../tools/dependency-images.mjs';
const manifest=JSON.parse(fs.readFileSync(new URL('../../tools/dependency-images.json',import.meta.url),'utf8'));
const root=new URL('../../../',import.meta.url);
test('mirrors use the release registry without exposing credentials or permitting path injection',()=>{
 assert.deepEqual(registryLocation({Region:'hangzhou',Namespace:'microios',Password:'private'}),{registry:'registry.cn-hangzhou.aliyuncs.com',namespace:'microios'});
 for(const config of [{Region:'https://evil',Namespace:'microios'},{Region:'hangzhou',Namespace:'../other'}])assert.throws(()=>registryLocation(config));
 assert.equal(sourceByDigest({source:'docker.io/library/postgres:17.6',digest:'sha256:abc'}),'docker.io/library/postgres@sha256:abc');
});
test('all installer and test dependencies have a declared mirror or explicit licensed-image boundary',()=>{
 assert.equal(new Set(manifest.images.map(x=>x.name)).size,manifest.images.length);
 for(const image of manifest.images){
  assert.match(image.name,/^[a-z0-9-]+:[A-Za-z0-9._-]+$/);
  if(!image.source.startsWith('registry.cn-hangzhou.aliyuncs.com/'))assert.match(image.digest,/^sha256:[a-f0-9]{64}$/);
 }
 assert.deepEqual(manifest.licensedImages,['MICROI_ORACLE_IMAGE_REF','MICROI_DM8_IMAGE_REF','MICROI_KINGBASE_IMAGE_REF']);
 const installer=fs.readFileSync(new URL('数据库、案例、文档、资料/install-microi.sh',root),'utf8');
 assert.doesNotMatch(installer,/DATABASE_IMAGE=.*(?:mcr\.microsoft\.com|:-postgres:)/);
 for(const name of ['mssql-server:2022-CU20-ubuntu-22.04','postgres:17.6'])assert.ok(installer.includes('microios/'+name));
});
test('release base images and mirror copies retain full upstream manifests',()=>{
 const source=fs.readFileSync(new URL('../../tools/dependency-images.mjs',import.meta.url),'utf8');
 assert.match(source,/--force-recursive/);assert.doesNotMatch(source,/['"]--platform['"]/);
 assert.match(source,/--pass-stdin/);assert.match(source,/expected!==digest/);
 const api=fs.readFileSync(new URL('Microi.Server/Microi.net.Api/bin/Release/Dockerfile',root),'utf8');
 assert.match(api,/microios\/dotnet-aspnet:10\.0/);assert.doesNotMatch(api,/FROM mcr\./);
 const release=fs.readFileSync(new URL('Microi一键编译发布.sh',root),'utf8');
 assert.match(release,/--mirror-dependencies/);assert.match(release,/MICROI_ASPNET_IMAGE=\$\{DOCKER_REGISTRY\}\/\$\{DOCKER_NAMESPACE\}/);
});
