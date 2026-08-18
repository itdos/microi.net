#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canonicalizeResource,
  isTemporaryOfficialResourceFailure,
  mergeResource,
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
} from './mcp-resource-publisher.mjs';

const resourceNames = [
  'import-package.js',
  'ai-app-publish-store.js',
  'official-resource-api.js',
  'app.microi.form-engine.json',
  'app.microi.module-engine.json',
  'app.microi.saas-engine.json',
  'app.microi.store.json',
];
const endpoint = process.env.MICROI_UPGRADE_RESOURCE_API
  || 'https://api.itdos.com/apiengine/get-microi-upgrade-resource?OsClient=iTdos';
const publishEndpoint = process.env.MICROI_UPGRADE_RESOURCE_PUBLISH_API
  || 'https://api.itdos.com/apiengine/get-microi-upgrade-resource--OsClient--iTdos--';
const outputDirectory = dirname(fileURLToPath(import.meta.url));
const baseDirectory = resolve(outputDirectory, '.resource-sync-base');

function validateReleaseCandidate(name, content) {
  if (!content.trim()) throw new Error(`${name} 内容为空`);
  if (name === 'import-package.js') {
    if (!content.includes('import-microi-store-package')) {
      throw new Error(`${name} 缺少 import-microi-store-package`);
    }
    const versionMatch = content.match(/Version\s*:\s*v?(\d+)\.(\d+)\.(\d+)/i);
    const versionNumber = versionMatch
      ? Number(versionMatch[1]) * 1_000_000 + Number(versionMatch[2]) * 1_000 + Number(versionMatch[3])
      : 0;
    if (versionNumber < 1_010_011
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
      || !content.includes('TENANT_API_ENGINE_POLICY_IMMUTABLE_V1')
      || !content.includes('MARKETPLACE_INSTALL_STAT_STRING_RESPONSE_V1')
      || !content.includes('SKIP_INSTALL_COUNT_WITHOUT_MARKETPLACE_ID_V1')
      || !content.includes('LEGACY_INSTALL_VERSION_IDENTITY_FALLBACK_V1')
      || !content.includes('BULK_SMALL_PACKAGE_SINGLE_SLICE_V1')
      || !content.includes('MYSQL_ROW_SIZE_OFFPAGE_FALLBACK_V1')
      || !content.includes('LEGACY_SWITCH_BOOLEAN_TEXT_V1')
      || !content.includes('JSON_SWITCH_LITERAL_UNQUOTE_V1')
      || !content.includes('MYSQL_BIT_NUMERIC_COMPAT_V1')
      || !content.includes('ADMIN_MENU_PERMISSION_V1')
      || !content.includes('ADMIN_MENU_PERMISSION_PHYSICAL_FALLBACK_V1')
      || !content.includes('ADMIN_MENU_PERMISSION_DB_TIME_V1')
      || !content.includes('TRUSTED_OFFICIAL_PLATFORM_PACKAGE_V1')
      || !content.includes('PLATFORM_API_ENGINE_PRESERVE_NEWER_V1')
      || !content.includes('DATABASE_ONLY_BUILD_ASSETS_V1')
      || !content.includes('BACKGROUND_TASK_MONOTONIC_PROGRESS_V1')
      || !content.includes('BACKGROUND_TASK_PERSISTED_PROGRESS_FLOOR_V1')
      || !content.includes('OBJECT_STORAGE_FORBIDDEN')) {
      throw new Error(`${name} 低于 v1.10.11 或缺少跨分片累计结果、不可变共享公共运行时、远程 ZIP 单资产安全分片、跨数据库权限时间、共享任务进度下限、旧租户权限物理表兼容、单调后台进度、对象存储可行动诊断、受限数据库内联运行、可信官方平台资源较新版本保护及统一应用商城能力，拒绝降级本地基线`);
    }
  }
  if (name === 'ai-app-publish-store.js') {
    const versionMatch = content.match(/Version\s*:\s*v?(\d+)\.(\d+)\.(\d+)/i);
    const versionNumber = versionMatch
      ? Number(versionMatch[1]) * 1_000_000 + Number(versionMatch[2]) * 1_000 + Number(versionMatch[3])
      : 0;
    if (!content.includes('ai_app_publish_store')
      || versionNumber < 1_007_008
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
      || !content.includes('SharedPublicRuntime')) {
      throw new Error(`${name} 缺少 v1.7.8 不可变共享公共运行时、官方平台接口引擎所有权、统一应用商城、历史 BuildLog 兼容入口、严格源码/编译分根目录及自包含 PackageOnly 能力`);
    }
  }
  if (name === 'official-resource-api.js') {
    if (!content.includes('ApiEngineKey: get-microi-upgrade-resource')
      || !content.includes('ExpectedRemoteSha256')
      || !content.includes('function lockPublishRows()')
      || (content.match(/FOR UPDATE/g) || []).length !== 2
      || !content.includes('发布升级资源[')
      || !content.includes('后回读内容哈希不一致')) {
      throw new Error(`${name} 缺少固定白名单、SHA 乐观锁、事务行锁或发布后回读保护`);
    }
  }
  if (name.endsWith('.json')) {
    const packageModel = JSON.parse(content);
    const expectedNames = {
      'app.microi.form-engine.json': '表单引擎',
      'app.microi.module-engine.json': '模块引擎',
      'app.microi.saas-engine.json': 'SaaS引擎',
      'app.microi.store.json': '应用商城',
    };
    if (packageModel?.PackageInfo?.Name !== expectedNames[name]) {
      throw new Error(`${name} 的 PackageInfo.Name 不正确`);
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
      const bulkEngine = engines.find(engine => engine.ApiEngineKey === 'bulk-import-microi-store-packages');
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
      if (versionNumber < 7_004_002
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
        || importerVersionNumber < 1_010_011
        || !importerCode.includes('API_ENGINE_RESOURCE_BASELINE_V1')
        || !importerCode.includes('TENANT_API_ENGINE_POLICY_IMMUTABLE_V1')
        || !importerCode.includes('JSON_SWITCH_LITERAL_UNQUOTE_V1')
        || !importerCode.includes('MYSQL_BIT_NUMERIC_COMPAT_V1')
        || !importerCode.includes('ADMIN_MENU_PERMISSION_V1')
        || !importerCode.includes('ADMIN_MENU_PERMISSION_PHYSICAL_FALLBACK_V1')
        || !importerCode.includes('ADMIN_MENU_PERMISSION_DB_TIME_V1')
        || !importerCode.includes('TRUSTED_OFFICIAL_PLATFORM_PACKAGE_V1')
        || !importerCode.includes('PLATFORM_API_ENGINE_PRESERVE_NEWER_V1')
        || !importerCode.includes('DATABASE_ONLY_BUILD_ASSETS_V1')
        || !importerCode.includes('BACKGROUND_TASK_MONOTONIC_PROGRESS_V1')
        || !importerCode.includes('BACKGROUND_TASK_PERSISTED_PROGRESS_FLOOR_V1')
        || !importerCode.includes('PACKAGE_MENU_RUNTIME_PREFLIGHT_V1')
        || !importerCode.includes('OBJECT_STORAGE_FORBIDDEN')
        || engineVersionNumber(publisherEngine) < 1_007_008
        || !String(publisherEngine?.ApiV8Code || '').includes('buildApiEngineResourcePolicies')
        || !String(publisherEngine?.ApiV8Code || '').includes('OFFICIAL_PLATFORM_API_ENGINE_OWNERSHIP_V1')
        || !String(publisherEngine?.ApiV8Code || '').includes('SharedPublicRuntime')
        || engineVersionNumber(bulkEngine) < 1_001_006
        || Number(bulkEngine?.IsEnable) !== 1
        || Number(bulkEngine?.StopHttp) !== 0
        || !String(bulkEngine?.ApiV8Code || '').includes('BACKGROUND_TASK_CHECKPOINT_PLAN_V2')
        || !String(bulkEngine?.ApiV8Code || '').includes('BACKGROUND_TASK_TRUSTED_BOOTSTRAP_V1')
        || !String(bulkEngine?.ApiV8Code || '').includes('BULK_CHILD_FAILURE_DETAIL_V1')
        || !String(bulkEngine?.ApiV8Code || '').includes('BULK_PLATFORM_ONLY_PLAN_V1')
        || !String(bulkEngine?.ApiV8Code || '').includes('BULK_ADAPTIVE_SINGLE_SLICE_V1')
        || !String(bulkEngine?.ApiV8Code || '').includes('BULK_FAILURE_RECOVERY_DIAGNOSTICS_V1')
        || !String(bulkEngine?.ApiV8Code || '').includes('BULK_STORAGE_FAILURE_RECOVERY_V1')
        || !String(bulkEngine?.ApiV8Code || '').includes('BULK_MONOTONIC_CHILD_PROGRESS_V1')
        || !String(bulkEngine?.ApiV8Code || '').includes('BULK_STRUCTURED_CHILD_ERRORS_V1')
        || visibilityField?.Component !== 'Switch'
        || String(visibilityField?.DefaultValue) !== '1'
        || !deprecatedMenusValid
        || !menuUrlsUnique
        || !runtimeBundleValid
        || engineVersionNumber(listEngine) < 1_004_000
        || !String(listEngine?.ApiV8Code || '').includes('ownedOnly')
        || !String(listEngine?.ApiV8Code || '').includes('V8.Param.Visibility')
        || engineVersionNumber(modelEngine) < 1_002_000
        || !String(modelEngine?.ApiV8Code || '').includes('MARKETPLACE_PLAIN_OBJECT_STRIP_V1')
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
      || !importerCode.includes('MARKETPLACE_INSTALL_STAT_STRING_RESPONSE_V1')
      || !importerCode.includes('SKIP_INSTALL_COUNT_WITHOUT_MARKETPLACE_ID_V1')
      || !importerCode.includes('LEGACY_INSTALL_VERSION_IDENTITY_FALLBACK_V1')
      || !importerCode.includes('BULK_SMALL_PACKAGE_SINGLE_SLICE_V1')
      || !importerCode.includes('MYSQL_ROW_SIZE_OFFPAGE_FALLBACK_V1')
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
              'TENANT_API_ENGINE_POLICY_IMMUTABLE_V1',
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

async function publishResources(changes) {
  const token = String(process.env.MICROI_UPGRADE_RESOURCE_TOKEN || '').trim();
  if (!token) {
    process.stdout.write('未设置 MICROI_UPGRADE_RESOURCE_TOKEN，使用已配置并登录的 microi_itdos MCP 安全发布...\n');
    try {
      await publishResourcesViaConfiguredMcp(changes, { startDirectory: outputDirectory });
      return;
    } catch (error) {
      throw new Error(
        `本地合并结果需要写回官网，但 microi_itdos MCP 发布失败：${error.message}。`
        + '请登录并正确配置官方 iTdos MCP，或设置 MICROI_UPGRADE_RESOURCE_TOKEN 后重试',
        { cause: error },
      );
    }
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
  const synchronized = synchronizeApplicationStoreEngines(packageContent, standaloneContents);
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
    const localContent = canonicalizeResource(name, rawLocalContent);
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
      '\n⚠ 官网升级资源接口在重试后仍暂时不可用；7 项本地资源与上次官网成功回读的共同基线完全一致。\n'
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

  const replicaBaseReady = baseResources.has(applicationStorePackageName)
    && publishedApplicationStoreReplicaMappings.every(mapping => baseResources.has(mapping.resourceName));
  let replicaMerge = null;
  if (replicaBaseReady) {
    replicaMerge = await mergeApplicationStoreReplicas({
      basePackageContent: baseResources.get(applicationStorePackageName),
      localPackageContent: localResources.get(applicationStorePackageName),
      remotePackageContent: remoteResources.get(applicationStorePackageName).content,
      baseStandaloneContents: baseResources,
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
    const baseContent = baseResources.get(name);
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
      base: digest(baseResources.get('app.microi.store.json')),
      local: digest(localResources.get('app.microi.store.json')),
      remote: digest(remoteResources.get('app.microi.store.json').content),
      mergedAfterReplicaReconcile: digest(mergedResources.get(applicationStorePackageName)),
    })}\n`);
  }

  let currentReleaseVersion;
  for (const name of resourceNames) {
    let content = canonicalizeResource(name, mergedResources.get(name));
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
        packageModel.PackageInfo.Version = selectedVersion;
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

  if (remoteChanges.length && !publish) {
    throw new Error(
      `已完成三方合并，但有 ${remoteChanges.length} 个资源需要写回官网（${remoteChanges.map(item => item.name).join('、')}）；请检查本地差异后使用 --publish`,
    );
  }
  if (remoteChanges.length) await publishResources(remoteChanges);

  const verifiedRemote = await downloadAllWithRetry('发布后回读');
  await mkdir(baseDirectory, { recursive: true });
  for (const name of resourceNames) {
    const content = mergedResources.get(name);
    if (verifiedRemote.get(name).content !== content) {
      throw new Error(`${name} 发布后回读与合并结果不一致，未推进共同基线`);
    }
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
