import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MISSING = Symbol('missing');
const identityFields = [
  'Id',
  'ApiEngineKey',
  'AppId',
  'Name',
  'Key',
  'Code',
  'TableId',
  'ModuleEngineKey',
  'DataSourceKey',
];

const readableResourceIdentities = {
  'import-package.js': 'import-microi-store-package',
  'ai-app-publish-store.js': 'ai_app_publish_store',
  'official-resource-api.js': 'ApiEngineKey: get-microi-upgrade-resource',
};

const readablePackageNames = {
  'app.microi.form-engine.json': '表单引擎',
  'app.microi.module-engine.json': '模块引擎',
  'app.microi.saas-engine.json': 'SaaS引擎',
  'app.microi.sso.json': 'SSO 身份联邦',
  'app.microi.store.json': '应用商城',
  'app.microi.sys_user.json': '系统账号',
  'app.microi.sys-config.json': '系统设置',
  'app.microi.message-notification.json': '消息通知',
  'app.microi.ai-engine.json': 'AI助手',
};

const exactCurrentHistoryPackageNames = new Set([
  'app.microi.form-engine.json',
  'app.microi.module-engine.json',
  'app.microi.saas-engine.json',
  'app.microi.sso.json',
]);

const platformServicePackageNames = new Set([
  'app.microi.saas-engine.json',
  'app.microi.store.json',
]);

export function normalizeText(content) {
  return `${String(content ?? '').replace(/\r\n?/g, '\n').replace(/\n*$/g, '')}\n`;
}

export function canonicalizeResource(name, content) {
  const normalized = normalizeText(content);
  if (!name.endsWith('.json')) return normalized;
  return `${JSON.stringify(JSON.parse(normalized), null, 2)}\n`;
}

export function hasExactResourceContentDrift(content, reportedSha256) {
  const expected = String(reportedSha256 || '').trim().toLowerCase();
  if (!expected) return false;
  const actual = createHash('sha256').update(String(content ?? ''), 'utf8').digest('hex');
  return actual !== expected;
}

function semanticVersionParts(value, label, allowEmpty = false) {
  const text = String(value || '').trim();
  if (!text && allowEmpty) return [0, 0, 0];
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/i.exec(text);
  if (!match) throw new Error(`${label}必须是 vX.Y.Z 语义版本，当前为 ${text || '(空)'}`);
  return match.slice(1).map(Number);
}

function compareSemanticVersionParts(left, right) {
  for (let index = 0; index < 3; index += 1) {
    const delta = Number(left[index] || 0) - Number(right[index] || 0);
    if (delta) return delta;
  }
  return 0;
}

function canonicalChangeHistoryRecords(changeHistory) {
  if (typeof changeHistory === 'string') {
    return changeHistory
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);
  }
  const records = Array.isArray(changeHistory)
    ? changeHistory
    : changeHistory && typeof changeHistory === 'object'
      ? [changeHistory]
      : [];
  return records.map(record => (
    typeof record === 'string'
      ? record.trim()
      : JSON.stringify(stableJsonValue(record))
  )).filter(Boolean);
}

/**
 * A failed official publication can leave the recorded local merge base ahead
 * of the actual remote resource. Recover automatically only when the remote
 * package is a provable older release in the same append-only history chain.
 * Any unrecognised remote history entry fails closed so a concurrent team
 * publication can never be silently overwritten.
 */
export function selectOfficialPackageMergeBase(name, baseContent, localContent, remoteContent) {
  const canonicalBase = canonicalizeResource(name, baseContent);
  if (!name.endsWith('.json')) {
    return { content: canonicalBase, recoveredFromAheadBaseline: false };
  }

  const canonicalLocal = canonicalizeResource(name, localContent);
  const canonicalRemote = canonicalizeResource(name, remoteContent);
  const baseModel = JSON.parse(canonicalBase);
  const localModel = JSON.parse(canonicalLocal);
  const remoteModel = JSON.parse(canonicalRemote);
  const baseInfo = baseModel?.PackageInfo;
  const localInfo = localModel?.PackageInfo;
  const remoteInfo = remoteModel?.PackageInfo;
  if (![baseInfo, localInfo, remoteInfo].every(info => info && typeof info === 'object')) {
    return { content: canonicalBase, recoveredFromAheadBaseline: false };
  }

  const baseVersion = String(baseInfo.Version || '').trim();
  const localVersion = String(localInfo.Version || '').trim();
  const remoteVersion = String(remoteInfo.Version || '').trim();
  const baseParts = semanticVersionParts(baseVersion, `${name} 共同基线版本`);
  const localParts = semanticVersionParts(localVersion, `${name} 本地候选版本`);
  const remoteParts = semanticVersionParts(remoteVersion, `${name} 官网版本`);
  if (compareSemanticVersionParts(baseParts, remoteParts) <= 0) {
    return { content: canonicalBase, recoveredFromAheadBaseline: false };
  }

  if (compareSemanticVersionParts(localParts, baseParts) < 0) {
    throw new Error(
      `${name} 的共同基线 ${baseVersion} 高于官网 ${remoteVersion}，但本地候选 ${localVersion} 又低于共同基线；禁止自动修复`,
    );
  }
  const packageNames = [baseInfo.Name, localInfo.Name, remoteInfo.Name]
    .map(value => String(value || '').trim());
  if (!packageNames[0] || new Set(packageNames).size !== 1) {
    throw new Error(`${name} 的共同基线、本地候选与官网包名不一致；禁止自动修复超前基线`);
  }

  const baseHistory = canonicalChangeHistoryRecords(baseInfo.ChangeHistory);
  const localHistory = new Set(canonicalChangeHistoryRecords(localInfo.ChangeHistory));
  const remoteHistory = canonicalChangeHistoryRecords(remoteInfo.ChangeHistory);
  const baseHistorySet = new Set(baseHistory);
  const missingRemoteHistory = remoteHistory.filter(
    record => !baseHistorySet.has(record) || !localHistory.has(record),
  );
  const missingBaseHistory = baseHistory.filter(record => !localHistory.has(record));
  if (!remoteHistory.length
      || !changeHistoryCoversVersion(remoteInfo.ChangeHistory, remoteVersion)
      || !changeHistoryCoversVersion(baseInfo.ChangeHistory, baseVersion)
      || !changeHistoryCoversVersion(localInfo.ChangeHistory, localVersion)
      || missingRemoteHistory.length
      || missingBaseHistory.length) {
    throw new Error(
      `${name} 的共同基线 ${baseVersion} 高于官网 ${remoteVersion}，但追加式更新历史不能证明官网是共同基线的祖先；禁止自动覆盖官网`,
    );
  }

  return {
    content: canonicalRemote,
    recoveredFromAheadBaseline: true,
    baseVersion,
    localVersion,
    remoteVersion,
  };
}

