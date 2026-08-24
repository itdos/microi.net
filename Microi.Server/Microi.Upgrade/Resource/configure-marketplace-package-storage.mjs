#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const packagePath = resolve(directory, 'app.microi.store.json');
const storeTableId = '6cf254f1-edd0-4f04-96bc-c9ad08b5a2c1';
const packageTableId = 'b5000100-0000-4000-8000-000000000100';
const createdAt = '2026-08-24 16:00:00';

const model = JSON.parse(await readFile(packagePath, 'utf8'));
model.DDLStatements ||= [];
model.DiyTables ||= [];
model.DiyFields ||= [];
model.SysApiEngines ||= [];
model.ResourcePolicies ||= {};
model.ResourcePolicies.ApiEngines ||= {};

function upsertBy(list, predicate, value) {
  const index = list.findIndex(predicate);
  if (index >= 0) list[index] = { ...list[index], ...value };
  else list.push(value);
}

function field({ id, tableId, tableName, name, label, type, component = 'Text', visible = 0, sort = 100, description = '' }) {
  return {
    Id: id,
    TableId: tableId,
    TableName: tableName,
    Name: name,
    Label: label,
    Type: type,
    Component: component,
    Visible: visible,
    AppVisible: 0,
    Sort: sort,
    FormWidth: component === 'Textarea' ? 24 : null,
    TableWidth: 160,
    Description: description,
    CreateTime: createdAt,
  };
}

const pointerFields = [
  ['b5000201-0000-4000-8000-000000000201', 'PackageId', '安装包对象Id', 'varchar(36)', 'Text', 5600],
  ['b5000202-0000-4000-8000-000000000202', 'PackageStorageMode', '安装包存储模式', 'varchar(32)', 'Select', 5610],
  ['b5000203-0000-4000-8000-000000000203', 'PackageHdfsPath', '安装包HDFS路径', 'varchar(1000)', 'Text', 5620],
  ['b5000204-0000-4000-8000-000000000204', 'PackageSha256', '安装包SHA-256', 'char(64)', 'Text', 5630],
  ['b5000205-0000-4000-8000-000000000205', 'PackageSize', '安装包字节数', 'bigint', 'NumberText', 5640],
  ['b5000206-0000-4000-8000-000000000206', 'PackageContentType', '安装包内容类型', 'varchar(100)', 'Text', 5650],
  ['b5000207-0000-4000-8000-000000000207', 'PackageFormatVersion', '安装包格式版本', 'int', 'NumberText', 5660],
  ['b5000208-0000-4000-8000-000000000208', 'PackageUploadedAt', '安装包校验时间', 'varchar(25)', 'DateTime', 5670],
];
for (const [id, name, label, type, component, sort] of pointerFields) {
  upsertBy(model.DiyFields, item => item.TableId === storeTableId && item.Name === name, field({
    id,
    tableId: storeTableId,
    tableName: 'sys_microistore',
    name,
    label,
    type,
    component,
    sort,
    description: '应用包正文存放在 HDFS；数据库和 mic_data_version 仅保留可回读校验的小型指针。',
  }));
}

const packageTable = {
  Id: packageTableId,
  Name: 'sys_microistore_package',
  Description: '应用商城不可变安装包对象索引',
  EnableDataLog: 1,
  EnableDataVersion: 0,
  EnableDataComment: 0,
  DisplayDefaultField: 0,
  IsTree: 0,
  Column: 2,
  FormOpenWidth: '80%',
  CreateTime: createdAt,
};
upsertBy(model.DiyTables, item => item.Id === packageTableId || item.Name === packageTable.Name, packageTable);

