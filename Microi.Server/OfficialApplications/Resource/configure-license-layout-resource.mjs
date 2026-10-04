import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// 授权日志是无 Type 的 TableChild。历史包误把布局名推断成 varchar；
// 正式母库的真实物理列保持不变，实际存在的租户同名物理列也不删除。
function licenseLayoutState(model) {
  const tables=(model.DiyTables||[]).filter(t=>String(t.Name||'').toLowerCase()==='diy_license');
  if(!tables.length)return null;
  if(tables.length!==1)throw Error('diy_license 表身份不唯一');
  const fields=(model.DiyFields||[]).filter(f=>f.TableId===tables[0].Id&&String(f.Name||'').toLowerCase()==='shouquanrz');
  if(fields.length!==1)throw Error('diy_license.ShouquanRZ 布局身份不唯一');
  const field=fields[0];
  if(field.Component!=='TableChild'||String(field.Type||'').trim())return null;
  const config=typeof field.Config==='string'?JSON.parse(field.Config):field.Config;
  if(!config?.TableChildTableId||!config.TableChildFkFieldName)throw Error('diy_license.ShouquanRZ 子表配置不完整');
  const columns=(model.PhysicalColumns||[]).filter(c=>String(c.TABLE_NAME||'').toLowerCase()==='diy_license');
  const keys=columns.map(c=>String(c.COLUMN_NAME||'').toLowerCase());
  if(!columns.length||!keys.includes('id')||new Set(keys).size!==keys.length)throw Error('diy_license 物理列闭包缺失或重复');
  if(keys.includes('shouquanrz'))return null;
  const statements=(model.DDLStatements||[]).filter(d=>String(d.TableName||'').toLowerCase()==='diy_license'&&/^\s*CREATE\s+TABLE\b/i.test(d.DDL||''));
  if(statements.length!==1)throw Error('diy_license 建表DDL身份不唯一');
  return {ddl:statements[0],field};
}

export function assertLicenseLayoutPhysicalClosure(model) {
  const state=licenseLayoutState(model);
  if(state&&/`shouquanrz`\s+[A-Za-z]/i.test(state.ddl.DDL))throw Error('diy_license.ShouquanRZ 是无 Type 的 TableChild，不得凭布局名虚构建表物理列');
}

export function normalizeLicenseLayoutResource(model) {
  const state=licenseLayoutState(model);
  if(!state)return model;
  const original=String(state.ddl.DDL);
  if(!/`shouquanrz`\s+[A-Za-z]/i.test(original))return model;
  const lines=original.split('\n');
  const matches=lines.filter(line=>/^\s*`shouquanrz`\s+varchar\(255\)\s+NULL(?:\s+COMMENT\s+'(?:[^']|'')*')?,\s*$/i.test(line));
  if(matches.length!==1)throw Error('diy_license.ShouquanRZ 历史错误DDL格式不确定，禁止自动更改');
  state.ddl.DDL=lines.filter(line=>line!==matches[0]).join('\n');
  assertLicenseLayoutPhysicalClosure(model);
  return model;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const root=path.dirname(fileURLToPath(import.meta.url));
  const file=path.join(root,'app.microi.saas-engine.json');
  const model=JSON.parse(fs.readFileSync(file,'utf8'));
  normalizeLicenseLayoutResource(model);
  fs.writeFileSync(file,JSON.stringify(model,null,2)+'\n');
  process.stdout.write(JSON.stringify({File:path.basename(file),Version:model.PackageInfo.Version,PhysicalColumnsPreserved:true,TableChildPreserved:true})+'\n');
}