export function ensureMinimumPackageVersion(packageInfo, minimumVersion) {
  if (!packageInfo || typeof packageInfo !== 'object' || Array.isArray(packageInfo)) {
    throw new Error('PackageInfo 必须是对象');
  }
  const currentVersion = String(packageInfo.Version || '').trim();
  const currentParts = semanticVersionParts(currentVersion, 'PackageInfo.Version', true);
  const minimumParts = semanticVersionParts(minimumVersion, '最低包版本');
  for (let index = 0; index < minimumParts.length; index += 1) {
    if (currentParts[index] > minimumParts[index]) return currentVersion;
    if (currentParts[index] < minimumParts[index]) {
      packageInfo.Version = String(minimumVersion).trim();
      return packageInfo.Version;
    }
  }
  if (!currentVersion) packageInfo.Version = String(minimumVersion).trim();
  return packageInfo.Version;
}

function changeHistoryCoversVersion(changeHistory, version) {
  if (typeof changeHistory === 'string') {
    const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^0-9A-Za-z.])${escapedVersion}(?=$|[^0-9A-Za-z.])`).test(changeHistory);
  }
  if (Array.isArray(changeHistory)) {
    return changeHistory.some(item => changeHistoryCoversVersion(item, version));
  }
  if (changeHistory && typeof changeHistory === 'object') {
    return Object.values(changeHistory).some(item => changeHistoryCoversVersion(item, version));
  }
  return false;
}

function currentChangeHistoryRecords(changeHistory, version) {
  if (typeof changeHistory === 'string') {
    const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const linePattern = new RegExp(`^(\\d{4}-\\d{2}-\\d{2})\\s+${escapedVersion}(?:\\s+(.*))?$`);
    return changeHistory
      .split(/\r?\n/)
      .map(line => line.trim())
      .map(line => linePattern.exec(line))
      .filter(Boolean)
      .map(match => ({ Date: match[1], Content: String(match[2] || '').trim() }));
  }
  if (Array.isArray(changeHistory)) {
    return changeHistory
      .filter(item => item && typeof item === 'object' && String(item.Version || '').trim() === version)
      .map(item => ({
        Date: String(item.Date || '').trim(),
        Content: String(item.Description ?? item.Content ?? '').trim(),
      }));
  }
  if (changeHistory && typeof changeHistory === 'object'
      && String(changeHistory.Version || '').trim() === version) {
    return [{
      Date: String(changeHistory.Date || '').trim(),
      Content: String(changeHistory.Description ?? changeHistory.Content ?? '').trim(),
    }];
  }
  return [];
}

function hasObjectCoercionPlaceholder(value) {
  if (typeof value === 'string') {
    return /(?:^|[\r\n,])\s*\[object Object\](?=\s*(?:$|[\r\n,]))/.test(value);
  }
  if (Array.isArray(value)) return value.some(hasObjectCoercionPlaceholder);
  if (value && typeof value === 'object') return Object.values(value).some(hasObjectCoercionPlaceholder);
  return false;
}

export function validateOfficialPackageChangeLog(name, content) {
  if (!Object.hasOwn(readablePackageNames, name)) return;

  let packageModel;
  try {
    packageModel = JSON.parse(String(content ?? ''));
  } catch (error) {
    throw new Error(`${name} 不是有效 JSON，无法校验 PackageInfo.ChangeLog`, { cause: error });
  }

  const packageInfo = packageModel?.PackageInfo;
  const packageVersion = packageInfo?.Version;
  const changeLog = packageInfo?.ChangeLog;
  if (!changeLog || typeof changeLog !== 'object' || Array.isArray(changeLog)) {
    throw new Error(`${name} 的 PackageInfo.ChangeLog 必须是对象`);
  }
  if (typeof packageVersion !== 'string' || !packageVersion.trim()
      || changeLog.Version !== packageVersion) {
    throw new Error(`${name} 的 PackageInfo.ChangeLog.Version 必须精确等于 PackageInfo.Version`);
  }
  for (const fieldName of ['Title', 'ChangeType', 'Content', 'ReleaseTime']) {
    if (typeof changeLog[fieldName] !== 'string' || !changeLog[fieldName].trim()) {
      throw new Error(`${name} 的 PackageInfo.ChangeLog.${fieldName} 不能为空`);
    }
  }
  // 当前版本说明齐全也不能掩盖更早历史被 String(对象数组) 破坏；发布前保留原文并失败关闭。
  // 只识别独立的转换占位记录，不误拒绝正常说明正文中提到该错误文本的句子。
  if (hasObjectCoercionPlaceholder(packageInfo?.ChangeHistory)) {
    throw new Error(`${name} 的 PackageInfo.ChangeHistory 包含对象转换占位符，必须从已验证历史恢复原文后再发布`);
  }
  if (!changeHistoryCoversVersion(packageInfo?.ChangeHistory, packageVersion)) {
    throw new Error(`${name} 的 PackageInfo.ChangeHistory 未覆盖当前版本 ${packageVersion}`);
  }
  if (exactCurrentHistoryPackageNames.has(name)) {
    const releaseTimeMatch = /^(\d{4}-\d{2}-\d{2}) \d{2}:\d{2}:\d{2}$/.exec(changeLog.ReleaseTime.trim());
    if (!releaseTimeMatch) {
      throw new Error(`${name} 的 PackageInfo.ChangeLog.ReleaseTime 必须为 yyyy-MM-dd HH:mm:ss`);
    }
    const records = currentChangeHistoryRecords(packageInfo.ChangeHistory, packageVersion);
    const expectedDate = releaseTimeMatch[1];
    const expectedContent = changeLog.Content.trim();
    if (!records.some(record => record.Date === expectedDate && record.Content === expectedContent)) {
      throw new Error(
        `${name} 的 PackageInfo.ChangeHistory 当前版本日期或正文与 PackageInfo.ChangeLog 不一致`,
      );
    }
  }
}

/**
 * Official packages must be independently installable. A PageEngine diytable may
 * reference resources outside its package only when the widget explicitly opts
 * into removal on a genuinely missing target reference. Tenant discriminator
 * columns likewise require a target-derived backfill contract instead of a
 * publisher-specific literal default.
 */
export function validateOfficialPackageInstallContracts(name, content) {
  if (!Object.hasOwn(readablePackageNames, name)) return;

  let packageModel;
  try {
    packageModel = JSON.parse(String(content ?? ''));
  } catch (error) {
    throw new Error(`${name} 不是有效 JSON，无法校验安装合同`, { cause: error });
  }

  for (const column of Array.isArray(packageModel.PhysicalColumns) ? packageModel.PhysicalColumns : []) {
    const tableName = String(column?.TABLE_NAME ?? column?.TableName ?? '').toLowerCase();
    // UNUSED_WORKFLOW_PHYSICAL_SCHEMA_V1：防止发布母库已安装插件掩盖空库依赖。
    if (['wf_flowdesign', 'wf_node', 'wf_line'].includes(tableName)
        && !['WfFlowDesigns', 'WfNodes', 'WfLines'].some(key => packageModel[key]?.length)
        && !['DiyTables', 'DDLStatements', 'DataSets', 'SysMenus'].some(key =>
          (packageModel[key] || []).some(row =>
            String(row.TableName || row.DiyTableName || row.Name || '').toLowerCase() === tableName))) {
      throw new Error(`${name} 包含未使用的工作流物理依赖 ${tableName}，应从导出包移除，禁止要求目标租户预装可选插件`);
    }
    const columnName = String(column?.COLUMN_NAME ?? column?.ColumnName ?? column?.Name ?? '').trim();
    if (column.SQLSERVER_UNICODE !== undefined) {
      const type = String(column.COLUMN_TYPE ?? column.ColumnType ?? column.Type ?? '').trim();
      const owned = (packageModel.DiyTables || []).some(table =>
        String(table.Name || table.TableName || '').toLowerCase() === tableName);
      if (column.SQLSERVER_UNICODE !== true || !owned || !/^(?:n?(?:var)?char|(?:tiny|medium|long|n)?text)\b/i.test(type)) {
        throw new Error(`${name} 物理字段 ${tableName}.${columnName} 的 SQLSERVER_UNICODE 必须为 true 且仅声明包拥有的文本列`);
      }
    }
    const nullable = String(column?.IS_NULLABLE ?? column?.IsNullable ?? '').trim().toUpperCase();
    const backfillSource = String(
      column?.BACKFILL_VALUE_SOURCE ?? column?.BackfillValueSource ?? '',
    ).trim();
    const defaultValue = column?.COLUMN_DEFAULT ?? column?.ColumnDefault ?? column?.Default;
    if (backfillSource) {
      if (backfillSource.toLowerCase() !== 'targetosclient'
          || columnName.toLowerCase() !== 'osclient'
          || nullable !== 'NO'
          || (defaultValue !== null && defaultValue !== undefined)) {
        throw new Error(
          `${name} 物理字段 ${column?.TABLE_NAME || column?.TableName}.${columnName} 的 `
          + 'BACKFILL_VALUE_SOURCE 合同无效',
        );
      }
    }
    if (columnName.toLowerCase() === 'osclient' && nullable === 'NO'
        && (defaultValue === null || defaultValue === undefined)
        && backfillSource.toLowerCase() !== 'targetosclient') {
      throw new Error(
        `${name} 物理字段 ${column?.TABLE_NAME || column?.TableName}.OsClient 要求 NOT NULL，`
        + '必须声明 BACKFILL_VALUE_SOURCE=TargetOsClient',
      );
    }
  }

  const menus = new Map((Array.isArray(packageModel.SysMenus) ? packageModel.SysMenus : [])
    .filter(menu => menu?.Id)
    .map(menu => [String(menu.Id).toLowerCase(), menu]));
  const tables = new Set((Array.isArray(packageModel.DiyTables) ? packageModel.DiyTables : [])
    .filter(table => table?.Id)
    .map(table => String(table.Id).toLowerCase()));

  const inspectPageValue = (value, pageId) => {
    if (Array.isArray(value)) {
      for (const item of value) inspectPageValue(item, pageId);
      return;
    }
    if (!value || typeof value !== 'object') return;
    if (String(value.type || '').toLowerCase() === 'diytable') {
      const tableId = String(value.widgetParams?.[0]?.value || '').trim();
      const menuId = String(value.widgetParams?.[1]?.value || '').trim();
      const policy = value.referencePolicy ?? value.ReferencePolicy ?? null;
      const onMissing = String(policy?.onMissing ?? policy?.OnMissing ?? policy?.MissingBehavior ?? '').trim();
      const reason = String(policy?.reason ?? policy?.Reason ?? '').trim();
      if (!tableId || !menuId) {
        throw new Error(`${name} 界面引擎页面 ${pageId} 的 diytable 缺少模块ID或菜单ID`);
      }
      if (onMissing && (onMissing.toLowerCase() !== 'removewidget' || !reason)) {
        throw new Error(
          `${name} 界面引擎页面 ${pageId} 的 diytable 可选引用必须声明 `
          + 'onMissing=RemoveWidget 和非空 reason',
        );
      }
      const menu = menus.get(menuId.toLowerCase());
      const ownsTable = tables.has(tableId.toLowerCase());
      const ownedBindingMatches = menu
        && ownsTable
        && String(menu.DiyTableId || '').toLowerCase() === tableId.toLowerCase();
      if (!ownedBindingMatches && onMissing.toLowerCase() !== 'removewidget') {
        throw new Error(
          `${name} 界面引擎页面 ${pageId} 存在未闭包 diytable 引用：`
          + `MenuId=${menuId}，DiyTableId=${tableId}；必须随包交付匹配资源或显式声明可选移除`,
        );
      }
    }
    for (const nested of Object.values(value)) inspectPageValue(nested, pageId);
  };

  for (const dataSet of Array.isArray(packageModel.DataSets) ? packageModel.DataSets : []) {
    if (String(dataSet?.TableName || '').toLowerCase() !== 'mic_page') continue;
    for (const row of Array.isArray(dataSet.Rows) ? dataSet.Rows : []) {
      let pageJson = row?.JsonObj;
      if (typeof pageJson === 'string') {
        try {
          pageJson = JSON.parse(pageJson);
        } catch (error) {
          throw new Error(`${name} 界面引擎页面 ${row?.Id || '(unknown)'} 的 JsonObj 不是有效 JSON`, {
            cause: error,
          });
        }
      }
      inspectPageValue(pageJson, row?.Id || '(unknown)');
    }
  }
  validateOfficialDataSetSchemaClosure(name, packageModel);
}

// DATASET_SCHEMA_CLOSURE_V1: 官方母库已有物理表不能代替包的建表资源。
// 发布前从实际种子字段反向检查，禁止让缺表错误到客户安装的最后阶段才暴露。
export function validateOfficialDataSetSchemaClosure(name, packageModel) {
  const normalize = value => String(value || '').trim().toLowerCase();
  const dataSets = packageModel.DataSets || [];
  const dataRows = dataSets.reduce((count, dataSet) => count + (dataSet.Rows || []).length, 0);
  for (const [field, actual] of [['DataSetCount', dataSets.length], ['DataRowCount', dataRows]]) {
    if (packageModel.PackageInfo?.[field] !== undefined && packageModel.PackageInfo[field] !== actual) {
      throw new Error(`${name} ${field} 与数据集正文不一致：声明 ${packageModel.PackageInfo[field]}，实际 ${actual}`);
    }
  }
  for (const dataSet of dataSets) {
    const tableName = normalize(dataSet.TableName);
    const table = (packageModel.DiyTables || []).find(row => normalize(row.Name) === tableName);
    const ddl = (packageModel.DDLStatements || []).filter(row => normalize(row.TableName) === tableName
      && /\bCREATE\s+TABLE\b/i.test(String(row.DDL || ''))).map(row => row.DDL).join('\n');
    const physical = new Set((packageModel.PhysicalColumns || [])
      .filter(row => normalize(row.TABLE_NAME) === tableName).map(row => normalize(row.COLUMN_NAME)));
    const fields = new Set((packageModel.DiyFields || [])
      .filter(row => table && normalize(row.TableId) === normalize(table.Id)).map(row => normalize(row.Name)));
    // FormEngine.AddTable 固定创建的六个系统字段可不重复声明 diy_field；物理列和
    // 建表语句仍逐项验证。业务字段不可借此豁免。
    for (const field of ['id', 'createtime', 'updatetime', 'userid', 'username', 'isdeleted']) fields.add(field);
    if (!table || !ddl || !physical.has('id') || !(packageModel.DiyFields || []).some(row => table && normalize(row.TableId) === normalize(table.Id))) {
      throw new Error(`${name} 数据集 ${dataSet.TableName} 缺少完整建表资源（DiyTables/DiyFields/DDLStatements/PhysicalColumns），禁止依赖发布母库已有结构`);
    }
    const required = new Set(['id', ...(dataSet.ConflictFields || []).map(normalize)]);
    for (const row of dataSet.Rows || []) for (const key of Object.keys(row)) required.add(normalize(key));
    const ddlColumns = new Set([...ddl.matchAll(/(?:^|[,\n(])\s*[`"\[]([A-Za-z_][A-Za-z0-9_]*)[`"\]]\s+[A-Za-z]/g)].map(match => normalize(match[1])));
    for (const field of required) {
      if (!physical.has(field) || !fields.has(field) || !ddlColumns.has(field)) {
        throw new Error(`${name} 数据集 ${dataSet.TableName}.${field} 缺少字段元数据或物理建表列`);
      }
    }
  }
}

