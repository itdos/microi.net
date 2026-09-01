#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import {
  advanceOfficialPackageVersion,
  canonicalizeResource,
  hasPlatformServiceBundleChanged,
  isTemporaryOfficialResourceFailure,
  mergeResource,
  normalizeOfficialPackageExecutionLimits,
  planOfficialResourcePublishBatches,
  selectOfficialPackageMergeBase,
  validateOfficialPackageChangeLog,
  validateReadableOfficialResource,
  verifyOfflineReleaseSafety,
} from './resource-sync-core.mjs';
import {
  applicationStoreReplicaMappings,
  applicationStorePackageName,
  assertApplicationStoreEnginesSynchronized,
  choosePublishablePackageVersion,
  compareSemanticVersions,
  getEmbeddedEngineSource,
  mergeApplicationStoreReplicas,
  publishedApplicationStoreReplicaMappings,
  synchronizeApplicationStoreEngines,
} from './application-store-replica-sync.mjs';
import {
  publishResourcesViaConfiguredMcp,
  readResourcesViaConfiguredMcp,
  reconcilePublishedApiEnginesViaConfiguredMcp,
} from './mcp-resource-publisher.mjs';

const resourceNames = [
  'import-package.js',
  'ai-app-publish-store.js',
  'official-resource-api.js',
  'app.microi.form-engine.json',
  'app.microi.module-engine.json',
  'app.microi.saas-engine.json',
  'app.microi.sso.json',
  'app.microi.store.json',
  'app.microi.sys_user.json',
  'app.microi.sys-config.json',
  'app.microi.message-notification.json',
  'app.microi.ai-engine.json',
];
const officialApplicationResourceNames = resourceNames.filter(name => name.endsWith('.json'));
const endpoint = process.env.MICROI_UPGRADE_RESOURCE_API
  || 'https://api.itdos.com/apiengine/get-microi-upgrade-resource?OsClient=iTdos';
const publishEndpoint = process.env.MICROI_UPGRADE_RESOURCE_PUBLISH_API
  || 'https://api.itdos.com/apiengine/get-microi-upgrade-resource--OsClient--iTdos--';
const outputDirectory = dirname(fileURLToPath(import.meta.url));
const baseDirectory = resolve(outputDirectory, '.resource-sync-base');
const execFileAsync = promisify(execFile);

async function verifyPlatformServiceReleaseSource() {
  const verifierPath = resolve(outputDirectory, 'embed-platform-service-bundle.mjs');
  try {
    const result = await execFileAsync(
      process.execPath,
      [verifierPath, '--verify-only', '--require-clean-source'],
      {
      cwd: resolve(outputDirectory, '../../..'),
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
      timeout: 60_000,
      windowsHide: true,
      },
    );
    const summary = JSON.parse(String(result.stdout || '{}'));
    process.stdout.write(
      `microi-platform-service\t唯一源码与两个内置包一致\t${summary.version || ''}\t${summary.runtimeManifestHash || ''}\n`,
    );
  } catch (error) {
    const detail = String(error?.stderr || error?.stdout || error?.message || error).trim();
    throw new Error(`正式发布已阻止：平台内置微服务唯一源码、dist、路由或两个内置包存在漂移。${detail ? `\n${detail}` : ''}`);
  }
}

