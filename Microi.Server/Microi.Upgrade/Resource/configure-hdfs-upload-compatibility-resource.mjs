import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {advanceOfficialPackageVersion} from './resource-sync-core.mjs';

export const legacyUploadVersions = {'app.microi.sys-config.json':'v6.4.7','app.microi.saas-engine.json':'v8.3.17'};
export const legacyUploadFieldName = 'CompatiblePlatformOldVersion';

// 字段与引擎 Id 来自官方 MCP 母版回读；只补本能力，不导出母租户设置值。
export function configureLegacyUpload(input, resourceName, field, engines) {
  const pkg = structuredClone(input);
  const table = pkg.DiyTables.find(row => row.Name.toLowerCase() === 'sys_config');
  assert.ok(table && field.TableId === table.Id && field.Name === legacyUploadFieldName);
  const projected = {};
  for (const key of ['Id','TableId','Name','Label','Type','Component','Tab','Sort','DefaultValue',
    'Visible','AppVisible','Readonly','NotEmpty','Unique','InTableEdit','Encrypt','TableWidth','Config','Description'])
    if (field[key] != null) projected[key] = field[key];
  projected.TableName = table.Name;
  const previous = pkg.DiyFields.find(row => row.TableId === table.Id && row.Name === field.Name);
  if (previous) Object.assign(previous, projected); else pkg.DiyFields.push(projected);
  if (!pkg.PhysicalColumns.some(row => row.TABLE_NAME.toLowerCase() === 'sys_config' && row.COLUMN_NAME === field.Name))
    pkg.PhysicalColumns.push({TABLE_NAME:'sys_config',COLUMN_NAME:field.Name,COLUMN_TYPE:'int',DATA_TYPE:'int',
      IS_NULLABLE:'YES',COLUMN_DEFAULT:null,COLUMN_COMMENT:field.Label,COLUMN_KEY:'',EXTRA:'',
      ORDINAL_POSITION:Math.max(...pkg.PhysicalColumns.filter(row=>row.TABLE_NAME.toLowerCase()==='sys_config').map(row=>Number(row.ORDINAL_POSITION)||0))+1});
  const ddl = pkg.DDLStatements.find(row => row.TableName.toLowerCase() === 'sys_config');
  assert.ok(ddl);
  if (!ddl.DDL.includes('`'+field.Name+'`')) {
    assert.ok(ddl.DDL.includes('`HdfsUploadRules`'));
    ddl.DDL = ddl.DDL.replace(/(  `HdfsUploadRules`[^\n]+\n)/, "$1  `CompatiblePlatformOldVersion` int NULL COMMENT '兼容平台旧版本',\n");
  }
  if (resourceName === 'app.microi.sys-config.json') {
    for (const key of ['platform-hdfs-upload','platform-hdfs-upload-hook']) {
      const source = engines.find(row => row.ApiEngineKey === key);
      assert.ok(source?.Id && source.ApiV8Code, '必须先回读官方上传接口');
      const engine = structuredClone(source);
      for (const property of ['TestParam','TestResult','AiCheckResult','ChangeHistoryRows']) delete engine[property];
      const current = pkg.SysApiEngines.find(row=>row.ApiEngineKey===key);
      if (current) Object.assign(current,engine); else pkg.SysApiEngines.push(engine);
      pkg.ResourcePolicies.ApiEngines[key] = {Ownership:key.endsWith('-hook')?'Tenant':'Platform',
        UpgradePolicy:key.endsWith('-hook')?'CreateIfMissing':'Managed'};
    }
    pkg.PackageInfo.RequiredPlatformCapabilities = [...new Set([...(pkg.PackageInfo.RequiredPlatformCapabilities||[]),
      'V8.Method.UploadCurrentRequestAsync','V8.Method.IsLegacyUploadCompatibilityEnabled'])];
  }
  pkg.PackageInfo.ServerMinVersion = '8.3.4';
  for (const set of pkg.DataSets||[]) if (String(set.TableName).toLowerCase()==='sys_config')
    assert.ok((set.Rows||[]).every(row=>!Object.hasOwn(row,field.Name)), '禁止覆盖租户兼容开关');
  const version=legacyUploadVersions[resourceName];assert.ok(version);
  if (pkg.PackageInfo.Version !== version) {
    pkg.PackageInfo.ChangeLog={...pkg.PackageInfo.ChangeLog,Version:pkg.PackageInfo.Version,
      Title:'旧版上传返回兼容与接口引擎扩展',ChangeType:'Feature',
      Content:'系统设置新增“兼容平台旧版本”，默认关闭；开启后上传保留新版字段并补充旧移动端小写字段。系统设置应用独立交付上传主接口及只补缺的返回扩展Hook；旧URL优先执行接口引擎，明确缺失时复用安全上传兜底。公私桶、鉴权、裁剪、配额与内容安全不变，安装不覆盖租户开关。需配套支持此功能的后端8.3.4 Docker更新。'};
    advanceOfficialPackageVersion(pkg.PackageInfo,version,'2026-09-11 09:00:00');
  }
  pkg.PackageInfo.FieldCount=pkg.DiyFields.length;
  pkg.PackageInfo.PhysicalColumnCount=pkg.PhysicalColumns.length;
  pkg.PackageInfo.ApiEngineCount=pkg.SysApiEngines.length;
  return pkg;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const master=process.argv[process.argv.indexOf('--master')+1];
  assert.ok(process.argv.includes('--write') && process.argv.includes('--master') && master,
    '先通过官方MCP回读母版，再传 --master <回读目录> --write');
  const field=JSON.parse(fs.readFileSync(master+'/official-field.json','utf8'))[0];
  const engines=JSON.parse(fs.readFileSync(master+'/official-engines.json','utf8'));
  for (const name of Object.keys(legacyUploadVersions)) {
    const file=new URL(name,import.meta.url);
    const before=JSON.parse(fs.readFileSync(file,'utf8'));
    const after=configureLegacyUpload(before,name,field,engines);
    fs.writeFileSync(file,JSON.stringify(after,null,2)+'\n');
    console.log(name+' '+after.PackageInfo.Version);
  }
}
