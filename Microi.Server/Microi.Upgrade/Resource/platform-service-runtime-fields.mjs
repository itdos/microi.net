import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// 官方母版已存在的 V3 投影列：随基础包交付物理列及表单元数据，不能只依赖启动补列。
export const platformServiceRuntimeFields = Object.freeze([
  { TableName: 'sys_microiservice', Id: '01KZYAH5GY5Z3GFEGFGW1WC9K4', Name: 'Description',
    Label: '微服务说明', Type: 'mediumtext', Component: 'Textarea', Sort: 620, FormWidth: 24,
    TableWidth: 220, Description: '前端微服务用途与发布说明；平台 v3 发布投影字段。' },
  { TableName: 'sys_microiservice_page', Id: '01KZYAHGRKGTEJJFQYAEC34YHF', Name: 'PageName',
    Label: '页面名称', Type: 'varchar(100)', Component: 'Text', Sort: 35, FormWidth: null,
    TableWidth: 140, Description: '微服务页面内部名称；平台 v3 路由投影字段。' },
]);
const key = value => String(value || '').toLowerCase();

export function ensurePlatformServiceRuntimeFields(model) {
  model.DiyFields ||= [];
  model.PhysicalColumns ||= [];
  for (const definition of platformServiceRuntimeFields) {
    const table = (model.DiyTables || []).find(item => key(item.Name) === key(definition.TableName));
    if (!table) throw new Error(`平台微服务包缺少表 ${definition.TableName}`);
    const existing = model.DiyFields.find(item => key(item.Name) === key(definition.Name)
      && (key(item.TableName) === key(table.Name) || key(item.TableId) === key(table.Id)));
    if (!existing) {
      // 按表名和字段名对齐，TableId 使用当前包的身份；普通文本字段不强制整行。
      model.DiyFields.push({ ...definition, TableId: table.Id, NotEmpty: 0, Visible: 1,
        AppVisible: 1, Readonly: 0, IsDeleted: 0, Tab: '', DefaultValue: '', Config: '', Data: '' });
    }
    const column = model.PhysicalColumns.find(item => key(item.TABLE_NAME) === key(table.Name)
      && key(item.COLUMN_NAME) === key(definition.Name));
    if (!column) {
      model.PhysicalColumns.push({ TABLE_NAME: table.Name, COLUMN_NAME: definition.Name,
        COLUMN_TYPE: definition.Type, DATA_TYPE: definition.Type.split('(')[0], IS_NULLABLE: 'YES',
        COLUMN_DEFAULT: null, COLUMN_COMMENT: definition.Name, COLUMN_KEY: '', EXTRA: '' });
    } else if (column.IS_NULLABLE !== 'YES') {
      throw new Error(`平台微服务普通字段必须允许 NULL: ${table.Name}.${definition.Name}`);
    }
    const ddl = (model.DDLStatements || []).find(item => key(item.TableName) === key(table.Name));
    if (!ddl || !String(ddl.DDL || '').includes('`' + definition.Name + '`')) {
      throw new Error(`平台微服务建表 DDL 缺少已发布投影列: ${table.Name}.${definition.Name}`);
    }
  }
  model.PackageInfo.FieldCount = model.DiyFields.length;
  model.PackageInfo.PhysicalColumnCount = model.PhysicalColumns.length;
  return model;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const name of ['app.microi.saas-engine.json', 'app.microi.store.json']) {
    const url = new URL(name, import.meta.url);
    const content = await readFile(url, 'utf8');
    const result = JSON.stringify(ensurePlatformServiceRuntimeFields(JSON.parse(content)), null, 2) + '\n';
    if (result !== content) await writeFile(url, result, 'utf8');
    console.log(`${name}: V3 投影元数据与物理列契约已对齐`);
  }
}