const packageFields = [
  ['b5000110-0000-4000-8000-000000000110', 'Id', 'Id', 'varchar(36)', 'Guid', 100],
  ['b5000111-0000-4000-8000-000000000111', 'CreateTime', '创建时间', 'datetime', 'DateTime', 200],
  ['b5000112-0000-4000-8000-000000000112', 'UpdateTime', '修改时间', 'datetime', 'DateTime', 300],
  ['b5000113-0000-4000-8000-000000000113', 'UserId', '创建人Id', 'varchar(36)', 'Guid', 400],
  ['b5000114-0000-4000-8000-000000000114', 'UserName', '创建人', 'varchar(255)', 'Text', 500],
  ['b5000115-0000-4000-8000-000000000115', 'IsDeleted', '是否已删除', 'int', 'Switch', 600],
  ['b5000116-0000-4000-8000-000000000116', 'OsClient', '租户标识', 'varchar(50)', 'Text', 700],
  ['b5000117-0000-4000-8000-000000000117', 'StoreId', '商城应用Id', 'varchar(50)', 'Text', 800],
  ['b5000118-0000-4000-8000-000000000118', 'AppVersion', '应用版本', 'varchar(50)', 'Text', 900],
  ['b5000119-0000-4000-8000-000000000119', 'StorageMode', '存储模式', 'varchar(32)', 'Select', 1000],
  ['b5000120-0000-4000-8000-000000000120', 'HdfsPath', 'HDFS路径', 'varchar(1000)', 'Text', 1100],
  ['b5000121-0000-4000-8000-000000000121', 'Sha256', 'SHA-256', 'char(64)', 'Text', 1200],
  ['b5000122-0000-4000-8000-000000000122', 'Size', '字节数', 'bigint', 'NumberText', 1300],
  ['b5000123-0000-4000-8000-000000000123', 'ContentType', '内容类型', 'varchar(100)', 'Text', 1400],
  ['b5000124-0000-4000-8000-000000000124', 'FormatVersion', '格式版本', 'int', 'NumberText', 1500],
  ['b5000125-0000-4000-8000-000000000125', 'Status', '校验状态', 'varchar(32)', 'Select', 1600],
  ['b5000126-0000-4000-8000-000000000126', 'VerifiedTime', '校验时间', 'varchar(25)', 'DateTime', 1700],
  ['b5000127-0000-4000-8000-000000000127', 'Remark', '备注', 'mediumtext', 'Textarea', 1800],
];
for (const [id, name, label, type, component, sort] of packageFields) {
  upsertBy(model.DiyFields, item => item.TableId === packageTableId && item.Name === name, field({
    id, tableId: packageTableId, tableName: packageTable.Name, name, label, type, component, sort,
    visible: ['StoreId', 'AppVersion', 'StorageMode', 'Sha256', 'Size', 'Status', 'VerifiedTime'].includes(name) ? 1 : 0,
  }));
}

const tableDdl = "CREATE TABLE IF NOT EXISTS `sys_microistore_package` (\n"
  + "  `Id` varchar(36) NOT NULL PRIMARY KEY,\n  `CreateTime` datetime NULL,\n  `UpdateTime` datetime NULL,\n"
  + "  `UserId` varchar(36) NULL,\n  `UserName` varchar(255) NULL,\n  `IsDeleted` int NULL DEFAULT 0,\n"
  + "  `OsClient` varchar(50) NOT NULL,\n  `StoreId` varchar(50) NOT NULL,\n  `AppVersion` varchar(50) NOT NULL,\n"
  + "  `StorageMode` varchar(32) NOT NULL,\n  `HdfsPath` varchar(1000) NOT NULL,\n  `Sha256` char(64) NOT NULL,\n"
  + "  `Size` bigint NOT NULL,\n  `ContentType` varchar(100) NULL,\n  `FormatVersion` int NOT NULL DEFAULT 2,\n"
  + "  `Status` varchar(32) NOT NULL DEFAULT 'Verified',\n  `VerifiedTime` varchar(25) NULL,\n  `Remark` mediumtext NULL,\n"
  + "  UNIQUE KEY `ux_microistore_package_content` (`OsClient`,`StoreId`,`Sha256`,`StorageMode`),\n"
  + "  KEY `ix_microistore_package_store_version` (`OsClient`,`StoreId`,`AppVersion`),\n"
  + "  KEY `ix_microistore_package_status` (`OsClient`,`Status`,`VerifiedTime`)\n"
  + ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";
upsertBy(model.DDLStatements, item => item.TableName === packageTable.Name, {
  TableName: packageTable.Name,
  TableId: packageTableId,
  DDL: tableDdl,
});

const storeDdl = model.DDLStatements.find(item => item.TableName === 'sys_microistore');
if (!storeDdl) throw new Error('app.microi.store.json 缺少 sys_microistore DDL');
if (!storeDdl.DDL.includes('`PackageStorageMode`')) {
  storeDdl.DDL = storeDdl.DDL.replace(
    '\n  `CommittedRuntimeManifestHash` char(64) NULL\n',
    '\n  `CommittedRuntimeManifestHash` char(64) NULL,\n'
      + '  `PackageId` varchar(36) NULL,\n'
      + '  `PackageStorageMode` varchar(32) NULL,\n'
      + '  `PackageHdfsPath` varchar(1000) NULL,\n'
      + '  `PackageSha256` char(64) NULL,\n'
      + '  `PackageSize` bigint NULL,\n'
      + '  `PackageContentType` varchar(100) NULL,\n'
      + '  `PackageFormatVersion` int NULL,\n'
      + '  `PackageUploadedAt` varchar(25) NULL\n',
  );
}

