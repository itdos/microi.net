import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const resourceRoot = path.dirname(fileURLToPath(import.meta.url));
const packagePath = path.join(resourceRoot, 'app.microi.store.json');
const packageModel = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

const VERSION = 'v7.7.3';
const RELEASE_TIME = '2026-08-27 21:11:50';
const CHANGE_TITLE = '官网推荐应用字段交付闭环';
const CHANGE_CONTENT = '新增 sys_microistore.IsRecommend 的 DDL、物理列快照与低代码字段元数据，为官网推荐分类、推荐优先排序及超级管理员推荐操作提供可升级、可重放的应用商城基础结构。';
const TABLE_NAME = 'sys_microistore';
const TABLE_ID = '6cf254f1-edd0-4f04-96bc-c9ad08b5a2c1';
const FIELD_ID = '01KZZRMJQFG190K2B4DM6KYJX4';
const CAPABILITY = 'Schema:MarketplaceRecommendationV1';

function ensureCapability(target) {
  if (!Array.isArray(target)) return [CAPABILITY];
  if (!target.includes(CAPABILITY)) target.push(CAPABILITY);
  return target;
}

const columns = packageModel.PhysicalColumns || (packageModel.PhysicalColumns = []);
let physicalColumn = columns.find(item => item.TABLE_NAME === TABLE_NAME && item.COLUMN_NAME === 'IsRecommend');
if (!physicalColumn) {
  const maxOrdinal = columns
    .filter(item => item.TABLE_NAME === TABLE_NAME)
    .reduce((max, item) => Math.max(max, Number(item.ORDINAL_POSITION || 0)), 0);
  physicalColumn = {
    TABLE_NAME,
    COLUMN_NAME: 'IsRecommend',
    COLUMN_TYPE: 'int(11)',
    DATA_TYPE: 'int',
    IS_NULLABLE: 'YES',
    COLUMN_DEFAULT: '0',
    COLUMN_COMMENT: '是否推荐',
    COLUMN_KEY: '',
    EXTRA: '',
    ORDINAL_POSITION: maxOrdinal + 1,
  };
  columns.push(physicalColumn);
}

const fields = packageModel.DiyFields || (packageModel.DiyFields = []);
let field = fields.find(item => item.TableId === TABLE_ID && item.Name === 'IsRecommend');
if (!field) {
  const template = fields.find(item => item.TableId === TABLE_ID && item.Name === 'FavoriteCount') || {};
  field = {
    ...template,
    TableName: TABLE_NAME,
    AppVisible: 1,
    Type: 'int',
    Name: 'IsRecommend',
    InTableEdit: 1,
    Unique: 0,
    NameConfirm: 0,
    TableWidth: 90,
    Config: '',
    TableId: TABLE_ID,
    Readonly: 0,
    Encrypt: 0,
    BindRole: '[]',
    DefaultValue: '0',
    Component: 'Switch',
    Description: '官网 AI 应用列表“推荐”虚拟分类筛选开关；开启后该应用会出现在推荐分类中。',
    Visible: 1,
    IsLockField: 0,
    Data: '[]',
    Sort: 1350,
    NotEmpty: 0,
    Label: '是否推荐',
    Id: FIELD_ID,
    CreateTime: '2026-08-14 17:11:21',
  };
  fields.push(field);
}

const storeDdl = (packageModel.DDLStatements || []).find(item => item.TableName === TABLE_NAME);
if (!storeDdl) throw new Error('app.microi.store.json 缺少 sys_microistore DDL');
if (!/`IsRecommend`\s+int/i.test(storeDdl.DDL)) {
  const marker = "  `FavoriteCount` int NULL COMMENT '收藏量',";
  if (!storeDdl.DDL.includes(marker)) throw new Error('sys_microistore DDL 缺少 FavoriteCount 锚点');
  storeDdl.DDL = storeDdl.DDL.replace(
    marker,
    `${marker}\n  \`IsRecommend\` int NULL DEFAULT 0 COMMENT '是否推荐',`,
  );
}

const info = packageModel.PackageInfo || (packageModel.PackageInfo = {});
info.Version = VERSION;
info.CreateTime = '2026-08-27T13:11:50.000Z';
info.FieldCount = fields.length;
info.PhysicalColumnCount = columns.length;
info.ChangeLog = {
  Version: VERSION,
  Title: CHANGE_TITLE,
  ChangeType: 'Feature',
  Content: CHANGE_CONTENT,
  ReleaseTime: RELEASE_TIME,
};
const historyLine = `${RELEASE_TIME.slice(0, 10)} ${VERSION} ${CHANGE_CONTENT}`;
if (!String(info.ChangeHistory || '').split(/\r?\n/).includes(historyLine)) {
  info.ChangeHistory = `${historyLine}\n${String(info.ChangeHistory || '').trim()}`.trim();
}
info.RequiredPlatformCapabilities = ensureCapability(info.RequiredPlatformCapabilities);
info.Capabilities = ensureCapability(info.Capabilities);

fs.writeFileSync(packagePath, `${JSON.stringify(packageModel, null, 2)}\n`, 'utf8');
process.stdout.write(JSON.stringify({
  package: path.basename(packagePath),
  version: info.Version,
  fieldCount: info.FieldCount,
  physicalColumnCount: info.PhysicalColumnCount,
  fieldId: field.Id,
  capability: CAPABILITY,
}, null, 2));
process.stdout.write('\n');