function formatLocalReleaseTime(value) {
  const pad = number => String(number).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} `
    + `${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
}

/**
 * 官网三方同步在发现本地内容变化、但包版本不高于线上版本时会自动提版。
 * 提版必须把结构化更新日志和历史记录一起推进，否则发布门禁会留下一个
 * PackageInfo.Version 已更新、ChangeLog 仍指向旧版的半成品候选包。
 */
export function advanceOfficialPackageVersion(packageInfo, nextVersion, releaseTime = formatLocalReleaseTime(new Date())) {
  if (!packageInfo || typeof packageInfo !== 'object' || Array.isArray(packageInfo)) {
    throw new Error('PackageInfo 必须是对象，无法自动提升官方应用包版本');
  }
  semanticVersionParts(nextVersion, '自动提升后的 PackageInfo.Version');
  const previousVersion = String(packageInfo.Version || '').trim();
  const changeLog = packageInfo.ChangeLog;
  if (!changeLog || typeof changeLog !== 'object' || Array.isArray(changeLog)
      || String(changeLog.Version || '').trim() !== previousVersion) {
    throw new Error('自动提升官方应用包版本前，PackageInfo.ChangeLog 必须与当前版本一致');
  }
  for (const fieldName of ['Title', 'ChangeType', 'Content']) {
    if (typeof changeLog[fieldName] !== 'string' || !changeLog[fieldName].trim()) {
      throw new Error(`自动提升官方应用包版本前，PackageInfo.ChangeLog.${fieldName} 不能为空`);
    }
  }
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(String(releaseTime || '').trim())) {
    throw new Error('自动提升官方应用包版本的发布时间必须为 yyyy-MM-dd HH:mm:ss');
  }

  const normalizedVersion = String(nextVersion).trim().startsWith('v')
    ? String(nextVersion).trim()
    : `v${String(nextVersion).trim()}`;
  packageInfo.Version = normalizedVersion;
  changeLog.Version = normalizedVersion;
  changeLog.ReleaseTime = String(releaseTime).trim();

  const currentRecord = {
    Version: normalizedVersion,
    Date: changeLog.ReleaseTime.substring(0, 10),
    Description: changeLog.Content.trim(),
  };
  const history = packageInfo.ChangeHistory;
  if (Array.isArray(history)) {
    packageInfo.ChangeHistory = [
      currentRecord,
      ...history.filter(item => String(item?.Version || '').trim() !== normalizedVersion),
    ];
  } else if (history && typeof history === 'object') {
    const previousRecords = String(history.Version || '').trim() === normalizedVersion ? [] : [history];
    packageInfo.ChangeHistory = [currentRecord, ...previousRecords];
  } else {
    const escapedVersion = normalizedVersion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const versionPattern = new RegExp(`(^|[^0-9A-Za-z.])${escapedVersion}(?=$|[^0-9A-Za-z.])`);
    const previousLines = String(history || '')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !versionPattern.test(line));
    const currentLine = `${currentRecord.Date} ${currentRecord.Version} ${currentRecord.Description}`;
    packageInfo.ChangeHistory = `${[currentLine, ...previousLines].join('\n')}\n`;
  }
  return normalizedVersion;
}

