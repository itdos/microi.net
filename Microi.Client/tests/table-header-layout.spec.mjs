import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const read = relativePath => fs.readFileSync(
    fileURLToPath(new URL(`../${relativePath}`, import.meta.url)),
    'utf8',
);

test('diy-table custom headers keep Chinese labels on one line inside configured column widths', () => {
    const table = read('src/views/form-engine/diy-table.vue');
    const styles = read('src/styles/diy-table.scss');

    assert.match(table, /<span class="col-header-label">\{\{ field\.Label \}\}<\/span>/);
    assert.match(table, /<span class="col-header-label">\{\{ \$t\('Msg\.CreateTime'\) \}\}<\/span>/);
    assert.match(table, /<span class="col-header-label">\{\{ \$t\('Msg\.Creator'\) \}\}<\/span>/);
    assert.match(table, /<span class="col-header-label">\{\{ \$t\('Msg\.UpdateTime'\) \}\}<\/span>/);

    assert.match(styles, /\.col-header-cell\s*\{[\s\S]*?flex-wrap:\s*nowrap;[\s\S]*?min-width:\s*0;[\s\S]*?overflow:\s*hidden;[\s\S]*?white-space:\s*nowrap;/);
    assert.match(styles, /\.col-header-label\s*\{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?min-width:\s*0;[\s\S]*?text-overflow:\s*ellipsis;[\s\S]*?white-space:\s*nowrap\s*!important;[\s\S]*?overflow-wrap:\s*normal;[\s\S]*?word-break:\s*keep-all;/);
    assert.match(styles, /\.col-header-sort-indicator\s*\{[\s\S]*?flex:\s*0 0 auto;/);
    assert.match(styles, /\.col-header-menu-icon\s*\{[\s\S]*?flex:\s*0 0 18px;[\s\S]*?width:\s*18px;[\s\S]*?max-width:\s*18px;/);
});

test('header wrapping fix remains generic and the final content column flex-fills the table', () => {
    const table = read('src/views/form-engine/diy-table.vue');
    const uiMixin = read('src/views/form-engine/mixins/diy-table-ui.mixin.js');
    const styles = read('src/styles/diy-table.scss');

    assert.match(table, /:width="GetTableColumnWidth\(field, fieldIndex\)"/);
    assert.match(table, /:min-width="GetTableColumnMinWidth\(field, fieldIndex\)"/);
    assert.match(table, /:width="GetAuditColumnWidth\('UpdateTime', 150\)"/);
    assert.match(table, /:min-width="GetAuditColumnMinWidth\('UpdateTime', 150\)"/);
    assert.match(uiMixin, /GetTableFillColumnKey\(\)[\s\S]*?\["UpdateTime", "UserName", "CreateTime"\][\s\S]*?GetTableColumnWidth\(field, fieldIndex\)[\s\S]*?GetTableColumnMinWidth\(field, fieldIndex\)/);
    assert.doesNotMatch(uiMixin, /fieldIndex\s*==\s*visibleFields\.length\s*-\s*1\)\s*\{\s*return\s+""/);
    assert.doesNotMatch(`${table}\n${styles}`, /(?:^|[^a-z])bwl(?:[^a-z]|$)/i);
});
