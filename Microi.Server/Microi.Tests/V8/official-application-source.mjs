import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const repo=fileURLToPath(new URL('../../../',import.meta.url));
const contractFile=fileURLToPath(new URL('./official-application-source-contract.json',import.meta.url));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const safeRelative=p=>typeof p==='string'&&p.length>0&&!p.includes('\\')&&!p.startsWith('/')&&!/^[A-Za-z]:/.test(p)&&p.split('/').every(x=>x&&x!=='.'&&x!=='..');

// One declared official source root. Every restored file must match the complete MCP readback.
export function verifyOfficialApplicationSource(contract,appKey,workspace=repo){
 assert.equal(contract.SchemaVersion,1);assert.equal(contract.Origin?.ApiBase,'https://api.itdos.com');assert.equal(contract.Origin?.OsClient,'iTdos');
 const matches=contract.Applications.filter(a=>a.AppKey===appKey);assert.equal(matches.length,1,'Official application source must have one owner');const app=matches[0];
 assert.ok(safeRelative(app.SourceRoot),'Unsafe source root');const workspaceReal=fs.realpathSync(workspace),root=path.resolve(workspaceReal,app.SourceRoot);assert.ok(root.startsWith(workspaceReal+path.sep),'Source root escapes workspace');assert.equal(fs.realpathSync(root),root,'Source root must not be a symlink');
 assert.equal(app.FileCount,app.Files.length);assert.ok(app.Files.length>0,'A complete official source cannot be empty');const seen=new Set(),rows=[];let total=0;
 for(const file of app.Files){assert.ok(safeRelative(file.Path),'Unsafe source file');assert.ok(!seen.has(file.Path.toLowerCase()),'Duplicate source file');seen.add(file.Path.toLowerCase());assert.match(file.Sha256,/^[a-f0-9]{64}$/);assert.ok(Number.isSafeInteger(file.Size)&&file.Size>=0);
  const target=path.join(root,file.Path);assert.equal(fs.realpathSync(target),target,'Source file must not traverse a symlink');assert.ok(fs.statSync(target).isFile());const bytes=fs.readFileSync(target);assert.equal(bytes.length,file.Size,`Source size differs: ${file.Path}`);assert.equal(sha(bytes),file.Sha256,`Source SHA differs: ${file.Path}`);rows.push(file.Path+'\t'+file.Sha256+'\t'+file.Size);total+=bytes.length;
 }
 rows.sort();assert.equal(total,app.SourceBytes);assert.equal(sha(rows.join('\n')),app.SourceManifestHash,'Complete source manifest differs');return root;
}

export function officialApplicationSource(appKey){return verifyOfficialApplicationSource(JSON.parse(fs.readFileSync(contractFile,'utf8')),appKey);}

export function verifyOfficialRepositorySource(contract,repositoryKey,workspace=repo){
 const matches=contract.Repositories?.filter(r=>r.RepositoryKey===repositoryKey)||[];assert.equal(matches.length,1,'Official repository must have one declared owner');const source=matches[0];
 assert.equal(source.RepositoryUrl,'https://gitee.com/microi-net/microi.openclaw.git');assert.match(source.GitCommit,/^[a-f0-9]{40}$/);
 const root=verifyOfficialApplicationSource({...contract,Applications:[{...source,AppKey:repositoryKey}]},repositoryKey,workspace);
 assert.equal(execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8',timeout:10000,windowsHide:true}).trim(),source.GitCommit,'Official repository HEAD differs from declared source');return root;
}

export function officialRepositorySource(repositoryKey){return verifyOfficialRepositorySource(JSON.parse(fs.readFileSync(contractFile,'utf8')),repositoryKey);}