function stableJsonValue(value) {
  if (Array.isArray(value)) return value.map(stableJsonValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map(key => [key, stableJsonValue(value[key])]),
  );
}

function getRequiredPlatformServiceBundle(name, content) {
  if (!platformServicePackageNames.has(name)) {
    throw new Error(`不允许检查非平台内置微服务应用包：${name}`);
  }
  let packageModel;
  try {
    packageModel = JSON.parse(canonicalizeResource(name, content));
  } catch (error) {
    throw new Error(`${name} 不是有效 JSON，无法判断平台内置微服务是否变化`, { cause: error });
  }
  const bundles = Array.isArray(packageModel?.ApplicationBundles)
    ? packageModel.ApplicationBundles
    : [];
  const matches = bundles.filter(bundle => {
    const application = bundle?.Application || {};
    return String(application.AppKey || application.AppId || '').trim() === 'microi-platform-service';
  });
  if (matches.length !== 1) {
    throw new Error(`${name} 必须且只能包含一个 microi-platform-service 应用包，当前 ${matches.length} 个`);
  }
  return matches[0];
}

export function hasPlatformServiceBundleChanged(name, remoteContent, candidateContent) {
  const remoteBundle = getRequiredPlatformServiceBundle(name, remoteContent);
  const candidateBundle = getRequiredPlatformServiceBundle(name, candidateContent);
  return JSON.stringify(stableJsonValue(remoteBundle)) !== JSON.stringify(stableJsonValue(candidateBundle));
}