function validateReleaseCandidate(name, content) {
  if (!content.trim()) throw new Error(`${name} 内容为空`);
  validateOfficialPackageChangeLog(name, content);
  if (name === 'import-package.js') {
    if (!content.includes('import-microi-store-package')) {
      throw new Error(`${name} 缺少 import-microi-store-package`);
    }
    const versionMatch = content.match(/Version\s*:\s*v?(\d+)\.(\d+)\.(\d+)/i);
    const versionNumber = versionMatch
      ? Number(versionMatch[1]) * 1_000_000 + Number(versionMatch[2]) * 1_000 + Number(versionMatch[3])
      : 0;
    if (versionNumber < 2_005_004
      || !content.includes('preserve_interface_engine_pagetabs_')
      || !content.includes('System.DateTime.Now.ToString')
      || !content.includes('OwnerUserId')
      || !content.includes('MicroServiceMenusPreserved')
      || !content.includes('sourceExpected')
      || !content.includes('validationSourceExpected')
      || !content.includes('stableMenuUrl')
      || !content.includes('normalizeRouteMeta')
      || !content.includes('recoverBoundMicroserviceMenus')
      || !content.includes('preservedLegacyUrl')
      || !content.includes("upsertApplicationRow('sys_microistore'")
      || !content.includes('official_marketplace_install_stat')
      || !content.includes('SKIP_MOVE_FOR_REUSED_BUILD_V1')
      || !content.includes('MICRO_APP_PUBLIC_HDFS_PATH_V1')
      || !content.includes('DB_RUNTIME_BUILD_ASSETS_V1')
      || !content.includes('PRUNE_ASSET_IDS_WITH_DELFORM_V1')
      || !content.includes('BACKGROUND_TASK_BOOTSTRAP_READINESS_V1')
      || !content.includes('BACKGROUND_TASK_RUNTIME_SCOPE_V1')
      || !content.includes('SCHEMA_BACKGROUND_CHUNKS_V1')
      || !content.includes('APPLICATION_ASSET_BACKGROUND_CHUNKS_V1')
      || !content.includes('REMOTE_ZIP_SINGLE_ASSET_SLICE_V1')
      || !content.includes('SharedPublicRuntime')
      || !content.includes('ASSET_METADATA_WITHOUT_SECOND_DECODE_V1')
      || !content.includes('DATASET_INSERT_IF_MISSING_V1')
      || !content.includes('PACKAGE_API_ENGINE_READBACK_V1')
      || !content.includes('API_ENGINE_RESOURCE_BASELINE_V1')
      || !content.includes('MARKETPLACE_INSTALL_STAT_NON_BLOCKING_V2')
      || !content.includes('SKIP_INSTALL_COUNT_WITHOUT_MARKETPLACE_ID_V1')
      || !content.includes('LEGACY_INSTALL_VERSION_IDENTITY_FALLBACK_V1')
      || !content.includes('BACKGROUND_TASK_BOUNDED_PACKAGE_SLICES_V1')
      || !content.includes('MYSQL_ROW_SIZE_OFFPAGE_FALLBACK_V1')
      || !content.includes('LEGACY_SWITCH_BOOLEAN_TEXT_V1')
      || !content.includes('JSON_SWITCH_LITERAL_UNQUOTE_V1')
      || !content.includes('MYSQL_BIT_NUMERIC_COMPAT_V1')
      || !content.includes('ADMIN_MENU_PERMISSION_V1')
      || !content.includes('ADMIN_MENU_PERMISSION_PHYSICAL_FALLBACK_V1')
      || !content.includes('ADMIN_MENU_PERMISSION_DB_TIME_V1')
      || !content.includes('TRUSTED_OFFICIAL_PLATFORM_PACKAGE_V1')
      || !content.includes('TRUSTED_EMBEDDED_OFFICIAL_PACKAGE_V1')
      || !content.includes('V8.Method.RequireManagedProtocolContext')
      || !content.includes('PACKAGE_MANAGED_OVERWRITE_V2')
      || !content.includes('PACKAGE_API_ENGINE_IDENTITY_RECONCILIATION_V2')
      || !content.includes('PACKAGE_API_ENGINE_ROUTE_RECLAIM_V1')
      || !content.includes('GENERATED_ENTITY_PHYSICAL_BOOTSTRAP_V1')
      || !content.includes('GENERATED_ENTITY_PHYSICAL_BOOTSTRAP_BATCH_V1')
      || !content.includes('GENERATED_ENTITY_PHYSICAL_BOOTSTRAP_CHECKPOINT_V1')
      || !content.includes('DATABASE_ONLY_BUILD_ASSETS_V1')
      || !content.includes('MARKETPLACE_PACKAGE_IDENTITY_BINDING_V1')
      || !content.includes('ApplicationAssetDownloadUrls')
      || !content.includes('BACKGROUND_TASK_MONOTONIC_PROGRESS_V1')
      || !content.includes('BACKGROUND_TASK_PERSISTED_PROGRESS_FLOOR_V1')
      || !content.includes('PACKAGE_REPLAY_VERSION_GUARD_V2')
      || !content.includes('OBJECT_STORAGE_FORBIDDEN')) {
      throw new Error(`${name} 低于 v2.5.0 或缺少生成实体物理前置列自愈、跨分片累计结果、不可变共享公共运行时、远程 ZIP 单资产安全分片、跨数据库权限时间、共享任务进度下限、旧租户权限物理表兼容、单调后台进度、对象存储可行动诊断、受限数据库内联运行、宿主可信内置官方包重放、Managed 包资源覆盖升级及统一应用商城能力，拒绝降级本地基线`);
    }
  }
  if (name === 'ai-app-publish-store.js') {
    const versionMatch = content.match(/Version\s*:\s*v?(\d+)\.(\d+)\.(\d+)/i);
    const versionNumber = versionMatch
      ? Number(versionMatch[1]) * 1_000_000 + Number(versionMatch[2]) * 1_000 + Number(versionMatch[3])
      : 0;
    if (!content.includes('ai_app_publish_store')
      || versionNumber < 1_009_016
      || !content.includes('MARKETPLACE_IMMUTABLE_INSTALL_SNAPSHOT_V1')
      || !content.includes('MARKETPLACE_CURRENT_PACKAGE_REPAIR_CAS_V1')
      || !content.includes('selectionValues(existingStore.SelectTable')
      || !content.includes('selectionValues(existingStore.SelectApiEngine')
      || !content.includes('IncludeSource: includeSource')
      || !content.includes("action === 'PackageOnly'")
      || !content.includes('ReturnPackageModel')
      || !content.includes("GetFormData('sys_microistore'")
      || !content.includes('ApplicationType || app.AppType')
      || !content.includes('PublishHdfsPath')
      || !content.includes("Source: 'CompiledAssets'")
      || !content.includes('SOURCE_BUILD_ARCHIVE_ROOTS_V1')
      || !content.includes('buildApiEngineResourcePolicies')
      || !content.includes('OFFICIAL_PLATFORM_API_ENGINE_OWNERSHIP_V1')
      || !content.includes('SharedPublicRuntime')
      || !content.includes('MARKETPLACE_SOURCE_DEFAULT_PRIVATE_V1')
      || !content.includes("Build: storeVisibility ? 'PublicHdfs' : 'PrivateHdfs'")) {
      throw new Error(`${name} 缺少 v1.7.8 不可变共享公共运行时、官方平台接口引擎所有权、统一应用商城、历史 BuildLog 兼容入口、严格源码/编译分根目录及自包含 PackageOnly 能力`);
    }
  }
  if (name === 'official-resource-api.js') {
    if (!content.includes('ApiEngineKey: get-microi-upgrade-resource')
      || !content.includes('Version: v1.3.4')
      || !content.includes('V8.Method.AuthorizeOfficialResourcePublish()')
      || !content.includes('ExpectedRemoteSha256')
      || !content.includes('function lockPublishRows()')
      || (content.match(/FOR UPDATE/g) || []).length !== 3
      || !content.includes('ReconcilePublishedApiEngines')
      || !content.includes('function reconcilePublishedApiEngines()')
      || !content.includes('发布升级资源[')
      || !content.includes('后回读内容哈希不一致')
      || !content.includes('OFFICIAL_RESOURCE_EXACT_SELECTION_V1')
      || !content.includes('storedSelectionEquals')
      || !content.includes('存储接口 Code=1 但缺少 Data')
      || !content.includes('SelectApiEngine: selectionJson(exactSelections.SelectApiEngine)')
      || !content.includes('SelectTable: selectionJson(exactSelections.SelectTable)')) {
      throw new Error(`${name} 缺少固定白名单、SHA 乐观锁、事务行锁、精确选择元数据或发布后回读保护`);
    }
  }
  if (name.endsWith('.json')) {
    const packageModel = JSON.parse(content);
    const expectedNames = {
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
    if (packageModel?.PackageInfo?.Name !== expectedNames[name]) {
      throw new Error(`${name} 的 PackageInfo.Name 不正确`);
    }
    const packageEngines = Array.isArray(packageModel.SysApiEngines) ? packageModel.SysApiEngines : [];
    const packageEngineMap = new Map(packageEngines.map(engine => [String(engine.ApiEngineKey || ''), engine]));
    if (packageEngineMap.size !== packageEngines.length) {
      throw new Error(`${name} 存在重复 ApiEngineKey。`);
    }
    const semanticNumber = value => {
      const parts = String(value || '').replace(/^v/i, '').split('.').map(item => Number(item) || 0);
      return (parts[0] || 0) * 1_000_000 + (parts[1] || 0) * 1_000 + (parts[2] || 0);
    };
    const packageContracts = {
      'app.microi.sys_user.json': {
        minimumVersion: 7_006_002,
        exactKeys: ['platform-user-update-preferences', 'user-module-table-preference', 'sys-user-security-action', 'platform-user-update-profile', 'platform-sys-user-admin', 'platform-user-access-key', 'platform-user-custom-hook'],
        tenantHooks: ['platform-user-custom-hook'],
      },
      'app.microi.sys-config.json': {
        minimumVersion: 6_003_008,
        exactKeys: ['platform-tenant-system-settings', 'platform-system-settings-custom-hook'],
        tenantHooks: ['platform-system-settings-custom-hook'],
      },
      'app.microi.message-notification.json': {
        minimumVersion: 1_000_011,
        exactKeys: ['msg_event', 'msg_internal_list', 'msg_internal_mark_read', 'platform-chat-system-message', 'platform-chat-runtime', 'platform-message-notification-custom-hook', 'wechat_send_tpl_msg'],
        tenantHooks: ['platform-message-notification-custom-hook'],
      },
      'app.microi.ai-engine.json': {
        minimumVersion: 6_003_006,
        exactKeys: ['mci_ai_data_assistant', 'platform-ai-account', 'platform-ai-runtime', 'platform-ai-custom-hook'],
        tenantHooks: ['platform-ai-custom-hook'],
      },
    };
    const packageContract = packageContracts[name];
    if (packageContract) {
      const actualKeys = [...packageEngineMap.keys()].sort();
      const expectedKeys = [...packageContract.exactKeys].sort();
      if (semanticNumber(packageModel?.PackageInfo?.Version) < packageContract.minimumVersion
        || JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
        throw new Error(`${name} 版本或接口引擎唯一归属清单不正确。`);
      }
      for (const key of expectedKeys) {
        const engine = packageEngineMap.get(key);
        const policy = packageModel?.ResourcePolicies?.ApiEngines?.[key];
        const isTenantHook = packageContract.tenantHooks.includes(key);
        if (!String(engine?.ApiV8Code || '').trimStart().startsWith(
          isTenantHook
            ? '/* OFFICIAL_CREATE_IF_MISSING_API_ENGINE_NOTICE_V1'
            : '/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1',
        ) || policy?.UpgradePolicy !== (isTenantHook ? 'CreateIfMissing' : 'Managed')
          || (isTenantHook
            ? policy?.Ownership !== 'Tenant'
            : !['Platform', 'Application'].includes(policy?.Ownership))) {
          throw new Error(`${name} 接口引擎 ${key} 缺少官方提示或正确资源策略。`);
        }
      }
      if (name === 'app.microi.ai-engine.json') {
        const dataAssistantCode = String(packageEngineMap.get('mci_ai_data_assistant')?.ApiV8Code || '');
        const accountCode = String(packageEngineMap.get('platform-ai-account')?.ApiV8Code || '');
        const runtimeCode = String(packageEngineMap.get('platform-ai-runtime')?.ApiV8Code || '');
        const dataAssistantHookCode = dataAssistantCode.match(
          /V8\.ApiEngine\.Run\('platform-ai-custom-hook',\s*\{[\s\S]*?\}\);/,
        )?.[0] || '';
        const accountHookCode = accountCode.match(
          /function runTenantHook\([\s\S]*?(?=\nfunction getPlans\()/,
        )?.[0] || '';
        const runtimeHookCode = runtimeCode.match(
          /V8\.ApiEngine\.Run\('platform-ai-custom-hook',\s*\{[\s\S]*?\}\);/,
        )?.[0] || '';
        const sensitiveHookField = /\b(?:Question|Prompt|Answer|ApiKey|TaskId|TradeNo|TotalAmount)\b/;
        if (!dataAssistantCode.includes('AI_DATA_ASSISTANT_SAFE_TENANT_HOOK_V1')
          || !dataAssistantCode.includes("V8.ApiEngine.Run('platform-ai-custom-hook'")
          || !accountCode.includes("platform-ai-custom-hook")
          || !accountCode.includes('PAYMENT_COMPLETE_MANAGED_V1')
          || !accountCode.includes('RequireManagedProtocolContext')
          || !runtimeCode.includes('AI_RUNTIME_MANAGED_NON_STREAM_V1')
          || !runtimeCode.includes('V8.AI.Chat')
          || !runtimeCode.includes('V8.AI.NL2SQL')
          || !runtimeCode.includes('V8.AI.NL2V8')
          || !runtimeCode.includes("V8.ApiEngine.Run('platform-ai-custom-hook'")
          || !dataAssistantHookCode
          || !accountHookCode
          || !runtimeHookCode
          || sensitiveHookField.test(dataAssistantHookCode + accountHookCode + runtimeHookCode)) {
          throw new Error(`${name} 缺少安全最小化 AI 个性化 Hook 契约。`);
        }
        const capabilities = packageModel?.PackageInfo?.RequiredPlatformCapabilities || [];
        for (const capability of [
          'ApiEngine:platform-ai-account@v1.1.0',
          'ApiEngine:platform-ai-runtime@v1.0.0',
          'V8.Method.RequireManagedProtocolContext',
          'V8.AI.UpdateConversationTitle',
          'V8.AI.Chat',
          'V8.AI.RecognizeIntent',
          'V8.AI.NL2SQL',
          'V8.AI.NL2V8',
        ]) {
          if (!capabilities.includes(capability)) {
            throw new Error(`${name} 缺少能力 ${capability}。`);
          }
        }
      }
      if (name === 'app.microi.sys_user.json') {
        const adminEngine = packageEngineMap.get('platform-sys-user-admin');
        const adminCode = String(adminEngine?.ApiV8Code || '');
        const capabilities = packageModel?.PackageInfo?.RequiredPlatformCapabilities || [];
        if (semanticNumber(adminEngine?.Version) < 1_000_002
          || !adminCode.includes('V8.Method.ManageSysUserAdmin')
          || !adminCode.includes('platform-user-custom-hook')
          || !adminCode.includes('authorization.DataAppend.ChangesPassword === true')
          || !capabilities.includes('ApiEngine:platform-sys-user-admin@v1.0.2')) {
          throw new Error(`${name} 缺少 v6.3.2 系统账号 Managed v1.0.2 改密安全契约。`);
        }
      }
    }
    if (name === 'app.microi.saas-engine.json') {
      for (const key of [
        'platform-create-tenant',
        'platform-external-login-binding',
        'platform-wechat-user-binding',
        'platform-service-health',
        'microi-init',
        'mci-system-observability-action',
        'platform-data-source-run',
        'platform-module-data',
        'platform-ocr-recognize',
        'platform-office-export-word-by-template',
        'platform-translate-runtime',
        'platform-user-behavior-signal',
      ]) {
        if (!packageEngineMap.has(key)) throw new Error(`${name} 缺少 ${key}。`);
      }
      for (const duplicateKey of ['platform-user-update-preferences', 'platform-sys-user-admin', 'platform-sys-menu']) {
        if (packageEngineMap.has(duplicateKey)) throw new Error(`${name} 仍包含应由其他官方应用唯一交付的 ${duplicateKey}。`);
      }
      if (semanticNumber(packageModel?.PackageInfo?.Version) < 7_007_001) {
        throw new Error(`${name} 低于 v7.7.1。`);
      }
      const serviceHealth = packageEngineMap.get('platform-service-health');
      const serviceHealthCode = String(serviceHealth?.ApiV8Code || '');
      const requiredCapabilities = packageModel?.PackageInfo?.RequiredPlatformCapabilities || [];
      if (semanticNumber(serviceHealth?.Version) < 1_000_001
        || String(serviceHealth?.ApiAddress || '') !== '/apiengine/platform-service-health'
        || Number(serviceHealth?.IsEnable) !== 1
        || Number(serviceHealth?.StopHttp) !== 0
        || Number(serviceHealth?.AllowAnonymous) !== 1
        || !serviceHealthCode.includes("Status: 'Healthy'")
        || !serviceHealthCode.includes('V8.Method.GetBackendVersion()')
        || !serviceHealthCode.includes('catch (versionError)')
        || /V8\.(?:Db|FormEngine)/.test(serviceHealthCode)
        || serviceHealthCode.includes('platform-runtime-custom-hook')
        || packageModel?.ResourcePolicies?.ApiEngines?.['platform-service-health']?.UpgradePolicy !== 'Managed'
        || !requiredCapabilities.includes('V8.Method.GetBackendVersion')
        || !requiredCapabilities.includes('ApiEngine:platform-service-health')) {
        throw new Error(`${name} 缺少固定匿名服务健康与后端版本契约。`);
      }
      const controllerSlimFacades = new Map([
        ['mci-system-observability-action', 'V8.Method.ManageSystemObservability'],
        ['platform-data-source-run', 'V8.Method.RunDataSourceEngine'],
        ['platform-module-data', 'V8.Method.RunModuleEngine'],
        ['platform-ocr-recognize', 'V8.OCR.Recognize'],
        ['platform-office-export-word-by-template', 'V8.Method.ExportWordByTemplate'],
        ['platform-translate-runtime', 'V8.TranslateEngine'],
        ['platform-user-behavior-signal', 'V8.Method.TrackUserBehavior'],
      ]);
      for (const [key, runtimeMarker] of controllerSlimFacades) {
        const engine = packageEngineMap.get(key);
        const source = String(engine?.ApiV8Code || '');
        if (Number(engine?.IsEnable) !== 1
          || Number(engine?.StopHttp) !== 0
          || packageModel?.ResourcePolicies?.ApiEngines?.[key]?.UpgradePolicy !== 'Managed'
          || !source.includes(runtimeMarker)
          || !source.includes('platform-runtime-custom-hook')
          || !requiredCapabilities.includes(`ApiEngine:${key}`)) {
          throw new Error(`${name} 缺少 Controller 瘦身托管接口契约：${key}。`);
        }
      }
      const officeFacade = packageEngineMap.get('platform-office-export-word-by-template');
      if (Number(officeFacade?.ResponseFile) !== 1 || String(officeFacade?.ResponseType) !== 'File') {
        throw new Error(`${name} 的 Word 模板接口必须保持文件响应契约。`);
      }
      const legacyInit = packageEngineMap.get('microi-init');
      const legacyInitCode = String(legacyInit?.ApiV8Code || '');
      if (semanticNumber(legacyInit?.Version) < 2_000_002
        || !legacyInitCode.includes('GetCurrentToken(rawToken, osClient)')
        || !legacyInitCode.includes('RefreshLoginUser(')
        || !legacyInitCode.includes('GetLegacyInitMenuTree(rawToken, osClient)')
        || !legacyInitCode.includes('safeCurrentUserProjection')
        || !legacyInitCode.includes('DataAppend: { OsClient: osClient }')
        || legacyInitCode.includes('GetFormData({')
        || legacyInitCode.includes('GetTableDataTree')) {
        throw new Error(`${name} 缺少安全 microi-init v2.0.2 契约。`);
      }
    }
    if (name === 'app.microi.store.json') {
      for (const key of ['platform-marketplace-source', 'platform-marketplace-source-hook']) {
        if (!packageEngineMap.has(key)) throw new Error(`${name} 缺少 ${key}。`);
      }
      for (const duplicateKey of ['platform-user-update-preferences', 'platform-sys-user-admin']) {
        if (packageEngineMap.has(duplicateKey)) {
          throw new Error(`${name} 仍包含系统账号应用唯一拥有的 ${duplicateKey}。`);
        }
      }
    }
    if (name === 'app.microi.saas-engine.json') {
      const bundle = Array.isArray(packageModel.ApplicationBundles)
        ? packageModel.ApplicationBundles[0]
        : null;
      const buildAssets = Array.isArray(bundle?.BuildAssets) ? bundle.BuildAssets : [];
      const buildBytes = buildAssets.reduce((sum, asset) => sum + (Number(asset?.Size) || 0), 0);
      const bundleVersion = String(bundle?.VersionNo || '').replace(/^v/i, '').split('.').map(item => Number(item) || 0);
      const bundleVersionNumber = (bundleVersion[0] || 0) * 1_000_000
        + (bundleVersion[1] || 0) * 1_000
        + (bundleVersion[2] || 0);
      let backupButton = null;
      for (const menu of packageModel.SysMenus || []) {
        try {
          const buttons = typeof menu.PageBtns === 'string' ? JSON.parse(menu.PageBtns) : menu.PageBtns;
          backupButton = (Array.isArray(buttons) ? buttons : []).find(button => button?.Id === 'database-backup-page-btn') || backupButton;
        } catch { /* 单个旧菜单不影响目标按钮定位 */ }
      }
      if (packageModel?.PackageInfo?.IncludeSource !== false
        || bundle?.IncludeSource !== false
        || (Array.isArray(bundle?.SourceFiles) && bundle.SourceFiles.length > 0)
        || bundle?.PackageAssets?.SourceZip
        || bundle?.MicroService?.StorageMode !== 'db'
        || bundle?.AssetStoragePolicy?.Source !== 'NotIncluded'
        || bundle?.AssetStoragePolicy?.Build !== 'DatabaseOnly'
        || buildAssets.length < 1
        || buildAssets.length > 256
        || buildBytes > 5 * 1024 * 1024
        || bundleVersionNumber < 1_006_000
        || !String(backupButton?.V8Code || '').includes("Width: '80%'")
        || !String(backupButton?.V8Code || '').includes('BodyHeight:')) {
        throw new Error(`${name} 必须以 v1.6.0+、无伪源码、256 文件/5MB 内的 DatabaseOnly 平台内置微服务发布，并保留数据库备份 80% 统一弹层契约`);
      }
    }
    if (name === 'app.microi.store.json') {
      const version = String(packageModel?.PackageInfo?.Version || '').replace(/^v/i, '');
      const versionParts = version.split('.').map(item => Number(item) || 0);
      const versionNumber = (versionParts[0] || 0) * 1_000_000
        + (versionParts[1] || 0) * 1_000
        + (versionParts[2] || 0);
      const expectedTabs = ['平台应用', '我安装的应用', '我发布的应用', 'UniApp', 'Web', '微服务'];
      const menus = Array.isArray(packageModel?.SysMenus) ? packageModel.SysMenus : [];
      const tabbedMenuIds = new Set([
        '01KXFSG8153B3VZPZ45WNCCFHR',
        '01KXFSG7MZ40CY8KCWCZZZJH2M',
        '61b7faee-35b2-4571-add2-5231a355f368',
      ]);
      const tabbedMenus = menus.filter(menu => tabbedMenuIds.has(String(menu?.Id || '')));
      const menuTabsValid = tabbedMenus.length === tabbedMenuIds.size && tabbedMenus.every(menu => {
        try {
          const tabs = typeof menu.PageTabs === 'string' ? JSON.parse(menu.PageTabs) : menu.PageTabs;
          const names = Array.isArray(tabs) ? tabs.map(tab => tab.Name) : [];
          return names.length === expectedTabs.length
            && names.every((tabName, index) => (
              index === 1
                ? ['我安装的应用', '已安装'].includes(tabName)
                : tabName === expectedTabs[index]
            ));
        } catch {
          return false;
        }
      });
      const uploadAuditMenuId = 'a3000100-0000-4000-8000-000000000100';
      const uploadAuditMenu = menus.find(menu => String(menu?.Id || '') === uploadAuditMenuId);
      const uploadAuditMenuValid = Boolean(uploadAuditMenu)
        && String(uploadAuditMenu.ModuleEngineKey || '') === 'application-asset-upload-audit'
        && Number(uploadAuditMenu.Display) === 1
        && Number(uploadAuditMenu.AppDisplay) === 0
        && String(uploadAuditMenu.SqlWhere || '').includes('ApplicationAssetMultipartSession');
      const menuTabDiagnostics = menus.map(menu => {
        try {
          const tabs = typeof menu.PageTabs === 'string' ? JSON.parse(menu.PageTabs) : menu.PageTabs;
          return {
            id: menu.Id || '',
            name: menu.Name || '',
            pageTabsType: typeof menu.PageTabs,
            names: Array.isArray(tabs) ? tabs.map(tab => tab.Name) : [],
          };
        } catch (error) {
          return { id: menu.Id || '', name: menu.Name || '', error: error.message };
        }
      });
      const fields = Array.isArray(packageModel?.DiyFields) ? packageModel.DiyFields : [];
      const applicationType = fields.find(field => field.Name === 'ApplicationType');
      const applicationTypeOptions = String(applicationType?.Data || '');
      const engines = Array.isArray(packageModel?.SysApiEngines) ? packageModel.SysApiEngines : [];
      const buildZipEngine = engines.find(engine => engine.ApiEngineKey === 'ai_app_download_build_zip');
      const sourceZipEngine = engines.find(engine => engine.ApiEngineKey === 'ai_app_download_source_zip');
      const importerEngine = engines.find(engine => engine.ApiEngineKey === 'import-microi-store-package');
      const publisherEngine = engines.find(engine => engine.ApiEngineKey === 'ai_app_publish_store');
      const prepareAssetsEngine = engines.find(engine => engine.ApiEngineKey === 'ai_app_prepare_store_assets');
      const bulkEngine = engines.find(engine => engine.ApiEngineKey === 'bulk-import-microi-store-packages');
      const backgroundTaskEngine = engines.find(engine => engine.ApiEngineKey === 'platform-background-task');
      const sysMenuEngine = engines.find(engine => engine.ApiEngineKey === 'platform-sys-menu');
      const marketplaceSourceEngine = engines.find(engine => engine.ApiEngineKey === 'platform-marketplace-source');
      const marketplaceSourceHook = engines.find(engine => engine.ApiEngineKey === 'platform-marketplace-source-hook');
      const officialResourceEngine = engines.find(engine => engine.ApiEngineKey === 'get-microi-upgrade-resource');
      const listEngine = engines.find(engine => engine.ApiEngineKey === 'get-microi-store');
      const modelEngine = engines.find(engine => engine.ApiEngineKey === 'get-microi-store-model');
      const versionsEngine = engines.find(engine => engine.ApiEngineKey === 'get-microi-store-versions');
      const visibilityField = fields.find(field => field.TableName === 'sys_microistore' && field.Name === 'IsPublic');
      const deprecatedMenuUrls = new Map([
        ['01KXFSG8153B3VZPZ45WNCCFHR', '/microi-store-installed'],
        ['01KXFSG7MZ40CY8KCWCZZZJH2M', '/microi-store-published'],
      ]);
      const deprecatedMenusValid = [...deprecatedMenuUrls].every(([id, url]) => {
        const menu = menus.find(item => String(item?.Id || '') === id);
        return menu && Number(menu.Display) === 0 && Number(menu.AppDisplay) === 0 && String(menu.Url) === url;
      });
      const normalizedMenuUrls = menus.map(menu => String(menu?.Url || '').trim().toLowerCase()).filter(Boolean);
      const menuUrlsUnique = new Set(normalizedMenuUrls).size === normalizedMenuUrls.length;
      const runtimeBundle = (packageModel.ApplicationBundles || [])
        .find(item => item?.Application?.AppKey === 'microi-platform-service');
      const runtimeTableNames = new Set((packageModel.DiyTables || []).map(item => item?.Name));
      const runtimeBundleValid = Boolean(runtimeBundle)
        && runtimeBundle?.MicroService?.StorageMode === 'db'
        && (runtimeBundle?.Routes || []).some(route => route?.RoutePath === '/marketplace')
        && (runtimeBundle?.BuildAssets || []).length > 0
        && runtimeTableNames.has('sys_microiservice')
        && runtimeTableNames.has('sys_microiservice_page');
      const engineVersionNumber = engine => {
        const parts = String(engine?.Version || '')
          .replace(/^v/i, '')
          .split('.')
          .map(item => Number(item) || 0);
        return (parts[0] || 0) * 1_000_000
          + (parts[1] || 0) * 1_000
          + (parts[2] || 0);
      };
      const importerVersion = String(importerEngine?.Version || '').replace(/^v/i, '');
      const importerVersionParts = importerVersion.split('.').map(item => Number(item) || 0);
      const importerVersionNumber = (importerVersionParts[0] || 0) * 1_000_000
        + (importerVersionParts[1] || 0) * 1_000
        + (importerVersionParts[2] || 0);
      const importerCode = String(importerEngine?.ApiV8Code || '');
      if (versionNumber < 7_007_033
        || !content.includes('TargetSysMenuId')
        || !content.includes('01KXFSG7MZ40CY8KCWCZZZJH2M')
        || !content.includes('01KXFSG8153B3VZPZ45WNCCFHR')
        || !content.includes('PublisherTypes')
        || !content.includes('StoreInstallStatus')
        || !menuTabsValid
        || !uploadAuditMenuValid
        || applicationType?.Component !== 'Radio'
        || !applicationTypeOptions.includes('"Key":"Platform"')
        || !applicationTypeOptions.includes('"Key":"UniApp"')
        || !applicationTypeOptions.includes('"Key":"Web"')
        || !applicationTypeOptions.includes('"Key":"MicroService"')
        || engineVersionNumber(buildZipEngine) < 1_002_000
        || !String(buildZipEngine?.ApiV8Code || '').includes('REAL_BUILD_ZIP_ASSETS_V1')
        || engineVersionNumber(sourceZipEngine) < 1_002_000
        || !String(sourceZipEngine?.ApiV8Code || '').includes('SOURCE_ONLY_ZIP_ROOT_V1')
        || importerVersionNumber < 2_005_004
        || !importerCode.includes('API_ENGINE_RESOURCE_BASELINE_V1')
        || !importerCode.includes('JSON_SWITCH_LITERAL_UNQUOTE_V1')
        || !importerCode.includes('MYSQL_BIT_NUMERIC_COMPAT_V1')
        || !importerCode.includes('ADMIN_MENU_PERMISSION_V1')
        || !importerCode.includes('ADMIN_MENU_PERMISSION_PHYSICAL_FALLBACK_V1')
        || !importerCode.includes('ADMIN_MENU_PERMISSION_DB_TIME_V1')
        || !importerCode.includes('TRUSTED_OFFICIAL_PLATFORM_PACKAGE_V1')
        || !importerCode.includes('TRUSTED_EMBEDDED_OFFICIAL_PACKAGE_V1')
        || !importerCode.includes('V8.Method.RequireManagedProtocolContext')
        || !importerCode.includes('PACKAGE_MANAGED_OVERWRITE_V2')
        || !importerCode.includes('PACKAGE_API_ENGINE_IDENTITY_RECONCILIATION_V2')
        || !importerCode.includes('PACKAGE_API_ENGINE_ROUTE_RECLAIM_V1')
        || !importerCode.includes('DATABASE_ONLY_BUILD_ASSETS_V1')
        || !importerCode.includes('MARKETPLACE_PACKAGE_IDENTITY_BINDING_V1')
        || !importerCode.includes('ApplicationAssetDownloadUrls')
        || !importerCode.includes('BACKGROUND_TASK_MONOTONIC_PROGRESS_V1')
        || !importerCode.includes('BACKGROUND_TASK_PERSISTED_PROGRESS_FLOOR_V1')
        || !importerCode.includes('PACKAGE_MENU_RUNTIME_PREFLIGHT_V1')
        || !importerCode.includes('OBJECT_STORAGE_FORBIDDEN')
        || engineVersionNumber(publisherEngine) < 1_009_016
        || !String(publisherEngine?.ApiV8Code || '').includes('buildApiEngineResourcePolicies')
        || !String(publisherEngine?.ApiV8Code || '').includes('OFFICIAL_PLATFORM_API_ENGINE_OWNERSHIP_V1')
        || !String(publisherEngine?.ApiV8Code || '').includes('SharedPublicRuntime')
        || !String(publisherEngine?.ApiV8Code || '').includes('MARKETPLACE_SOURCE_DEFAULT_PRIVATE_V1')
        || !String(publisherEngine?.ApiV8Code || '').includes('MARKETPLACE_IMMUTABLE_INSTALL_SNAPSHOT_V1')
        || !String(publisherEngine?.ApiV8Code || '').includes('MARKETPLACE_CURRENT_PACKAGE_REPAIR_CAS_V1')
        || !String(publisherEngine?.ApiV8Code || '').includes("Build: storeVisibility ? 'PublicHdfs' : 'PrivateHdfs'")
        || engineVersionNumber(prepareAssetsEngine) < 1_002_000
        || !String(prepareAssetsEngine?.ApiV8Code || '').includes('MARKETPLACE_AI_ASSET_VISIBILITY_V1')
        || engineVersionNumber(bulkEngine) < 1_003_009
        || Number(bulkEngine?.IsEnable) !== 1
        || Number(bulkEngine?.StopHttp) !== 0
        || !String(bulkEngine?.ApiV8Code || '').includes('BACKGROUND_TASK_CHECKPOINT_PLAN_V2')
        || !String(bulkEngine?.ApiV8Code || '').includes('BACKGROUND_TASK_TRUSTED_BOOTSTRAP_V1')
        || !String(bulkEngine?.ApiV8Code || '').includes('BULK_CHILD_FAILURE_DETAIL_V1')
        || !String(bulkEngine?.ApiV8Code || '').includes('BULK_PLATFORM_ONLY_PLAN_V1')
        || !String(bulkEngine?.ApiV8Code || '').includes('BULK_BOUNDED_PACKAGE_SLICES_V1')
        || !String(bulkEngine?.ApiV8Code || '').includes('BULK_FAILURE_RECOVERY_DIAGNOSTICS_V1')
        || !String(bulkEngine?.ApiV8Code || '').includes('BULK_STORAGE_FAILURE_RECOVERY_V1')
        || !String(bulkEngine?.ApiV8Code || '').includes('BULK_MONOTONIC_CHILD_PROGRESS_V1')
        || !String(bulkEngine?.ApiV8Code || '').includes('BULK_STRUCTURED_CHILD_ERRORS_V1')
        || !String(bulkEngine?.ApiV8Code || '').includes('BULK_PACKAGE_MANAGED_OVERWRITE_RECOVERY_V1')
        || !String(bulkEngine?.ApiV8Code || '').includes('MARKETPLACE_LIST_ROUTE_FAILOVER_V1')
        || !String(bulkEngine?.ApiV8Code || '').includes('STARTUP_DEPENDENCY_RESOURCE_CLOSURE_V2')
        || !String(bulkEngine?.ApiV8Code || '').includes('STARTUP_DEPENDENCY_PREINSTALL_BOOTSTRAP_V1')
        || !(packageModel?.PackageInfo?.RequiredPlatformCapabilities || [])
          .includes('BackgroundTask:StartupDependencyResourceClosureV2')
        || !(packageModel?.PackageInfo?.RequiredPlatformCapabilities || [])
          .includes('ApiEngine:bulk-import-microi-store-packages@v1.3.9')
        || !(packageModel?.PackageInfo?.RequiredPlatformCapabilities || [])
          .includes('ApiEngine:get-microi-store@v1.4.8')
        || !(packageModel?.PackageInfo?.RequiredPlatformCapabilities || [])
          .includes('Marketplace:DeterministicInstallVersionStateV1')
        || !(packageModel?.PackageInfo?.RequiredPlatformCapabilities || [])
          .includes('Marketplace:ImmutableInstallSnapshotV1')
        || !(packageModel?.PackageInfo?.RequiredPlatformCapabilities || [])
          .includes('Marketplace:CurrentPackageRepairCasV1')
        || !(packageModel?.PackageInfo?.RequiredPlatformCapabilities || [])
          .includes('BackgroundTask:StartupDependencyPreinstallBootstrapV1')
        || !String(bulkEngine?.ApiV8Code || '').includes('prioritizeBootstrapPlan')
        || engineVersionNumber(backgroundTaskEngine) < 1_001_000
        || String(backgroundTaskEngine?.ApiAddress || '') !== '/apiengine/platform-background-task'
        || Number(backgroundTaskEngine?.IsEnable) !== 1
        || Number(backgroundTaskEngine?.StopHttp) !== 0
        || Number(backgroundTaskEngine?.AllowAnonymous) !== 0
        || !String(backgroundTaskEngine?.ApiV8Code || '').includes('V8.Method.ManageBackgroundTask(V8.Param)')
        || packageModel?.ResourcePolicies?.ApiEngines?.['platform-background-task']?.UpgradePolicy !== 'Managed'
        || !(packageModel?.PackageInfo?.RequiredPlatformCapabilities || [])
          .includes('ServerFeature:V8.ManageBackgroundTask')
        || !(packageModel?.PackageInfo?.RequiredPlatformCapabilities || [])
          .includes('ApiEngine:platform-background-task@v1.1.0')
        || engineVersionNumber(sysMenuEngine) < 1_000_001
        || String(sysMenuEngine?.ApiAddress || '') !== '/apiengine/platform-sys-menu'
        || Number(sysMenuEngine?.IsEnable) !== 1
        || Number(sysMenuEngine?.StopHttp) !== 0
        || Number(sysMenuEngine?.AllowAnonymous) !== 0
        || !String(sysMenuEngine?.ApiV8Code || '').includes('V8.Method.ManageSystemDirectory')
        || !String(sysMenuEngine?.ApiV8Code || '').includes("Domain: 'SysMenu'")
        || !String(sysMenuEngine?.ApiV8Code || '').includes("platform-marketplace-source-hook")
        || packageModel?.ResourcePolicies?.ApiEngines?.['platform-sys-menu']?.UpgradePolicy !== 'Managed'
        || !(packageModel?.PackageInfo?.RequiredPlatformCapabilities || [])
          .includes('V8.Method.ManageSystemDirectory')
        || !(packageModel?.PackageInfo?.RequiredPlatformCapabilities || [])
          .includes('ApiEngine:platform-sys-menu@v1.0.1')
        || engineVersionNumber(marketplaceSourceEngine) < 1_000_005
        || Number(marketplaceSourceEngine?.StopHttp) !== 0
        || Number(marketplaceSourceEngine?.AllowAnonymous) !== 0
        || !String(marketplaceSourceEngine?.ApiV8Code || '').includes('MARKETPLACE_LIST_ROUTE_FAILOVER_V2')
        || !String(marketplaceSourceEngine?.ApiV8Code || '').includes('MARKETPLACE_NESTED_JSON_PAYLOAD_V2')
        || !String(marketplaceSourceEngine?.ApiV8Code || '').includes('MARKETPLACE_SOURCE_HEADER_ISOLATION_V1')
        || !String(marketplaceSourceEngine?.ApiV8Code || '').includes("V8.ApiEngine.Run('platform-marketplace-source-hook'")
        || packageModel?.ResourcePolicies?.ApiEngines?.['platform-marketplace-source']?.UpgradePolicy !== 'Managed'
        || !(packageModel?.PackageInfo?.RequiredPlatformCapabilities || [])
          .includes('ApiEngine:platform-marketplace-source@v1.0.5')
        || engineVersionNumber(marketplaceSourceHook) < 1_000_000
        || Number(marketplaceSourceHook?.StopHttp) !== 1
        || !String(marketplaceSourceHook?.ApiV8Code || '').trimEnd().endsWith('return { Code : 1 };')
        || packageModel?.ResourcePolicies?.ApiEngines?.['platform-marketplace-source-hook']?.Ownership !== 'Tenant'
        || packageModel?.ResourcePolicies?.ApiEngines?.['platform-marketplace-source-hook']?.UpgradePolicy !== 'CreateIfMissing'
        || engineVersionNumber(officialResourceEngine) < 1_002_008
        || Number(officialResourceEngine?.AllowAnonymous) !== 1
        || !String(officialResourceEngine?.ApiV8Code || '').includes('V8.Method.AuthorizeOfficialResourcePublish()')
        || packageModel?.ResourcePolicies?.ApiEngines?.['get-microi-upgrade-resource']?.UpgradePolicy !== 'Managed'
        || !(packageModel?.PackageInfo?.RequiredPlatformCapabilities || [])
          .includes('V8.Method.AuthorizeOfficialResourcePublish')
        || !(packageModel?.PackageInfo?.RequiredPlatformCapabilities || [])
          .includes('ApiEngine:get-microi-upgrade-resource@v1.3.3')
        || !(packageModel?.PackageInfo?.RequiredPlatformCapabilities || [])
          .includes('ApiEngine:get-microi-upgrade-resource@v1.3.4')
        || engines.some(engine => engine.ApiEngineKey === 'platform-user-update-preferences')
        || visibilityField?.Component !== 'Switch'
        || String(visibilityField?.DefaultValue) !== '1'
        || !deprecatedMenusValid
        || !menuUrlsUnique
        || !runtimeBundleValid
        || engineVersionNumber(listEngine) < 1_004_000
        || !String(listEngine?.ApiV8Code || '').includes('ownedOnly')
        || !String(listEngine?.ApiV8Code || '').includes('V8.Param.Visibility')
        || !String(listEngine?.ApiV8Code || '').includes('BULK_PLATFORM_BOOTSTRAP_ORDER_V1')
        || engineVersionNumber(modelEngine) < 1_003_000
        || !String(modelEngine?.ApiV8Code || '').includes('MARKETPLACE_PLAIN_OBJECT_STRIP_V1')
        || !String(modelEngine?.ApiV8Code || '').includes('MARKETPLACE_PINNED_INSTALL_SNAPSHOT_V1')
        || !String(modelEngine?.ApiV8Code || '').includes('MARKETPLACE_LEGACY_IMPORTER_HDFS_BRIDGE_V1')
        || !String(modelEngine?.ApiV8Code || '').includes('privateApplicationAssetDownloadUrls')
        || !String(modelEngine?.ApiV8Code || '').includes('ApplicationAssetDownloadUrls')
        || !(packageModel?.PackageInfo?.RequiredPlatformCapabilities || [])
          .includes('Marketplace:PrivateApplicationSourceArchiveV1')
        || !(packageModel?.PackageInfo?.RequiredPlatformCapabilities || [])
          .includes('Marketplace:ApplicationAssetSignedDownloadV1')
        || !(packageModel?.PackageInfo?.RequiredPlatformCapabilities || [])
          .includes('Marketplace:PackageIdentityBindingV1')
        || !(packageModel?.PackageInfo?.RequiredPlatformCapabilities || [])
          .includes('Marketplace:ApplicationBuildVisibilityV1')
        || engineVersionNumber(versionsEngine) < 1_000_000
        || !String(versionsEngine?.ApiV8Code || '').includes('mic_data_version')
        || !importerCode.includes('MARKETPLACE_PRIVATE_SOURCE_CREDENTIAL_V1')
        || !importerCode.includes('StoreVersionId')
        || !content.includes("RunBackground('bulk-import-microi-store-packages'")
        || !content.includes('BULK_QUEUE_PREFLIGHT_DIAGNOSTICS_V1')
        || !content.includes("ApplicationType: 'Platform'")
        || !importerCode.includes('SKIP_MOVE_FOR_REUSED_BUILD_V1')
        || !importerCode.includes('MICRO_APP_PUBLIC_HDFS_PATH_V1')
        || !importerCode.includes('DB_RUNTIME_BUILD_ASSETS_V1')
        || !importerCode.includes('PRUNE_ASSET_IDS_WITH_DELFORM_V1')
        || !importerCode.includes('BACKGROUND_TASK_BOOTSTRAP_READINESS_V1')
        || !importerCode.includes('BACKGROUND_TASK_RUNTIME_SCOPE_V1')
        || !importerCode.includes('SCHEMA_BACKGROUND_CHUNKS_V1')
      || !importerCode.includes('APPLICATION_ASSET_BACKGROUND_CHUNKS_V1')
      || !importerCode.includes('ASSET_METADATA_WITHOUT_SECOND_DECODE_V1')
      || !importerCode.includes('DATASET_INSERT_IF_MISSING_V1')
      || !importerCode.includes('PACKAGE_API_ENGINE_READBACK_V1')
      || !importerCode.includes('MARKETPLACE_INSTALL_STAT_NON_BLOCKING_V2')
      || !importerCode.includes('SKIP_INSTALL_COUNT_WITHOUT_MARKETPLACE_ID_V1')
      || !importerCode.includes('LEGACY_INSTALL_VERSION_IDENTITY_FALLBACK_V1')
      || !importerCode.includes('BACKGROUND_TASK_BOUNDED_PACKAGE_SLICES_V1')
      || !importerCode.includes('MYSQL_ROW_SIZE_OFFPAGE_FALLBACK_V1')
        || !importerCode.includes('PACKAGE_REPLAY_VERSION_GUARD_V2')
        || !importerCode.includes("PackagePointerMode: 'HdfsV1'")
      || !importerCode.includes('ADMIN_MENU_PERMISSION_V1')
      || !importerCode.includes('ADMIN_MENU_PERMISSION_PHYSICAL_FALLBACK_V1')
      || !importerCode.includes('ADMIN_MENU_PERMISSION_DB_TIME_V1')) {
        throw new Error(
          `${name} 版本过旧，或缺少统一商城及严格 SourceZip/BuildZip 资产边界能力：`
          + JSON.stringify({
            versionNumber,
            menuCount: menus.length,
            menuTabsValid,
            uploadAuditMenuValid,
            menuTabDiagnostics,
            applicationTypeComponent: applicationType?.Component || '',
            applicationTypeOptions,
            buildZipVersion: buildZipEngine?.Version || '',
            buildZipMarker: String(buildZipEngine?.ApiV8Code || '').includes('REAL_BUILD_ZIP_ASSETS_V1'),
            sourceZipVersion: sourceZipEngine?.Version || '',
            sourceZipMarker: String(sourceZipEngine?.ApiV8Code || '').includes('SOURCE_ONLY_ZIP_ROOT_V1'),
            importerVersion,
            publisherVersion: publisherEngine?.Version || '',
            bulkVersion: bulkEngine?.Version || '',
            bulkMarker: String(bulkEngine?.ApiV8Code || '').includes('BACKGROUND_TASK_CHECKPOINT_PLAN_V2'),
            bulkTrustedBootstrap: String(bulkEngine?.ApiV8Code || '').includes('BACKGROUND_TASK_TRUSTED_BOOTSTRAP_V1'),
            visibilityFieldComponent: visibilityField?.Component || '',
            visibilityFieldDefault: String(visibilityField?.DefaultValue ?? ''),
            deprecatedMenusValid,
            menuUrlsUnique,
            runtimeBundleValid,
            listVersion: listEngine?.Version || '',
            modelVersion: modelEngine?.Version || '',
            versionsVersion: versionsEngine?.Version || '',
            missingPackageMarkers: [
              'TargetSysMenuId',
              '01KXFSG7MZ40CY8KCWCZZZJH2M',
              '01KXFSG8153B3VZPZ45WNCCFHR',
              'PublisherTypes',
              'StoreInstallStatus',
            ].filter(marker => !content.includes(marker)),
            missingImporterMarkers: [
              'SKIP_MOVE_FOR_REUSED_BUILD_V1',
              'MICRO_APP_PUBLIC_HDFS_PATH_V1',
              'DB_RUNTIME_BUILD_ASSETS_V1',
              'PRUNE_ASSET_IDS_WITH_DELFORM_V1',
              'BACKGROUND_TASK_BOOTSTRAP_READINESS_V1',
              'BACKGROUND_TASK_RUNTIME_SCOPE_V1',
              'SCHEMA_BACKGROUND_CHUNKS_V1',
              'APPLICATION_ASSET_BACKGROUND_CHUNKS_V1',
              'ASSET_METADATA_WITHOUT_SECOND_DECODE_V1',
              'DATASET_INSERT_IF_MISSING_V1',
              'PACKAGE_API_ENGINE_READBACK_V1',
              'API_ENGINE_RESOURCE_BASELINE_V1',
              'PACKAGE_MANAGED_OVERWRITE_V2',
              'PACKAGE_API_ENGINE_IDENTITY_RECONCILIATION_V2',
              'PACKAGE_API_ENGINE_ROUTE_RECLAIM_V1',
              'BACKGROUND_TASK_MONOTONIC_PROGRESS_V1',
              'BACKGROUND_TASK_PERSISTED_PROGRESS_FLOOR_V1',
              'ADMIN_MENU_PERMISSION_PHYSICAL_FALLBACK_V1',
              'ADMIN_MENU_PERMISSION_DB_TIME_V1',
            ].filter(marker => !importerCode.includes(marker)),
          }),
        );
      }
    }
  }
}

function normalizeDownloadedResource(name, data, transportName) {
  if (!data || data.ResourceName !== name || data.Content == null) {
    throw new Error(`${name} ${transportName}响应格式或资源名不正确：${data?.Msg || ''}`);
  }
  const content = typeof data.Content === 'string'
    ? data.Content
    : `${JSON.stringify(data.Content, null, 2)}\n`;
  validateReadableOfficialResource(name, content);
  const downloadedSha256 = createHash('sha256').update(content, 'utf8').digest('hex');
  const reportedSha256 = String(data.Sha256 || '').toLowerCase();
  if (reportedSha256 && reportedSha256 !== downloadedSha256) {
    throw new Error(`${name} ${transportName}返回内容与 Sha256 不一致`);
  }
  return {
    content: canonicalizeResource(name, content),
    sha256: reportedSha256 || downloadedSha256,
    appVersion: String(data.AppVersion || ''),
  };
}

async function downloadViaHttp(name) {
  const response = await fetch(`${endpoint}&Name=${encodeURIComponent(name)}`, {
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`${name} HTTP ${response.status}`);
  const payload = await response.json();
  if (payload?.Code !== 1) {
    throw new Error(`${name} 官方响应格式或资源名不正确：${payload?.Msg || ''}`);
  }
  return normalizeDownloadedResource(name, payload.Data, '官网 HTTP');
}

const readAttempts = Math.max(
  1,
  Number.parseInt(process.env.MICROI_UPGRADE_RESOURCE_READ_ATTEMPTS || '3', 10) || 3,
);
const retryDelayMilliseconds = Math.max(
  0,
  Number.parseInt(process.env.MICROI_UPGRADE_RESOURCE_RETRY_DELAY_MS || '5000', 10) || 5000,
);

let mcpReadAnnouncementPrinted = false;

async function downloadAllOnce() {
  const configuredTransport = String(process.env.MICROI_UPGRADE_RESOURCE_TRANSPORT || 'auto')
    .trim()
    .toLowerCase();
  if (!['auto', 'mcp', 'http'].includes(configuredTransport)) {
    throw new Error('MICROI_UPGRADE_RESOURCE_TRANSPORT 只允许 auto、mcp 或 http');
  }
  const token = String(process.env.MICROI_UPGRADE_RESOURCE_TOKEN || '').trim();
  if (configuredTransport !== 'http') {
    try {
      if (!mcpReadAnnouncementPrinted) {
        process.stdout.write('使用已配置并登录的 microi_itdos MCP 读取官网升级资源并执行三方合并...\n');
        mcpReadAnnouncementPrinted = true;
      }
      const readResult = await readResourcesViaConfiguredMcp(resourceNames, {
        startDirectory: outputDirectory,
      });
      return new Map(resourceNames.map(name => [
        name,
        normalizeDownloadedResource(name, readResult.resources.get(name), 'microi_itdos MCP'),
      ]));
    } catch (error) {
      const canUseCiTokenFallback = configuredTransport === 'auto'
        && token
        && /未找到 \.mcp\.json|已找到 MCP 配置，但其中没有 microi_itdos/.test(error.message);
      if (!canUseCiTokenFallback) throw error;
      process.stderr.write(`未找到 microi_itdos MCP，CI 令牌模式改用官网 HTTP 读取：${error.message}\n`);
    }
  }
  return new Map(await Promise.all(resourceNames.map(async name => [name, await downloadViaHttp(name)])));
}

async function downloadAllWithRetry(stage) {
  let lastError;
  for (let attempt = 1; attempt <= readAttempts; attempt += 1) {
    try {
      return await downloadAllOnce();
    } catch (error) {
      lastError = error;
      if (!isTemporaryOfficialResourceFailure(error) || attempt >= readAttempts) throw error;
      process.stderr.write(
        `官网升级资源${stage}暂时失败（第 ${attempt}/${readAttempts} 次）：${error.message}\n`
        + `${retryDelayMilliseconds / 1000} 秒后重试...\n`,
      );
      await new Promise(resolvePromise => setTimeout(resolvePromise, retryDelayMilliseconds));
    }
  }
  throw lastError;
}

async function readOptional(path) {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function publishResourceBatch(changes, token) {
  if (!token) {
    await publishResourcesViaConfiguredMcp(changes, { startDirectory: outputDirectory });
    return;
  }
  const response = await fetch(publishEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      // Retain the legacy header for older ApiEngine gateways while making the
      // authenticated ASP.NET identity available to V8.CurrentUser.
      Token: token,
      OsClient: 'iTdos',
      apiengine: '1',
    },
    body: JSON.stringify({
      Action: 'PublishBatch',
      Resources: changes.map(item => ({
        Name: item.name,
        Content: item.content,
        ExpectedRemoteSha256: item.expectedRemoteSha256,
      })),
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`发布官网升级资源 HTTP ${response.status}`);
  const payload = await response.json();
  if (payload?.Code !== 1) {
    throw new Error(`发布官网升级资源失败：${payload?.Msg || '未知错误'}`);
  }
}

async function publishResources(changes) {
  const token = String(process.env.MICROI_UPGRADE_RESOURCE_TOKEN || '').trim();
  if (!token) {
    process.stdout.write('未设置 MICROI_UPGRADE_RESOURCE_TOKEN，使用已配置并登录的 microi_itdos MCP 安全发布...\n');
  }
  const batches = planOfficialResourcePublishBatches(changes);
  try {
    for (let index = 0; index < batches.length; index += 1) {
      const batch = batches[index];
      const isControlPlaneBootstrap = batches.length > 1 && index === 0;
      if (isControlPlaneBootstrap) {
        process.stdout.write(
          'official-resource-api.js\t先发布独立控制面并强回读，再由新版控制面验证剩余资源\n',
        );
      }
      await publishResourceBatch(batch, token);
      if (isControlPlaneBootstrap) {
        const expected = batch[0].content;
        const activated = await downloadAllWithRetry('控制面滚动升级回读');
        if (activated.get('official-resource-api.js').content !== expected) {
          throw new Error('官网控制面独立发布后强回读不一致，已停止剩余资源发布');
        }
        process.stdout.write('official-resource-api.js\t新版控制面已激活并通过 SHA 强回读\n');
      }
    }
  } catch (error) {
    const transport = token ? '官网令牌接口' : 'microi_itdos MCP';
    throw new Error(
      `本地合并结果需要写回官网，但${transport}发布失败：${error.message}。`
      + (!token ? '请登录并正确配置官方 iTdos MCP，或设置 MICROI_UPGRADE_RESOURCE_TOKEN 后重试' : ''),
      { cause: error },
    );
  }
}

function buildPublishedApiEngineSnapshots(resources) {
  const seenKeys = new Set();
  return officialApplicationResourceNames.map(name => {
    const resource = resources.get(name);
    const packageModel = JSON.parse(resource.content);
    const engines = Array.isArray(packageModel.SysApiEngines) ? packageModel.SysApiEngines : [];
    const policies = packageModel?.ResourcePolicies?.ApiEngines || {};
    let managedCount = 0;
    let createIfMissingCount = 0;
    const apiEngineKeys = engines.map(engine => {
      const key = String(engine?.ApiEngineKey || '').trim();
      const normalized = key.toLowerCase();
      const policy = policies[key]?.UpgradePolicy;
      if (!normalized || seenKeys.has(normalized)) {
        throw new Error(`官方接口投影存在跨包重复或空 Key：${key || '(空)'}`);
      }
      if (policy === 'Managed') managedCount += 1;
      else if (policy === 'CreateIfMissing') createIfMissingCount += 1;
      else throw new Error(`官方接口投影资源策略无效：${name} -> ${key}`);
      seenKeys.add(normalized);
      return key;
    });
    return {
      name,
      sha256: resource.sha256,
      managedCount,
      createIfMissingCount,
      apiEngineKeys,
      apiEngines: engines.map(engine => ({
        policy: policies[String(engine?.ApiEngineKey || '').trim()]?.UpgradePolicy,
        engine,
      })),
    };
  });
}

function assertPublishedApiEngineReconcileResult(data, snapshots) {
  const expectedKeys = snapshots.flatMap(item => item.apiEngineKeys)
    .map(key => key.toLowerCase())
    .sort();
  const actualKeys = Array.isArray(data?.ApiEngineKeys)
    ? data.ApiEngineKeys.map(key => String(key).toLowerCase()).sort()
    : [];
  const expectedManaged = snapshots.reduce((sum, item) => sum + item.managedCount, 0);
  const expectedHooks = snapshots.reduce((sum, item) => sum + item.createIfMissingCount, 0);
  if (Number(data?.PackageCount) !== snapshots.length
      || Number(data?.ManagedCount) !== expectedManaged
      || Number(data?.CreateIfMissingCount) !== expectedHooks
      || Number(data?.VerifiedApiEngineCount) !== expectedKeys.length
      || JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)
      || !/^[a-f0-9]{64}$/i.test(String(data?.ProjectionSha256 || ''))) {
    throw new Error('官网 live 接口投影回读与九个已发布应用包不一致');
  }
  return data;
}

async function reconcilePublishedApiEngines(resources) {
  const snapshots = buildPublishedApiEngineSnapshots(resources);
  const token = String(process.env.MICROI_UPGRADE_RESOURCE_TOKEN || '').trim();
  let data;
  if (!token) {
    process.stdout.write('资源发布回读完成，使用 microi_itdos MCP 发起独立第二次 live 接口投影...\n');
    const result = await reconcilePublishedApiEnginesViaConfiguredMcp(
      snapshots,
      { startDirectory: outputDirectory },
    );
    data = result;
  } else {
    const response = await fetch(publishEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Token: token,
        OsClient: 'iTdos',
        apiengine: '1',
      },
      body: JSON.stringify({
        Action: 'ReconcilePublishedApiEngines',
        Resources: snapshots.map(item => ({
          Name: item.name,
          ExpectedSha256: item.sha256,
        })),
      }),
      signal: AbortSignal.timeout(180_000),
    });
    if (!response.ok) throw new Error(`官网 live 接口投影 HTTP ${response.status}`);
    const payload = await response.json();
    if (payload?.Code !== 1) {
      throw new Error(`官网 live 接口投影失败：${payload?.Msg || '未知错误'}`);
    }
    data = assertPublishedApiEngineReconcileResult(payload.Data, snapshots);
  }
  data = assertPublishedApiEngineReconcileResult(data, snapshots);
  process.stdout.write(
    `官网 live 接口投影已回读：Managed=${data.ManagedCount}，CreateIfMissing=${data.CreateIfMissingCount}，`
    + `总数=${data.VerifiedApiEngineCount}，sha256=${data.ProjectionSha256}`
    + `${data.RecoveredAfterAmbiguousTimeout ? '（524 后经 MCP 逐项回读确认事务已提交）' : ''}\n`,
  );
}

function printResource(name, content, direction) {
  const sha256 = createHash('sha256').update(content, 'utf8').digest('hex');
  process.stdout.write(
    `${name}\t${Buffer.byteLength(content, 'utf8')} bytes\tsha256=${sha256}\t${direction}\n`,
  );
}

async function readCurrentReleaseVersion() {
  const configured = String(process.env.MICROI_RELEASE_VERSION || '').trim();
  if (configured) return configured;
  try {
    const clientPackage = JSON.parse(
      await readFile(resolve(outputDirectory, '../../../Microi.Client/package.json'), 'utf8'),
    );
    if (clientPackage?.version) return String(clientPackage.version);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  try {
    const upgradeProject = await readFile(resolve(outputDirectory, '../Microi.Upgrade.csproj'), 'utf8');
    const versionMatch = upgradeProject.match(/<Version>([^<]+)<\/Version>/i);
    if (versionMatch) return versionMatch[1].trim();
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  return '';
}

await mkdir(outputDirectory, { recursive: true });
if (process.argv.includes('--synchronize-local')) {
  const packagePath = resolve(outputDirectory, 'app.microi.store.json');
  const packageContent = await readFile(packagePath, 'utf8');
  const standaloneContents = new Map(await Promise.all(
    applicationStoreReplicaMappings.map(async mapping => [
      mapping.resourceName,
      await readFile(resolve(outputDirectory, mapping.resourceName), 'utf8'),
    ]),
  ));
  const synchronized = normalizeOfficialPackageExecutionLimits(
    'app.microi.store.json',
    synchronizeApplicationStoreEngines(packageContent, standaloneContents),
  );
  validateReleaseCandidate('app.microi.store.json', synchronized);
  await writeFile(packagePath, synchronized, 'utf8');
  printResource('app.microi.store.json', synchronized, '同步本地副本');
} else {
  const initializeBase = process.argv.includes('--initialize-base');
  const publish = process.argv.includes('--publish');
  const allowVerifiedOffline = process.argv.includes('--allow-verified-offline');
  const repairBaseFromRemote = process.argv.includes('--repair-base-from-remote');
  const bootstrapMissing = process.argv.includes('--bootstrap-missing');
  if (repairBaseFromRemote && (initializeBase || publish || allowVerifiedOffline)) {
    throw new Error('--repair-base-from-remote 不能与 --initialize-base、--publish 或 --allow-verified-offline 同时使用');
  }
  if (bootstrapMissing) {
    const bootstrapRemoteResources = await downloadAllWithRetry('初始化缺失资源');
    await mkdir(baseDirectory, { recursive: true });
    for (const name of resourceNames) {
      if (await readOptional(resolve(outputDirectory, name)) !== null) continue;
      const content = canonicalizeResource(name, bootstrapRemoteResources.get(name).content);
      validateReleaseCandidate(name, content);
      await writeFile(resolve(outputDirectory, name), content, 'utf8');
      await writeFile(resolve(baseDirectory, name), content, 'utf8');
      printResource(name, content, '从官网初始化新增资源');
    }
  }
  const localResources = new Map();
  const rawLocalResources = new Map();
  const baseResources = new Map();
  for (const name of resourceNames) {
    const rawLocalContent = await readFile(resolve(outputDirectory, name), 'utf8');
    rawLocalResources.set(name, rawLocalContent);
    // OFFICIAL_PACKAGE_RUNTIME_LIMIT_CEILING_V1：共同基线和官网可能仍保留
    // 历史 10000 递归深度。只规范化本地发布候选，让三方合并把 5000
    // 作为真实本地修正写回官网；不能同时规范化远端/基线后把漂移隐藏掉。
    const localContent = normalizeOfficialPackageExecutionLimits(name, rawLocalContent);
    validateReleaseCandidate(name, localContent);
    localResources.set(name, localContent);
    const baseContent = await readOptional(resolve(baseDirectory, name));
    if (baseContent !== null) {
      baseResources.set(name, canonicalizeResource(name, baseContent));
    }
  }
  const rawLocalStandaloneContents = new Map();
  const localStandaloneContents = new Map();
  for (const mapping of applicationStoreReplicaMappings) {
    if (mapping.publishedStandalone) {
      localStandaloneContents.set(mapping.resourceName, localResources.get(mapping.resourceName));
      continue;
    }
    const rawSource = await readFile(resolve(outputDirectory, mapping.resourceName), 'utf8');
    rawLocalStandaloneContents.set(mapping.resourceName, rawSource);
    localStandaloneContents.set(
      mapping.resourceName,
      canonicalizeResource(mapping.resourceName, rawSource),
    );
  }

  let remoteResources;
  try {
    remoteResources = await downloadAllWithRetry('读取');
  } catch (error) {
    if (!allowVerifiedOffline
      || initializeBase
      || !isTemporaryOfficialResourceFailure(error)) {
      throw error;
    }
    verifyOfflineReleaseSafety(resourceNames, localResources, baseResources);
    assertApplicationStoreEnginesSynchronized(
      localResources.get(applicationStorePackageName),
      localStandaloneContents,
    );
    process.stderr.write(
      `\n⚠ 官网升级资源接口在重试后仍暂时不可用；${resourceNames.length} 项本地资源与上次官网成功回读的共同基线完全一致。\n`
      + '  本次仅允许继续后端编译发布：未写入官网、未修改本地资源、未推进共同基线。\n'
      + `  故障原因：${error.message}\n\n`,
    );
    for (const name of resourceNames) {
      printResource(name, localResources.get(name), '已验证离线基线（未实时同步官网）');
    }
    process.exit(0);
  }

  if (repairBaseFromRemote) {
    const remotePackageContent = remoteResources.get(applicationStorePackageName).content;
    const remotePackageModel = JSON.parse(remotePackageContent);
    const remoteEngineKeys = new Set(
      (Array.isArray(remotePackageModel.SysApiEngines) ? remotePackageModel.SysApiEngines : [])
        .map(engine => engine.ApiEngineKey),
    );
    // 共同基线修复用于处理“本地已经新增副本映射、官网尚未首次发布该引擎”的状态。
    // 只校验官网包中真实存在的副本；缺失的新映射必须留给后续三方合并按首次新增规则发布。
    const remoteReplicaMappings = applicationStoreReplicaMappings.filter(
      mapping => remoteEngineKeys.has(mapping.apiEngineKey),
    );
    const remoteStandaloneContents = new Map(
      remoteReplicaMappings.map(mapping => [
        mapping.resourceName,
        mapping.publishedStandalone
          ? remoteResources.get(mapping.resourceName).content
          : getEmbeddedEngineSource(remotePackageContent, mapping.apiEngineKey),
      ]),
    );
    assertApplicationStoreEnginesSynchronized(
      remotePackageContent,
      remoteStandaloneContents,
      remoteReplicaMappings,
    );
    await mkdir(baseDirectory, { recursive: true });
    for (const name of resourceNames) {
      const content = remoteResources.get(name).content;
      await writeFile(resolve(baseDirectory, name), content, 'utf8');
      printResource(name, content, '按官网回读修复共同基线');
    }
    process.exit(0);
  }

  if (initializeBase) {
    for (const name of resourceNames) {
      if (localResources.get(name) !== remoteResources.get(name).content) {
        throw new Error(`${name} 本地与官网尚不一致，不能初始化共同基线`);
      }
    }
    assertApplicationStoreEnginesSynchronized(
      localResources.get(applicationStorePackageName),
      localStandaloneContents,
    );
    await mkdir(baseDirectory, { recursive: true });
    for (const name of resourceNames) {
      await writeFile(resolve(baseDirectory, name), localResources.get(name), 'utf8');
      printResource(name, localResources.get(name), '建立共同基线');
    }
    process.exit(0);
  }

  // A previous publish may have written the local synchronization base before
  // the official CAS write completed. Recover only for a provable append-only
  // package lineage; otherwise selectOfficialPackageMergeBase fails closed.
  const mergeBaseResources = new Map(baseResources);
  for (const name of resourceNames) {
    if (!name.endsWith('.json') || !baseResources.has(name)) continue;
    const selectedBase = selectOfficialPackageMergeBase(
      name,
      baseResources.get(name),
      localResources.get(name),
      remoteResources.get(name).content,
    );
    mergeBaseResources.set(name, selectedBase.content);
    if (selectedBase.recoveredFromAheadBaseline) {
      process.stdout.write(
        `${name}\t检测到未完成发布留下的超前共同基线：官网 ${selectedBase.remoteVersion} → 记录基线 ${selectedBase.baseVersion} → 本地候选 ${selectedBase.localVersion}；已按完整追加历史证明恢复合并基点\n`,
      );
    }
  }

  const replicaBaseReady = mergeBaseResources.has(applicationStorePackageName)
    && publishedApplicationStoreReplicaMappings.every(mapping => mergeBaseResources.has(mapping.resourceName));
  let replicaMerge = null;
  if (replicaBaseReady) {
    replicaMerge = await mergeApplicationStoreReplicas({
      basePackageContent: mergeBaseResources.get(applicationStorePackageName),
      localPackageContent: localResources.get(applicationStorePackageName),
      remotePackageContent: remoteResources.get(applicationStorePackageName).content,
      baseStandaloneContents: mergeBaseResources,
      localStandaloneContents,
      remoteStandaloneContents: new Map(
        publishedApplicationStoreReplicaMappings.map(mapping => [
          mapping.resourceName,
          remoteResources.get(mapping.resourceName).content,
        ]),
      ),
    });
  }

  const mergedResources = new Map();
  for (const name of resourceNames) {
    if (replicaMerge && name === applicationStorePackageName) {
      mergedResources.set(name, replicaMerge.packageContent);
      continue;
    }
    const publishedReplica = publishedApplicationStoreReplicaMappings
      .find(mapping => mapping.resourceName === name);
    if (replicaMerge && publishedReplica) {
      mergedResources.set(name, replicaMerge.standaloneContents.get(name));
      continue;
    }

    const localContent = localResources.get(name);
    const remoteContent = remoteResources.get(name).content;
    const baseContent = mergeBaseResources.get(name);
    if (!baseContent) {
      if (localContent !== remoteContent) {
        throw new Error(`${name} 尚无共同基线且本地与官网不同；请先完成人工首次同步，再运行 --initialize-base`);
      }
      mergedResources.set(name, localContent);
      continue;
    }
    mergedResources.set(name, await mergeResource(name, baseContent, localContent, remoteContent));
  }
  if (!replicaMerge) {
    assertApplicationStoreEnginesSynchronized(
      mergedResources.get(applicationStorePackageName),
      localStandaloneContents,
    );
  }
  const resolvedEmbeddedStandaloneContents = new Map(
    applicationStoreReplicaMappings
      .filter(mapping => !mapping.publishedStandalone)
      .map(mapping => [
        mapping.resourceName,
        replicaMerge
          ? replicaMerge.standaloneContents.get(mapping.resourceName)
          : localStandaloneContents.get(mapping.resourceName),
      ]),
  );
  if (process.env.MICROI_UPGRADE_RESOURCE_DEBUG === '1') {
    const digest = value => createHash('sha256').update(value, 'utf8').digest('hex');
    process.stderr.write(`${JSON.stringify({
      resource: 'app.microi.store.json',
      recordedBase: digest(baseResources.get('app.microi.store.json')),
      effectiveMergeBase: digest(mergeBaseResources.get('app.microi.store.json')),
      local: digest(localResources.get('app.microi.store.json')),
      remote: digest(remoteResources.get('app.microi.store.json').content),
      mergedAfterReplicaReconcile: digest(mergedResources.get(applicationStorePackageName)),
    })}\n`);
  }

  let currentReleaseVersion;
  for (const name of resourceNames) {
    let content = normalizeOfficialPackageExecutionLimits(name, mergedResources.get(name));
    if (name.endsWith('.json') && remoteResources.get(name).content !== content) {
      const packageModel = JSON.parse(content);
      const packageVersion = String(packageModel?.PackageInfo?.Version || '');
      const remoteVersion = remoteResources.get(name).appVersion;
      if (remoteVersion && compareSemanticVersions(packageVersion, remoteVersion) <= 0) {
        currentReleaseVersion ??= await readCurrentReleaseVersion();
        const selectedVersion = choosePublishablePackageVersion(
          packageVersion,
          remoteVersion,
          currentReleaseVersion,
        );
        if (!selectedVersion) {
          throw new Error(
            `${name} 内容需要写回官网，但无法根据包版本 ${packageVersion || '(空)'}、当前发布版本 ${currentReleaseVersion || '(未找到)'} 和官网版本 ${remoteVersion} 生成更高的语义版本`,
          );
        }
        // 包内容需要越过官网当前版本时，版本号、结构化日志和历史记录必须
        // 作为一个整体推进，避免生成无法通过自身发布门禁的半成品资源。
        advanceOfficialPackageVersion(packageModel.PackageInfo, selectedVersion);
        content = canonicalizeResource(name, JSON.stringify(packageModel));
        process.stdout.write(`${name}\tPackageInfo.Version 自动提升为 ${selectedVersion}\n`);
      }
    }
    mergedResources.set(name, content);
  }

  const remoteChanges = [];
  for (const name of resourceNames) {
    const content = canonicalizeResource(name, mergedResources.get(name));
    validateReleaseCandidate(name, content);
    mergedResources.set(name, content);
    if (rawLocalResources.get(name) !== content) {
      await writeFile(resolve(outputDirectory, name), content, 'utf8');
    }
    if (remoteResources.get(name).content !== content) {
      remoteChanges.push({
        name,
        content,
        expectedRemoteSha256: remoteResources.get(name).sha256,
      });
    }
  }
  for (const [name, resolvedSource] of resolvedEmbeddedStandaloneContents) {
    if (canonicalizeResource(name, rawLocalStandaloneContents.get(name)) !== resolvedSource) {
      await writeFile(resolve(outputDirectory, name), resolvedSource, 'utf8');
    }
  }

  if (publish) {
    const changedPlatformServicePackages = [
      'app.microi.saas-engine.json',
      'app.microi.store.json',
    ].filter(name => hasPlatformServiceBundleChanged(
      name,
      remoteResources.get(name).content,
      mergedResources.get(name),
    ));
    if (changedPlatformServicePackages.length) {
      await verifyPlatformServiceReleaseSource();
    } else {
      process.stdout.write(
        'microi-platform-service\t两个内置包与官网内容一致，本次仅发布其它资源，跳过唯一源码干净度校验\n',
      );
    }
  }

  if (remoteChanges.length && !publish) {
    throw new Error(
      `已完成三方合并，但有 ${remoteChanges.length} 个资源需要写回官网（${remoteChanges.map(item => item.name).join('、')}）；请检查本地差异后使用 --publish`,
    );
  }
  if (remoteChanges.length) await publishResources(remoteChanges);

  const verifiedRemote = await downloadAllWithRetry('发布后回读');
  for (const name of resourceNames) {
    if (verifiedRemote.get(name).content !== mergedResources.get(name)) {
      throw new Error(`${name} 发布后回读与合并结果不一致，未推进共同基线，且未执行 live 接口投影`);
    }
  }
  if (publish) {
    // 即使本次 remoteChanges=0 也必须执行：新版控制面首次发布时，
    // 正在运行的旧脚本只能写入新源码，只有资源回读后的第二次调用才会运行投影逻辑。
    await reconcilePublishedApiEngines(verifiedRemote);
  }
  await mkdir(baseDirectory, { recursive: true });
  for (const name of resourceNames) {
    const content = mergedResources.get(name);
    await writeFile(resolve(baseDirectory, name), content, 'utf8');
    const localChanged = localResources.get(name) !== content;
    const remoteChanged = remoteResources.get(name).content !== content;
    const direction = localChanged && remoteChanged
      ? '双向合并并已回读'
      : localChanged
        ? '官网→本地并已回读'
        : remoteChanged
          ? '本地→官网并已回读'
          : '两端一致';
    printResource(name, content, direction);
  }
  for (const [name, resolvedSource] of resolvedEmbeddedStandaloneContents) {
    printResource(name, resolvedSource, '本地独立文件与官网商城包内嵌副本一致');
  }
}
