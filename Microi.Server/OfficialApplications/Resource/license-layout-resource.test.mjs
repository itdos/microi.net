import assert from 'node:assert/strict';import fs from 'node:fs';import test from 'node:test';
import {validateOfficialPackageInstallContracts}from './resource-sync-core.mjs';
import {normalizeLicenseLayoutResource}from './configure-license-layout-resource.mjs';
const current=()=>JSON.parse(fs.readFileSync(new URL('./app.microi.saas-engine.json',import.meta.url),'utf8'));
const layout=m=>m.DiyFields.find(f=>f.Name==='ShouquanRZ');
const ddl=m=>m.DDLStatements.find(d=>d.TableName==='diy_license'&&/^CREATE TABLE/i.test(d.DDL));
const phantom=()=>{const m=current();if(!ddl(m).DDL.includes('`ShouquanRZ`'))ddl(m).DDL=ddl(m).DDL.replace("  `Remark`", "  `ShouquanRZ` varchar(255) NULL COMMENT '授权日志',\n  `Remark`");return m;};
test('SaaS publication rejects a nonstored license-log TableChild fabricated as a physical DDL column',()=>{
 const m=phantom();assert.equal(layout(m).Component,'TableChild');assert.ok(!layout(m).Type);assert.ok(!m.PhysicalColumns.some(c=>c.TABLE_NAME==='diy_license'&&c.COLUMN_NAME==='ShouquanRZ'));
 assert.throws(()=>validateOfficialPackageInstallContracts('app.microi.saas-engine.json',JSON.stringify(m)),/diy_license.ShouquanRZ/);
});
test('known historical license layout correction changes only the fabricated DDL line and is repeatable',()=>{
 const m=phantom(),before=structuredClone(m),sql=ddl(m).DDL;
 const actual=normalizeLicenseLayoutResource(m);assert.equal(actual,m);
 assert.equal(ddl(m).DDL,sql.split('\n').filter(line=>!line.trimStart().startsWith('`ShouquanRZ`')).join('\n'));
 before.DDLStatements.find(d=>d.TableName==='diy_license').DDL=ddl(m).DDL;assert.deepEqual(m,before);
 const once=structuredClone(m);normalizeLicenseLayoutResource(m);assert.deepEqual(m,once);
 assert.doesNotThrow(()=>validateOfficialPackageInstallContracts('app.microi.saas-engine.json',JSON.stringify(m)));
});
test('existing custom same-name physical columns and typed fields retain all DDL and data',()=>{
 for(const physical of [true,false]){const m=phantom();
  if(physical)m.PhysicalColumns.push({TABLE_NAME:'diy_license',COLUMN_NAME:'ShouquanRZ',COLUMN_TYPE:'varchar(255)'});else layout(m).Type='varchar(255)';
  m.DataSets.push({TableName:'diy_license',Rows:[{Id:'kept',ShouquanRZ:'legacy value'}]});const before=structuredClone(m);normalizeLicenseLayoutResource(m);assert.deepEqual(m,before);
 }
});
test('ambiguous physical closure or unexpected DDL cannot be silently normalized',()=>{
 for(const change of [m=>m.PhysicalColumns.push({...m.PhysicalColumns.find(c=>c.TABLE_NAME==='diy_license')}),m=>m.PhysicalColumns=m.PhysicalColumns.filter(c=>c.TABLE_NAME!=='diy_license'),m=>ddl(m).DDL=ddl(m).DDL.replace('`ShouquanRZ` varchar(255)','`ShouquanRZ` int')]){const m=phantom();change(m);const before=structuredClone(m);assert.throws(()=>normalizeLicenseLayoutResource(m));assert.deepEqual(m,before);}
});