export function normalizeOfficialPackageExecutionLimits(name, content, recursionCeiling = 5000) {
  const canonical = canonicalizeResource(name, content);
  if (!name.endsWith('.json')) return canonical;

  const ceiling = Number(recursionCeiling);
  if (!Number.isFinite(ceiling) || ceiling <= 0) {
    throw new Error('官方应用包递归上限必须是正整数');
  }

  const packageModel = JSON.parse(canonical);
  let changed = false;
  for (const engine of Array.isArray(packageModel?.SysApiEngines) ? packageModel.SysApiEngines : []) {
    const persisted = Number(engine?.LimitRecursion);
    if (!Number.isFinite(persisted) || persisted <= ceiling) continue;
    engine.LimitRecursion = Math.trunc(ceiling);
    changed = true;
  }
  return changed ? canonicalizeResource(name, JSON.stringify(packageModel)) : canonical;
}

// Remote resources are one side of a three-way merge and are allowed to lag
// behind the local release candidate. This gate only proves that the response
// has the expected stable identity and can be parsed safely. The strict feature
// and minimum-version gate remains in refresh-resources.mjs and is applied to
// local input and the final merged candidate before any write or publication.
export function validateReadableOfficialResource(name, content) {
  const text = String(content ?? '');
  if (!text.trim()) throw new Error(`${name} 内容为空`);

  if (Object.hasOwn(readableResourceIdentities, name)) {
    const expectedIdentity = readableResourceIdentities[name];
    if (!text.includes(expectedIdentity)) {
      throw new Error(`${name} 缺少稳定资源标识 ${expectedIdentity}`);
    }
    return;
  }

  if (Object.hasOwn(readablePackageNames, name)) {
    let packageModel;
    try {
      packageModel = JSON.parse(text);
    } catch (error) {
      throw new Error(`${name} 不是有效 JSON：${error.message}`, { cause: error });
    }
    if (packageModel?.PackageInfo?.Name !== readablePackageNames[name]) {
      throw new Error(`${name} 的 PackageInfo.Name 不正确`);
    }
    return;
  }

  throw new Error(`不允许读取未列入固定白名单的官网升级资源：${name}`);
}

