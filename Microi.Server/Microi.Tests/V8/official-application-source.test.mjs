import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {verifyOfficialApplicationSource,verifyOfficialRepositorySource} from './official-application-source.mjs';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function fixture(){const workspace=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'microi-source-contract-')));const root=path.join(workspace,'source');fs.mkdirSync(root);fs.writeFileSync(path.join(root,'source.js'),'export const fixture=1;\n');const bytes=fs.readFileSync(path.join(root,'source.js')),f={Path:'source.js',Size:bytes.length,Sha256:sha(bytes)};const app={AppKey:'official-fixture',SourceRoot:'source',FileCount:1,Files:[f],SourceBytes:f.Size,SourceManifestHash:sha(f.Path+'\t'+f.Sha256+'\t'+f.Size)};return {workspace,root,contract:{SchemaVersion:1,Origin:{ApiBase:'https://api.itdos.com',OsClient:'iTdos'},Applications:[app]},app};}
function run(fn){const f=fixture();try{fn(f);}finally{fs.rmSync(f.workspace,{recursive:true,force:true});}}

function testOverlay(f){
 const base=JSON.stringify({name:'fixture',scripts:{build:'fixture-build'},dependencies:{fixture:'1.0.0'}},null,2)+'\n';
 fs.writeFileSync(path.join(f.root,'package.json'),base);const testPath='tests/engine.test.mjs';fs.mkdirSync(path.join(f.root,'tests'));fs.writeFileSync(path.join(f.root,testPath),'export const testFixture=1;\n');
 f.app.Files=['package.json',testPath].map(Path=>{const bytes=fs.readFileSync(path.join(f.root,Path));return {Path,Size:bytes.length,Sha256:sha(bytes)};});f.app.FileCount=2;
 f.app.SourceBytes=f.app.Files.reduce((n,x)=>n+x.Size,0);f.app.SourceManifestHash=sha(f.app.Files.map(x=>x.Path+'\t'+x.Sha256+'\t'+x.Size).sort().join('\n'));
 const model=JSON.parse(base),command='node --test --test-concurrency=1 tests';model.scripts.test=command;const local=JSON.stringify(model,null,2)+'\n';fs.writeFileSync(path.join(f.root,'package.json'),local);
 f.app.LocalTestOverlay={SchemaVersion:1,Path:'package.json',Field:'scripts.test',Value:command,BaseContent:base,BaseSize:Buffer.byteLength(base),BaseSha256:sha(base),LocalSize:Buffer.byteLength(local),LocalSha256:sha(local),TestFiles:[testPath]};
 refreshOverlay(f);return f.app.LocalTestOverlay;
}
function refreshOverlay(f){const o=f.app.LocalTestOverlay,bytes=fs.readFileSync(path.join(f.root,o.Path));o.LocalSize=bytes.length;o.LocalSha256=sha(bytes);const rows=f.app.Files.map(x=>x.Path===o.Path?{...x,Size:o.LocalSize,Sha256:o.LocalSha256}:x);o.LocalSourceBytes=rows.reduce((n,x)=>n+x.Size,0);o.LocalSourceManifestHash=sha(rows.map(x=>x.Path+'\t'+x.Sha256+'\t'+x.Size).sort().join('\n'));}
test('声明的唯一官方根完整大小、内容与 MCP 清单哈希全部一致才能执行',()=>run(f=>assert.equal(verifyOfficialApplicationSource(f.contract,'official-fixture',f.workspace),f.root)));
test('源码正文被修改时拒绝执行原官方测试',()=>run(f=>{fs.writeFileSync(path.join(f.root,'source.js'),'export const fixture=2;\n');assert.throws(()=>verifyOfficialApplicationSource(f.contract,'official-fixture',f.workspace),/Source SHA differs/);}));
test('完整源码清单中的非测试文件缺失仍然拒绝',()=>run(f=>{fs.rmSync(path.join(f.root,'source.js'));assert.throws(()=>verifyOfficialApplicationSource(f.contract,'official-fixture',f.workspace),/ENOENT/);}));
test('重复所有者或大小写重复文件不能成为唯一源码根',()=>run(f=>{f.contract.Applications.push({...f.app});assert.throws(()=>verifyOfficialApplicationSource(f.contract,'official-fixture',f.workspace),/one owner/);f.contract.Applications.pop();f.app.Files.push({...f.app.Files[0],Path:'SOURCE.js'});f.app.FileCount=2;assert.throws(()=>verifyOfficialApplicationSource(f.contract,'official-fixture',f.workspace),/Duplicate source file/);}));
test('源路径越界和文件符号链接拒绝',()=>run(f=>{f.app.SourceRoot='../source';assert.throws(()=>verifyOfficialApplicationSource(f.contract,'official-fixture',f.workspace),/Unsafe source root/);f.app.SourceRoot='source';const target=path.join(f.workspace,'actual.js');fs.renameSync(path.join(f.root,'source.js'),target);fs.symlinkSync(target,path.join(f.root,'source.js'));assert.throws(()=>verifyOfficialApplicationSource(f.contract,'official-fixture',f.workspace),/symlink/);}));
test('伪造租户、丢失声明和整体 manifest 变更均拒绝',()=>run(f=>{f.contract.Origin.OsClient='foreign';assert.throws(()=>verifyOfficialApplicationSource(f.contract,'official-fixture',f.workspace));f.contract.Origin.OsClient='iTdos';assert.throws(()=>verifyOfficialApplicationSource(f.contract,'missing',f.workspace),/one owner/);f.app.SourceManifestHash='0'.repeat(64);assert.throws(()=>verifyOfficialApplicationSource(f.contract,'official-fixture',f.workspace),/manifest differs/);}));

