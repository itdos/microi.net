#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const saasPackagePath = resolve(directory, 'app.microi.saas-engine.json');
const storePackagePath = resolve(directory, 'app.microi.store.json');
const SYSTEM_SETTINGS_MENU_ID = 'ea6b79e8-2c6b-4d0f-9b6a-44d01a3479bf';
const SYSTEM_SETTINGS_TABLE_ID = 'c8570fa6-c10f-4014-8cb4-4b046e7ba69c';
const APP_STORE_MENU_ID = '61b7faee-35b2-4571-add2-5231a355f368';

async function readPackage(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function findMenu(packageModel, id, url) {
  const menu = (packageModel.SysMenus || []).find(item => item.Id === id && item.Url === url);
  if (!menu) throw new Error(`应用包缺少目标模块：${url} (${id})`);
  return menu;
}

function parseViewSchema(menu) {
  const schema = typeof menu.ViewSchema === 'string'
    ? JSON.parse(menu.ViewSchema || '{}')
    : structuredClone(menu.ViewSchema || {});
  if (!Array.isArray(schema.Views)) throw new Error(`${menu.Url} 的 ViewSchema.Views 无效`);
  return schema;
}

function configureSystemSettings(packageModel) {
  const menu = findMenu(packageModel, SYSTEM_SETTINGS_MENU_ID, '/system-config');
  const schema = parseViewSchema(menu);
  const pcList = schema.Views.find(view => view.Scene === 'List' && view.Device === 'PC');
  if (!pcList) throw new Error('系统设置缺少 PC List 视图');
  pcList.Enabled = true;
  pcList.Layout ||= {};
  // 表单工作台配置已经迁移到 diy_table.FormPresentation；模块 ViewSchema 只负责列表/卡片呈现。
  if (String(pcList.Layout.Preset || '').toLowerCase() === 'formworkbench') delete pcList.Layout.Preset;
  delete pcList.Layout.Form;
  menu.ViewSchema = JSON.stringify(schema);
  menu.EnableViewSchema = 1;
  menu.ViewSchemaVersion = '1.0';
  const table = (packageModel.DiyTables || []).find(item => item.Id === SYSTEM_SETTINGS_TABLE_ID);
  if (!table) throw new Error(`应用包缺少系统设置表：${SYSTEM_SETTINGS_TABLE_ID}`);
  table.FormPresentation = JSON.stringify({
    Presentation: 'ControlCenter',
    Density: 'Compact',
    NavigationTitle: '配置分组',
    NavigationCountText: '{count} 项',
    SectionNavigation: 'Auto',
    SectionEyebrow: 'FORM SECTION',
    RequiredCountText: '{count} 必填项',
    OpenFirstRecord: true,
    WorkbenchEyebrow: 'FORM WORKBENCH',
    WorkbenchDescription: '集中维护当前记录的业务信息，原有字段事件、表单事件与权限规则保持不变。',
    NavigationFooterTitle: '',
    NavigationFooterHtml: '',
    RecordSelector: {
      LabelFields: ['PeizhiMC', 'SysTitle', 'ApiBase'],
      Placeholder: '搜索并切换系统配置'
    }
  });
  return { menu, table };
}

function configureMarketplace(packageModel) {
  const menu = findMenu(packageModel, APP_STORE_MENU_ID, '/microi-store');
  menu.OpenType = 'MicroService';
  menu.IsMicroiService = 1;
  menu.ComponentPath = '/micro-app/host';
  menu.MicroServiceKey = 'microi-platform-service';
  menu.MsKey = 'microi-platform-service';
  menu.MicroServiceRoutePath = '/marketplace';
  menu.MicroAppFriendlyUrl = '/micro-app/microi-platform-service/marketplace';
  menu.LegacyMenuUrl = '/microi-store';
  menu.Description = '联邦多源应用商城：支持官方源、当前租户源和任意上游租户源的发布、安装与更新';
  return menu;
}

const saasPackage = await readPackage(saasPackagePath);
const storePackage = await readPackage(storePackagePath);
const systemSettings = configureSystemSettings(saasPackage);
const marketplace = configureMarketplace(storePackage);

await writeFile(saasPackagePath, `${JSON.stringify(saasPackage, null, 2)}\n`, 'utf8');
await writeFile(storePackagePath, `${JSON.stringify(storePackage, null, 2)}\n`, 'utf8');

process.stdout.write(`${JSON.stringify({
  systemSettings: {
    id: systemSettings.menu.Id,
    url: systemSettings.menu.Url,
    formPresentationOwner: 'diy_table.FormPresentation'
  },
  marketplace: {
    id: marketplace.Id,
    url: marketplace.Url,
    openType: marketplace.OpenType,
    microServiceKey: marketplace.MicroServiceKey,
    routePath: marketplace.MicroServiceRoutePath
  }
}, null, 2)}\n`);