export function isTemporaryOfficialResourceFailure(error) {
  const messages = [];
  const codes = [];
  let current = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    messages.push(String(current.message || current));
    if (current.code) codes.push(String(current.code));
    current = current.cause;
  }
  const message = messages.join(' | ');
  const code = codes.join(' | ');
  return /服务器内部错误/i.test(message)
    || /\bHTTP (?:408|425|429|5\d\d)\b/i.test(message)
    || /\b(?:fetch failed|network|socket|timeout|timed out|aborted)\b/i.test(message)
    || /\b(?:ECONNRESET|ECONNREFUSED|ECONNABORTED|ENETUNREACH|EHOSTUNREACH|ETIMEDOUT|EAI_AGAIN)\b/i.test(`${message} ${code}`);
}

export function verifyOfflineReleaseSafety(resourceNames, localResources, baseResources) {
  const missingBases = [];
  const localChanges = [];
  for (const name of resourceNames) {
    if (!baseResources.has(name)) {
      missingBases.push(name);
    } else if (localResources.get(name) !== baseResources.get(name)) {
      localChanges.push(name);
    }
  }
  if (missingBases.length || localChanges.length) {
    const reasons = [];
    if (missingBases.length) reasons.push(`缺少共同基线：${missingBases.join('、')}`);
    if (localChanges.length) reasons.push(`本地已有未同步修改：${localChanges.join('、')}`);
    throw new Error(`官网升级资源暂时不可用，且不能安全使用离线基线（${reasons.join('；')}）`);
  }
}

