import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = relativePath => readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('action header uses the shared header surface and opens column settings', async () => {
  const source = await read('src/views/form-engine/diy-table.vue');
  const actionLabelIndex = source.indexOf(':label="$t(\'Msg.Action\')"');
  const actionColumnStart = source.lastIndexOf('<el-table-column', actionLabelIndex);
  const actionColumnEnd = source.indexOf('</el-table-column>', actionLabelIndex);
  const actionColumn = source.slice(actionColumnStart, actionColumnEnd + '</el-table-column>'.length);

  assert.ok(actionLabelIndex > -1, 'action column exists');
  assert.match(actionColumn, /:fixed="DosCommon\.isMobile \? false : 'right'"/);
  assert.match(actionColumn, /class-name="row-last-op"/);
  assert.match(actionColumn, /class="col-header-cell action-column-settings-trigger"/);
  assert.match(actionColumn, /<Setting\s*\/>/);
  assert.match(actionColumn, /showColumnSettings\(\$event\)/);
  assert.doesNotMatch(actionColumn, /fa-ellipsis-v/);
  assert.match(source, /class="global-col-header-menu user-column-settings-menu"/);
  assert.match(source, /SelectAllUserTableColumns\(\)/);
  assert.match(source, /InvertUserTableColumns\(\)/);
  assert.match(source, /ResetUserTableColumns\(\)/);
});

test('column settings are immediate, non-blocking and scoped to account plus module', async () => {
  const [ui, data, schema, cleanup] = await Promise.all([
    read('src/views/form-engine/mixins/diy-table-ui.mixin.js'),
    read('src/views/form-engine/mixins/diy-table-data.mixin.js'),
    read('src/views/form-engine/mixins/diy-table-schema.mixin.js'),
    read('src/views/form-engine/mixins/diy-table-cleanup.mixin.js')
  ]);

  assert.match(ui, /USER_TABLE_COLUMN_PREFERENCE_ENGINE/);
  assert.match(ui, /userId:\s*userId/);
  assert.match(ui, /sysMenuId:\s*sysMenuId/);
  assert.match(ui, /ApplyUserTableColumnPreference\(hiddenColumnKeys\)/);
  assert.match(ui, /setTimeout\(function \(\) \{[\s\S]*SaveUserTableColumnPreference\(\);[\s\S]*\}, 450\)/);
  assert.match(ui, /DefaultFieldNames/);
  assert.match(ui, /defaultFieldNames\.indexOf/);
  assert.match(data, /self\.LoadUserTableColumnPreference\(\);[\s\S]*self\.GetDiyTableRow/);
  assert.doesNotMatch(data, /await self\.LoadUserTableColumnPreference/);
  assert.match(schema, /tableFieldPreferenceKey/);
  assert.match(schema, /tableAuditPreferenceKey/);
  assert.match(cleanup, /_columnPreferenceSaveTimer/);
  assert.match(cleanup, /hideColumnSettings/);
});

test('fixed action column keeps normal, striped and hover backgrounds aligned', async () => {
  const [rowStyles, popupStyles] = await Promise.all([
    read('src/views/form-engine/styles/diy-table-rowlist.scss'),
    read('src/styles/diy-table.scss')
  ]);

  assert.match(rowStyles, /\.el-table__header th\.row-last-op[\s\S]*background/);
  assert.match(rowStyles, /tr:not\(\.el-table__row--striped\)[\s\S]*\.row-last-op/);
  assert.match(rowStyles, /\.el-table__row--striped[\s\S]*\.row-last-op/);
  assert.match(rowStyles, /tr:hover[\s\S]*\.row-last-op/);
  assert.match(popupStyles, /\.user-column-settings-menu/);
  assert.match(popupStyles, /\.user-column-settings-list/);
  assert.match(popupStyles, /\.user-column-settings-foot/);
});