const engineFiles = [
  ['b5000001-0000-4000-8000-000000000001', 'microi-store-package-storage', 'microi-store-package-storage.js', 1],
  ['b5000002-0000-4000-8000-000000000002', 'compact-microi-store-packages', 'compact-microi-store-packages.js', 0],
];
for (const [id, key, fileName, stopHttp] of engineFiles) {
  const source = (await readFile(resolve(directory, fileName), 'utf8')).replace(/\r\n/g, '\n');
  const version = source.match(/Version:\s*(v?\d+\.\d+\.\d+)/i)?.[1] || 'v1.0.0';
  upsertBy(model.SysApiEngines, item => item.ApiEngineKey === key, {
    Id: id,
    Name: key === 'microi-store-package-storage' ? '应用商城包对象存储' : '应用商城包容量治理',
    ApiEngineKey: key,
    ApiAddress: `/apiengine/${key}`,
    ApiV8Code: source,
    Version: version,
    IsEnable: 1,
    StopHttp: stopHttp,
    AllowAnonymous: 0,
    V8Limit: 0,
    V8Unlimited: 1,
    CreateTime: createdAt,
  });
  model.ResourcePolicies.ApiEngines[key] = {
    UpgradePolicy: 'Managed',
    Owner: 'Platform',
    BaseVersion: version,
  };
}

const exporter = model.SysApiEngines.find(item => item.ApiEngineKey === 'export-microi-store-package');
if (!exporter) throw new Error('缺少 export-microi-store-package');
let exporterSource = String(exporter.ApiV8Code || '').replace(/\r\n/g, '\n');
exporterSource = exporterSource.replace(/Version:\s*v?\d+\.\d+\.\d+/i, 'Version: v1.2.3');
if (!exporterSource.includes('MARKETPLACE_HDFS_PACKAGE_PERSIST_V1')) {
  exporterSource = exporterSource.replace(
    "        var packageJson = JSON.stringify(packageData);\n        var updateResult = V8.FormEngine.UptFormData('sys_microistore', {",
    "        var packageJson = JSON.stringify(packageData);\n"
      + "        // MARKETPLACE_HDFS_PACKAGE_PERSIST_V1：包体先进入 HDFS 并完成大小/SHA-256 回读，\n"
      + "        // 当前行与 mic_data_version 只保存不可变小指针，避免每次版本快照复制数 MB JSON。\n"
      + "        var packageStorageResult = V8.ApiEngine.Run('microi-store-package-storage', {\n"
      + "            Action: 'Store', StoreId: PersistStoreId, AppVersion: exactPackageVersion, Package: packageJson\n"
      + "        });\n"
      + "        if (!packageStorageResult || packageStorageResult.Code != 1 || !packageStorageResult.Data) {\n"
      + "            throw new Error('持久化发布 HDFS 包失败：' + ((packageStorageResult && packageStorageResult.Msg) || '接口无返回'));\n"
      + "        }\n"
      + "        var packagePointer = packageStorageResult.Data;\n"
      + "        var updateResult = V8.FormEngine.UptFormData('sys_microistore', {",
  );
  exporterSource = exporterSource.replace(
    "            AppPakcet: packageJson,\n            Status: 'Published',",
    "            AppPakcet: '',\n"
      + "            PackageId: packagePointer.PackageId,\n"
      + "            PackageStorageMode: packagePointer.PackageStorageMode,\n"
      + "            PackageHdfsPath: packagePointer.PackageHdfsPath,\n"
      + "            PackageSha256: packagePointer.PackageSha256,\n"
      + "            PackageSize: packagePointer.PackageSize,\n"
      + "            PackageContentType: packagePointer.PackageContentType,\n"
      + "            PackageFormatVersion: packagePointer.PackageFormatVersion,\n"
      + "            PackageUploadedAt: packagePointer.PackageUploadedAt,\n"
      + "            Status: 'Published',",
  );
  exporterSource = exporterSource.replace(
    "            _SelectFields: ['Id', 'AppKey', 'AppVersion', 'Status', 'BuildStatus', 'AppPakcet']",
    "            _SelectFields: ['Id', 'AppKey', 'AppVersion', 'Status', 'BuildStatus', 'AppPakcet', 'PackageId', 'PackageStorageMode', 'PackageHdfsPath', 'PackageSha256', 'PackageSize']",
  );
  exporterSource = exporterSource.replace(
    "            || String(verifyRow.AppPakcet || '') != packageJson) {",
    "            || String(verifyRow.AppPakcet || '') != ''\n"
      + "            || String(verifyRow.PackageHdfsPath || '') != String(packagePointer.PackageHdfsPath || '')\n"
      + "            || String(verifyRow.PackageSha256 || '').toLowerCase() != String(packagePointer.PackageSha256 || '').toLowerCase()\n"
      + "            || Number(verifyRow.PackageSize || 0) != Number(packagePointer.PackageSize || 0)) {",
  );
  exporterSource = exporterSource.replace(
    "                PackageSha256: V8.EncryptHelper.Sha256Hex(packageJson),\n                PackageSize: packageJson.length,",
    "                PackageId: packagePointer.PackageId,\n"
      + "                PackageStorageMode: packagePointer.PackageStorageMode,\n"
      + "                PackageHdfsPath: packagePointer.PackageHdfsPath,\n"
      + "                PackageSha256: packagePointer.PackageSha256,\n"
      + "                PackageSize: packagePointer.PackageSize,",
  );
}
if (!exporterSource.includes('MARKETPLACE_HDFS_PACKAGE_PERSIST_V1')) {
  throw new Error('export-microi-store-package HDFS 持久化补丁未命中');
}
exporter.ApiV8Code = exporterSource;
exporter.Version = 'v1.2.3';
model.ResourcePolicies.ApiEngines['export-microi-store-package'] ||= {};
model.ResourcePolicies.ApiEngines['export-microi-store-package'].UpgradePolicy = 'Managed';
model.ResourcePolicies.ApiEngines['export-microi-store-package'].Owner = 'Platform';
model.ResourcePolicies.ApiEngines['export-microi-store-package'].BaseVersion = 'v1.2.3';