/**
 * The official resource engine validates every item before writing the batch.
 * When that engine itself changes its package contracts, publish its standalone
 * source first so the next CAS-protected batch is validated by the new engine.
 */
export function planOfficialResourcePublishBatches(changes) {
  if (!Array.isArray(changes) || !changes.length) return [];
  const controlPlaneName = 'official-resource-api.js';
  const controlPlane = changes.find(item => item?.name === controlPlaneName);
  if (!controlPlane || changes.length === 1) return [changes.slice()];
  return [
    [controlPlane],
    changes.filter(item => item?.name !== controlPlaneName),
  ];
}

function same(left, right) {
  if (left === MISSING || right === MISSING) return left === right;
  return JSON.stringify(left) === JSON.stringify(right);
}

function clone(value) {
  if (value === MISSING) return MISSING;
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function findIdentityField(...arrays) {
  const populated = arrays.filter(Array.isArray).filter(items => items.length > 0);
  if (!populated.length) return null;
  return identityFields.find(field => populated.every(items => {
    const keys = items.map(item => (
      isObject(item) && item[field] !== undefined && item[field] !== null
        ? String(item[field])
        : ''
    ));
    return keys.every(Boolean) && new Set(keys).size === keys.length;
  })) || null;
}

const setLikeArrayPaths = new Set([
  '$.PackageInfo.Capabilities',
  '$.PackageInfo.RequiredPlatformCapabilities',
]);

function mergeSetLikeArray(base, local, remote, path, conflicts) {
  const allPrimitiveStrings = [base, local, remote].every(items => (
    items.every(item => typeof item === 'string' && item.trim())
  ));
  if (!allPrimitiveStrings) {
    conflicts.push(`${path}: 集合数组只能包含非空字符串`);
    return clone(local);
  }

  const baseSet = new Set(base);
  const localSet = new Set(local);
  const remoteSet = new Set(remote);
  const order = [...new Set([...base, ...local, ...remote])];
  return order.filter(item => {
    const baseHas = baseSet.has(item);
    const localHas = localSet.has(item);
    const remoteHas = remoteSet.has(item);
    if (localHas === remoteHas) return localHas;
    if (localHas === baseHas) return remoteHas;
    if (remoteHas === baseHas) return localHas;
    conflicts.push(`${path}: 能力 ${item} 的三方集合状态无法判定`);
    return localHas;
  });
}

function historyLineVersion(line) {
  return String(line).match(/(?:^|\s)(v?\d+\.\d+\.\d+)(?:\s|$)/i)?.[1]?.toLowerCase() || '';
}

function compareHistoryLines(left, right) {
  const parse = line => {
    const date = String(line).match(/^(\d{4}-\d{2}-\d{2})\b/)?.[1] || '';
    const version = historyLineVersion(line).replace(/^v/i, '').split('.').map(Number);
    return { date, version };
  };
  const a = parse(left);
  const b = parse(right);
  if (a.date !== b.date) return b.date.localeCompare(a.date);
  for (let index = 0; index < 3; index += 1) {
    const delta = Number(b.version[index] || 0) - Number(a.version[index] || 0);
    if (delta) return delta;
  }
  return String(left).localeCompare(String(right), 'zh-CN');
}

function mergeAppendOnlyHistory(base, local, remote, path, conflicts) {
  const lines = value => String(value || '').split(/\r?\n/).map(item => item.trim()).filter(Boolean);
  const baseLines = lines(base);
  const localLines = lines(local);
  const remoteLines = lines(remote);
  const localSet = new Set(localLines);
  const remoteSet = new Set(remoteLines);
  const missingLocal = baseLines.filter(line => !localSet.has(line));
  const missingRemote = baseLines.filter(line => !remoteSet.has(line));
  if (missingLocal.length || missingRemote.length) {
    conflicts.push(`${path}: 更新日志只允许追加，不能删除或改写共同基线条目`);
    return clone(local);
  }

  const baseSet = new Set(baseLines);
  const additions = [...new Set([
    ...localLines.filter(line => !baseSet.has(line)),
    ...remoteLines.filter(line => !baseSet.has(line)),
  ])];
  const byVersion = new Map();
  for (const line of additions) {
    const version = historyLineVersion(line);
    if (!version) continue;
    const existing = byVersion.get(version);
    if (existing && existing !== line) {
      conflicts.push(`${path}: 版本 ${version} 被两端追加为不同内容`);
      return clone(local);
    }
    byVersion.set(version, line);
  }
  additions.sort(compareHistoryLines);
  return [...additions, ...baseLines].join('\n') + (additions.length || baseLines.length ? '\n' : '');
}

function mergeValue(base, local, remote, path, conflicts) {
  if (same(local, remote)) return clone(local);
  if (same(local, base)) return clone(remote);
  if (same(remote, base)) return clone(local);

  if (local === MISSING || remote === MISSING) {
    conflicts.push(`${path}: 一侧删除、另一侧修改`);
    return clone(local === MISSING ? remote : local);
  }

  if (isObject(base) && isObject(local) && isObject(remote)) {
    const merged = {};
    const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]);
    for (const key of keys) {
      const value = mergeValue(
        Object.hasOwn(base, key) ? base[key] : MISSING,
        Object.hasOwn(local, key) ? local[key] : MISSING,
        Object.hasOwn(remote, key) ? remote[key] : MISSING,
        `${path}.${key}`,
        conflicts,
      );
      if (value !== MISSING) merged[key] = value;
    }
    return merged;
  }

  if (Array.isArray(base) && Array.isArray(local) && Array.isArray(remote)) {
    if (setLikeArrayPaths.has(path)) {
      return mergeSetLikeArray(base, local, remote, path, conflicts);
    }
    const identityField = findIdentityField(base, local, remote);
    if (!identityField) {
      conflicts.push(`${path}: 无稳定标识的数组被两端同时修改`);
      return clone(local);
    }

    const toMap = items => new Map(items.map(item => [String(item[identityField]), item]));
    const baseMap = toMap(base);
    const localMap = toMap(local);
    const remoteMap = toMap(remote);
    const order = [];
    for (const items of [base, local, remote]) {
      for (const item of items) {
        const key = String(item[identityField]);
        if (!order.includes(key)) order.push(key);
      }
    }

    const merged = [];
    for (const key of order) {
      const value = mergeValue(
        baseMap.has(key) ? baseMap.get(key) : MISSING,
        localMap.has(key) ? localMap.get(key) : MISSING,
        remoteMap.has(key) ? remoteMap.get(key) : MISSING,
        `${path}[${identityField}=${key}]`,
        conflicts,
      );
      if (value !== MISSING) merged.push(value);
    }
    return merged;
  }

  if (path === '$.PackageInfo.ChangeHistory'
      && typeof base === 'string' && typeof local === 'string' && typeof remote === 'string') {
    return mergeAppendOnlyHistory(base, local, remote, path, conflicts);
  }

  conflicts.push(`${path}: 两端修改为不同值`);
  return clone(local);
}

