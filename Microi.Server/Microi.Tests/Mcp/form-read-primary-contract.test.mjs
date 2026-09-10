import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const before = process.env.TEST_FORM_READ_PRIMARY_SOURCE;
const read = file => fs.readFileSync(before ? path.join(before, file.replaceAll('/', '__')) : path.join(root, file), 'utf8');
const getFile = 'Microi.Server/Microi.net/FormEngine/FormEngineGet.cs';

// 这些是生产接线约束；七个真实 SQL 分支的行为另由 C# Roslyn 用例执行。
test('ReadPrimary 冷元数据固定主库，避免清缓存后用副本重建策略', () => {
  const core = read('Microi.Server/Microi.Core/FormEngine/FormEngine.cs');
  const method = core.slice(core.indexOf('public async Task<DosResult<dynamic>> GetDiyTable(string idOrName'));
  assert.match(method, /client\.Db\.From<DiyTable>\(\)/);
  assert.match(method, /client\.Db\.FromSql\(/);
  assert.doesNotMatch(method, /client\.DbRead|GetFormDataAsync<dynamic>/);
  const get = read(getFile);
  assert.match(get, /var dosOrmDbRead = OsClient\.GetClient\(param\.OsClient\)\.Db;/);
  const direct = get.slice(get.indexOf('public async Task<DosResult<dynamic>> GetDiyTableModel(DiyTableParam'));
  assert.match(direct, /var dosOrmDbRead = dbSession;/);
});

test('ReadPrimary 在可信扩展数据库解析后决策且不硬加入旧结构实体投影', () => {
  for (const file of [getFile, 'Microi.Server/Microi.net/FormEngine/FormEngineGetTableData.cs']) {
    const code = read(file);
    const selected = code.indexOf('FormEngineReadPolicy.SelectQuerySession(');
    assert.ok(selected > code.indexOf('dbSession = dbSessionDataBase.Db;'));
    assert.match(code.slice(selected, selected + 160), /\(object\)diyTableModel, dbSession, dbRead, _trans != null/);
  }
  // NULL/缺列通过 SELECT * 的动态元数据兼容；没有在全体旧库 SELECT 列表强塞新物理列。
  const entity = fs.readFileSync(path.join(root, 'Microi.Server/Microi.Core/Model/DiyTable.cs'), 'utf8');
  assert.doesNotMatch(entity, /ReadPrimary/);
});

test('ReadPrimary 三个原生配置写入口校验真实表名，MCP 同时验证物理列、字段定义与主库值', () => {
  assert.match(read('Microi.Server/Microi.net/FormEngine/FormEngineAdd.cs'), /FormEngineReadPolicy\.ValidateConfigurationWrite\(\(string\)diyTableModel\.Name, param\._FormData\)/);
  assert.equal((read('Microi.Server/Microi.net/FormEngine/FormEngineUpt.cs').match(/FormEngineReadPolicy\.ValidateConfigurationWrite\(\(string\)diyTableModel\.Name, param\._RowModel\)/g) || []).length, 2);
  const code = read('Microi.Server/Microi.Core/V8Engine/V8McpLogic.cs');
  const method = code.slice(code.indexOf('public static async Task<DosResult<object>> UpdateTable('), code.indexOf('#region RefreshSchemaCache'));
  assert.match(method, /patch = \(JObject\)patch\.DeepClone\(\)/);
  assert.match(method, /DiyTableHasColumn\(osClient, "ReadPrimary"\)/);
  assert.match(method, /f\.Name == "ReadPrimary"[\s\S]*?\.Count\(\) != 1/);
  assert.match(method, /persistedToken == null[\s\S]*?ParseReadPrimary\(persistedToken\) != requestedReadPrimary/);
  assert.match(method, /OsClientExtend\.GetClient\(osClient\)\.Db\.From<DiyTable>\(\)/);
});
