import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const workspace=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
test('公开仓门禁同时拒绝旧 Microi.VSCode、新 Microi.Code 和其余闭源根，正常公开提交可用',()=>{
 const parent=path.join(workspace,'.tmp/reports/microi-code/guard-tests');fs.mkdirSync(parent,{recursive:true});const repo=fs.mkdtempSync(path.join(parent,'repo-'));
 const git=(args,ok=true)=>{const r=spawnSync('git',args,{cwd:repo,encoding:'utf8',windowsHide:true});if(ok)assert.equal(r.status,0,r.stderr);return r;};
 git(['init','-q']);git(['config','user.name','Microi guard fixture']);git(['config','user.email','fixture@example.invalid']);git(['config','core.autocrlf','false']);git(['config','core.hooksPath','.githooks']);
 fs.mkdirSync(path.join(repo,'.githooks'));for(const name of ['pre-commit','pre-push'])fs.writeFileSync(path.join(repo,'.githooks',name),fs.readFileSync(path.join(workspace,'.githooks',name),'utf8').replaceAll('\r\n','\n'),{mode:0o755});
 fs.copyFileSync(path.join(workspace,'.public-repo-protected-paths'),path.join(repo,'.public-repo-protected-paths'));
 for(const [file,key] of [['pre-commit','preCommitOid'],['pre-push','prePushOid']])git(['config',`microi.publicGuard.${key}`,git(['hash-object',`.githooks/${file}`]).stdout.trim()]);
 fs.writeFileSync(path.join(repo,'public.txt'),'public fixture');git(['add','--','.githooks','.public-repo-protected-paths','public.txt']);git(['commit','-qm','public fixture baseline']);
 const protectedPaths=fs.readFileSync(path.join(repo,'.public-repo-protected-paths'),'utf8').split(/\r?\n/).filter(s=>s&&!s.startsWith('#'));
 assert.ok(protectedPaths.includes('Microi.VSCode'));assert.ok(protectedPaths.includes('Microi.Code'));assert.equal(protectedPaths.length,7);
 for(const dir of protectedPaths){const rel=dir+'/fixture.txt';fs.mkdirSync(path.dirname(path.join(repo,rel)),{recursive:true});fs.writeFileSync(path.join(repo,rel),'synthetic test data only');git(['add','--',rel]);const attempt=git(['commit','-qm','must reject private path'],false);assert.notEqual(attempt.status,0,dir);assert.match(attempt.stderr,/拒绝提交/);git(['rm','--cached','--',rel]);}
 const actual=spawnSync('git',['ls-files','--',...protectedPaths],{cwd:workspace,encoding:'utf8',windowsHide:true});assert.equal(actual.status,0);assert.equal(actual.stdout.trim(),'','Actual public root index must remain empty for private paths');
});