export function mergeJsonResource(name, baseContent, localContent, remoteContent) {
  const base = JSON.parse(canonicalizeResource(name, baseContent));
  const local = JSON.parse(canonicalizeResource(name, localContent));
  const remote = JSON.parse(canonicalizeResource(name, remoteContent));
  const conflicts = [];
  const merged = mergeValue(base, local, remote, '$', conflicts);
  if (conflicts.length) {
    throw new Error(`${name} 存在 ${conflicts.length} 个 JSON 冲突：\n- ${conflicts.slice(0, 20).join('\n- ')}`);
  }
  return `${JSON.stringify(merged, null, 2)}\n`;
}

export async function mergeJavascriptResource(name, baseContent, localContent, remoteContent) {
  const base = canonicalizeResource(name, baseContent);
  const local = canonicalizeResource(name, localContent);
  const remote = canonicalizeResource(name, remoteContent);
  if (local === remote) return local;
  if (local === base) return remote;
  if (remote === base) return local;

  const tempDirectory = await mkdtemp(join(tmpdir(), 'microi-resource-merge-'));
  const localPath = join(tempDirectory, 'local.js');
  const basePath = join(tempDirectory, 'base.js');
  const remotePath = join(tempDirectory, 'remote.js');
  try {
    await Promise.all([
      writeFile(localPath, local, 'utf8'),
      writeFile(basePath, base, 'utf8'),
      writeFile(remotePath, remote, 'utf8'),
    ]);
    let firstConflict = '';
    let lastToolError = '';
    // 不同 Git diff 算法对长 V8 文件中的相邻函数/语句有不同的锚点选择。
    // 任一算法得到无冲突结果即可接受；真正同一代码位置的不同实现会在所有
    // 算法下继续失败关闭。
    for (const algorithm of [null, 'histogram', 'patience', 'minimal']) {
      const args = ['merge-file', '-p'];
      if (algorithm) args.push('--diff-algorithm', algorithm);
      args.push(localPath, basePath, remotePath);
      const merge = spawnSync(
        'git',
        args,
        { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
      );
      if (merge.status === 0) return canonicalizeResource(name, merge.stdout);
      if (merge.status === 1) {
        firstConflict ||= merge.stdout;
        continue;
      }
      lastToolError = merge.stderr || `退出码 ${merge.status}`;
    }
    if (firstConflict) {
      throw new Error(`${name} 存在 JS 三方合并冲突，请先人工合并后重新发布：\n${firstConflict}`);
    }
    throw new Error(`${name} 执行 git merge-file 失败：${lastToolError || '未知错误'}`);
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}

export async function mergeResource(name, baseContent, localContent, remoteContent) {
  if (name.endsWith('.json')) {
    return mergeJsonResource(name, baseContent, localContent, remoteContent);
  }
  return mergeJavascriptResource(name, baseContent, localContent, remoteContent);
}