test('真实远端摘要保留，唯一scripts.test增补与完整本地摘要同时严格一致',()=>run(f=>{const o=testOverlay(f),upstream=f.app.SourceManifestHash;assert.equal(verifyOfficialApplicationSource(f.contract,'official-fixture',f.workspace),f.root);assert.equal(f.app.SourceManifestHash,upstream);assert.notEqual(o.LocalSourceManifestHash,upstream);}));
test('测试覆盖层不能伴随依赖或业务字段变化，即使重算本地摘要也拒绝',()=>run(f=>{testOverlay(f);const file=path.join(f.root,'package.json'),model=JSON.parse(fs.readFileSync(file,'utf8'));model.dependencies.fixture='2.0.0';fs.writeFileSync(file,JSON.stringify(model,null,2)+'\n');refreshOverlay(f);assert.throws(()=>verifyOfficialApplicationSource(f.contract,'official-fixture',f.workspace),/only scripts.test/);}));
test('替换上游正文、命令或本地SHA都不能冒充测试增补',()=>run(f=>{const o=testOverlay(f),base=o.BaseContent;o.BaseContent=base.replace('fixture-build','changed-build');assert.throws(()=>verifyOfficialApplicationSource(f.contract,'official-fixture',f.workspace),/Overlay base/);o.BaseContent=base;o.Value='node arbitrary.js';assert.throws(()=>verifyOfficialApplicationSource(f.contract,'official-fixture',f.workspace),/audited runner/);o.Value='node --test --test-concurrency=1 tests';o.LocalSha256='0'.repeat(64);assert.throws(()=>verifyOfficialApplicationSource(f.contract,'official-fixture',f.workspace),/Source SHA differs/);}));
test('测试脚本必须完整绑定存在的官方测试文件，不接受空清单或缺失',()=>run(f=>{const o=testOverlay(f);o.TestFiles=[];assert.throws(()=>verifyOfficialApplicationSource(f.contract,'official-fixture',f.workspace),/all declared test files/);o.TestFiles=['tests/engine.test.mjs'];fs.rmSync(path.join(f.root,o.TestFiles[0]));assert.throws(()=>verifyOfficialApplicationSource(f.contract,'official-fixture',f.workspace),/ENOENT/);}));
test('独立官方仓正文全量闭包和真实 Git HEAD 同时一致，换 HEAD 或来源均拒绝',()=>run(f=>{
 const git=args=>execFileSync('git',['-C',f.root,...args],{encoding:'utf8',windowsHide:true,timeout:10000});git(['init','-q']);git(['add','source.js']);git(['-c','user.name=Microi Test Fixture','-c','user.email=fixture@example.invalid','commit','-qm','test fixture']);
 const source={...f.app,RepositoryKey:'microi.openclaw',RepositoryUrl:'https://gitee.com/microi-net/microi.openclaw.git',GitCommit:git(['rev-parse','HEAD']).trim()};f.contract.Repositories=[source];
 assert.equal(verifyOfficialRepositorySource(f.contract,'microi.openclaw',f.workspace),f.root);source.GitCommit='0'.repeat(40);assert.throws(()=>verifyOfficialRepositorySource(f.contract,'microi.openclaw',f.workspace),/HEAD differs/);source.RepositoryUrl='https://example.invalid/openclaw.git';assert.throws(()=>verifyOfficialRepositorySource(f.contract,'microi.openclaw',f.workspace));
}));
