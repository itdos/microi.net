import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('系统日志包可独立安装关键事故表、UTC 查询索引且不携带事故数据',()=>{
 const p=JSON.parse(fs.readFileSync(path.join(import.meta.dirname,'app.microi.sys-log.json'),'utf8'));
 const table=p.DiyTables.filter(t=>t.Name==='mci_runtime_incident');assert.equal(table.length,1);
 const fields=p.DiyFields.filter(f=>f.TableId===table[0].Id);
 for(const name of ['Tenant','IncidentId','OccurredAtUtc','UpdatedVersion','Payload','Summary'])assert.ok(fields.some(f=>f.Name===name),name);
 const ddl=p.DDLStatements.filter(x=>x.TableName===table[0].Name).map(x=>x.DDL).join('\n');
 assert.match(ddl,/CREATE TABLE IF NOT EXISTS `mci_runtime_incident`/);
 assert.match(ddl,/CREATE INDEX `idx_runtime_incident_tenant_time` ON `mci_runtime_incident` \(`Tenant`,`OccurredAtUtc`,`Id`\)/);
 for(const name of ['Payload','Summary'])assert.ok(p.PhysicalColumns.some(x=>x.TABLE_NAME===table[0].Name&&x.COLUMN_NAME===name&&x.DATA_TYPE==='mediumtext'));
 assert.ok(!(p.DataSets||[]).some(x=>(x.TableName||x.Name)===table[0].Name),'事故数据不得进入安装包');
 assert.ok(p.ApplicationBundles.some(x=>x.Application?.AppKey==='microi-platform-service'));
});