const capabilities = new Set((model.PackageInfo.Capabilities || []).filter(value => (
  !String(value).startsWith('ApiEngine:microi-store-package-storage@')
  && !String(value).startsWith('ApiEngine:compact-microi-store-packages@')
  && !String(value).startsWith('ApiEngine:export-microi-store-package@')
)));
for (const value of [
  'Marketplace:HdfsPackagePointerV2',
  'Marketplace:PackageCompactionV1',
  'ApiEngine:microi-store-package-storage@v1.0.8',
  'ApiEngine:compact-microi-store-packages@v1.1.2',
  'ApiEngine:export-microi-store-package@v1.2.3',
]) capabilities.add(value);
model.PackageInfo.Capabilities = [...capabilities];
model.PackageInfo.RequiredPlatformCapabilities = [
  ...(model.PackageInfo.RequiredPlatformCapabilities || []).filter(value => (
    !String(value).startsWith('ApiEngine:get-microi-store-model@')
    && !String(value).startsWith('ApiEngine:ai_app_publish_store@')
    && !String(value).startsWith('ApiEngine:export-microi-store-package@')
    && !String(value).startsWith('ApiEngine:import-microi-store-package@')
  )),
  'ApiEngine:get-microi-store-model@v1.2.8',
  'ApiEngine:ai_app_publish_store@v1.9.7',
  'ApiEngine:export-microi-store-package@v1.2.3',
  'ApiEngine:import-microi-store-package@v2.4.2',
];
model.PackageInfo.TableCount = model.DiyTables.length;
model.PackageInfo.FieldCount = model.DiyFields.length;
model.PackageInfo.DDLCount = model.DDLStatements.length;
model.PackageInfo.PhysicalColumnCount = (model.PhysicalColumns || []).length;

model.PackageInfo.Version = 'v7.5.47';
model.PackageInfo.ChangeLog = {
  Version: 'v7.5.47',
  Title: '历史包扫描窗口与完成判定一致性修复',
  ChangeType: 'Fix',
  Content: '历史容量治理的 Jint 安全扫描窗口与完成判定统一为最多 100 条，修复请求 ScanSize 大于物理查询上限时把首批 100 条误判为全表完成；继续支持早期非标准版本包、Id 游标续跑、强回读和 CAS。',
  ReleaseTime: '2026-08-24 17:30:00',
};
const storageHistoryLine = '2026-08-24 v7.5.47 修复历史扫描窗口与完成判定不一致造成的首批 100 条假完成；保留旧版本兼容、强回读与 CAS。';
const oldHistoryLines = String(model.PackageInfo.ChangeHistory || '')
  .split(/\r?\n/)
  .filter(line => line && line !== storageHistoryLine && !/^2026-08-24 v7\.5\.(42|44) 应用包改为 HDFS 内容寻址存储/.test(line));
model.PackageInfo.ChangeHistory = [storageHistoryLine, ...oldHistoryLines].join('\n') + '\n';

await writeFile(packagePath, `${JSON.stringify(model, null, 2)}\n`, 'utf8');
console.log(`${packagePath}\t${model.PackageInfo.Version}\tHDFS package pointer configured`);
