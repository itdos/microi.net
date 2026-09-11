import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {validateOfficialPackageInstallContracts} from './resource-sync-core.mjs';

const packageModel=JSON.parse(await readFile(new URL('./app.microi.store.json',import.meta.url),'utf8'));
const generator=await readFile(new URL('./configure-marketplace-changelog-resource.mjs',import.meta.url),'utf8');
const tableName='sys_microistore_changelog';
const businessFields=['OsClient','StoreId','Version','Title','ChangeType','Content','ReleaseTime'];
const columns=model=>model.PhysicalColumns.filter(column=>column.TABLE_NAME===tableName);

test('更新日志普通列允许历史NULL，表单必填、主键和租户唯一索引保留',()=>{
 const table=packageModel.DiyTables.find(row=>row.Name===tableName),schema=columns(packageModel);
 const ddl=packageModel.DDLStatements.find(row=>row.TableName===tableName).DDL;
 assert.equal(schema.find(column=>column.COLUMN_NAME==='Id').IS_NULLABLE,'NO');
 assert.match(ddl,/Id varchar\(36\) NOT NULL PRIMARY KEY/);
 for(const name of businessFields){
  assert.equal(schema.find(column=>column.COLUMN_NAME===name).IS_NULLABLE,'YES',name);
  assert.match(ddl,new RegExp('\\b'+name+' [^\\n]+? NULL(?: DEFAULT| COMMENT)'));
  assert.equal(packageModel.DiyFields.find(field=>field.TableId===table.Id&&field.Name===name).NotEmpty,1,name+' 必填校验');
 }
 assert.match(ddl,/UNIQUE KEY ux_microistore_changelog_store_version \(OsClient, StoreId, Version\)/);
 assert.match(ddl,/KEY ix_microistore_changelog_store_release \(OsClient, StoreId, ReleaseTime\)/);
 assert.equal(schema.find(column=>column.COLUMN_NAME==='ReleaseTime').COLUMN_DEFAULT,null);
 assert.equal(schema.find(column=>column.COLUMN_NAME==='ChangeType').COLUMN_DEFAULT,'Feature');
 assert.equal(schema.find(column=>column.COLUMN_NAME==='Sort').COLUMN_DEFAULT,'100');
 assert.equal(schema.find(column=>column.COLUMN_NAME==='OsClient').BACKFILL_VALUE_SOURCE,undefined);
 assert.doesNotThrow(()=>validateOfficialPackageInstallContracts('app.microi.store.json',JSON.stringify(packageModel)));
});

test('重跑日志结构生成器保持nullable，且不改业务记录或其它表',()=>{
 const functionSource=generator.slice(generator.indexOf('function configureSchema('),generator.indexOf('function updatePackageInfo('));
 assert.ok(functionSource.startsWith('function configureSchema('));
 const otherColumn={TABLE_NAME:'other_table',COLUMN_NAME:'Version',IS_NULLABLE:'NO'},otherDdl={TableName:'other_table',DDL:'unchanged'};
 const fixture={model:{PhysicalColumns:[otherColumn],DDLStatements:[otherDdl],DataSets:[{TableName:tableName,Rows:[{ReleaseTime:null}]}]},changelogTableId:'schema-test',replaceByIdentity(items,row,keys){const i=items.findIndex(item=>keys.some(key=>item[key]===row[key]));if(i<0)items.push(row);else items[i]=row;}};
 vm.runInNewContext(functionSource+'\nconfigureSchema(model);',fixture);
 for(const name of businessFields)assert.equal(columns(fixture.model).find(column=>column.COLUMN_NAME===name).IS_NULLABLE,'YES',name);
 assert.equal(columns(fixture.model).find(column=>column.COLUMN_NAME==='OsClient').BACKFILL_VALUE_SOURCE,undefined);
 const first=JSON.stringify(fixture.model);vm.runInNewContext('configureSchema(model);',fixture);assert.equal(JSON.stringify(fixture.model),first);
 assert.equal(fixture.model.PhysicalColumns[0],otherColumn);assert.equal(fixture.model.DDLStatements[0],otherDdl);assert.equal(fixture.model.DataSets[0].Rows[0].ReleaseTime,null);
});

test('旧安装器消费新日志列合同不回填NULL或制造历史发布时间',()=>{
 // 只执行包自带的既有收紧检查；NULL源值不应触发任何查询/UPDATE，更不能靠删历史使升级通过。
 const importer=packageModel.SysApiEngines.find(engine=>engine.ApiEngineKey==='import-microi-store-package').ApiV8Code;
 const helper=importer.match(/var prepareNotNullColumnData = function \(tableName, columnName, sourceColumn, targetColumn\) \{[\s\S]*?\n    \};/);
 assert.ok(helper,'安装器非空兼容检查必须存在');
 const fixture={runtimeIsSqlServer:false,isSafeIdentifier:()=>true,getPhysicalValue(row,names){return names.map(name=>row[name]).find(value=>value!==undefined);},V8:{Db:{FromSql(){throw Error('禁止回填或查询普通NULL字段');}}}};
 vm.runInNewContext(helper[0],fixture);
 for(const column of columns(packageModel).filter(row=>businessFields.includes(row.COLUMN_NAME)))assert.equal(fixture.prepareNotNullColumnData(tableName,column.COLUMN_NAME,column,{IS_NULLABLE:'YES'}),0,column.COLUMN_NAME);
});
