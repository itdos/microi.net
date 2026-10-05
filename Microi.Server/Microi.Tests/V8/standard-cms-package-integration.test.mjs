import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const centralPath=path.join(repo,'AI-Project','标准产品套件','source-contract.json');
const central=JSON.parse(fs.readFileSync(centralPath,'utf8')),app=central.applications.find(x=>x.appKey==='mci-cms');
assert.equal(central.schemaVersion,1);assert.equal(central.target.apiBase,'https://api.itdos.com');assert.equal(central.target.osClient,'iTdos');assert.ok(app);
const source=path.resolve(repo,central.sourceParent,app.appKey),relative=path.relative(repo,source);assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative));
const {buildArtifacts}=await import(pathToFileURL(path.join(source,'build-manifest.mjs')));
// 中央MCP/工作区集成断言继续保留在Full，下载的应用责任测试只依赖本包真实源码与发行需求快照。
test('CMS发行需求快照逐字节对应中央原文，包身份和可选依赖保持唯一源码契约',async()=>{
 const {loadCmsRequirements,cmsCanonicalFact}=await import(pathToFileURL(path.join(source,'requirements-provenance.mjs'))),owned=loadCmsRequirements(source),document=fs.readFileSync(path.join(repo,central.requirementsRoot,app.requirements)),a=buildArtifacts();
 assert.equal(Buffer.from(owned.Document).equals(document),true);assert.equal(owned.Provenance.Document.Sha256,crypto.createHash('sha256').update(document).digest('hex'));
 assert.equal(cmsCanonicalFact(owned.ApplicationEntry),cmsCanonicalFact(app));
 assert.deepEqual(a.requirements.map(x=>x.requirementId),[...document.toString('utf8').matchAll(/^\| (CMS-\d{3}) \|/gm)].map(x=>x[1]));
 assert.equal(a.contracts.packageKey,app.packageKey);assert.deepEqual(a.contracts.dependencies.required,app.dependencies);assert.deepEqual(a.contracts.dependencies.optional.map(x=>x.packageKey).sort(),app.optionalDependencies.slice().sort());
});
test('修复后的同源MCP规划器接受完整CMS Manifest和真实外键索引',async()=>{
 const {buildPlan}=await import(pathToFileURL(path.join(repo,'microi.mcp','dist','advanced-tools.js')));
 const result=buildPlan(buildArtifacts().manifest);assert.deepEqual(result.errors,[]);assert.ok(result.plan.some(x=>x.startsWith('create_table mci_cms_')));assert.equal(result.plan.filter(x=>x.startsWith('create_table ')).length,50);
});
