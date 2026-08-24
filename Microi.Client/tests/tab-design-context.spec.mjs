import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
    getTabDiyTableId,
    getTabSysMenuId,
    hydrateTabFormDesignContext
} from '../src/utils/tab-design-context.js';

test('tab design context reads direct menu and form bindings from route metadata', () => {
    const tag = {
        fullPath: '/system-config',
        meta: { Id: 'menu-config', DiyTableId: 'table-config' }
    };
    assert.equal(getTabSysMenuId(tag), 'menu-config');
    assert.equal(getTabDiyTableId(tag), 'table-config');
});

test('tab design context resolves a missing route table binding from sys_menu once', async () => {
    const tag = { fullPath: '/system-config', meta: { Id: 'menu-config' } };
    const cache = {};
    let calls = 0;
    const fetchMenu = async (id) => {
        calls += 1;
        assert.equal(id, 'menu-config');
        return { Code: 1, Data: { DiyTableId: 'table-config', DiyTableName: 'sys_config' } };
    };

    assert.equal(await hydrateTabFormDesignContext(tag, cache, fetchMenu), 'table-config');
    assert.equal(await hydrateTabFormDesignContext(tag, cache, fetchMenu), 'table-config');
    assert.equal(getTabDiyTableId(tag, cache), 'table-config');
    assert.equal(calls, 1);
});

test('TagsView exposes form design only after resolving the bound form and navigates to the designer', async () => {
    const source = await readFile(new URL('../src/layout/components/TagsView/index.vue', import.meta.url), 'utf8');
    assert.match(source, /canShowFormDesign\(selectedTag\)/);
    assert.match(source, /warmupFormDesignContext\(tag\)/);
    assert.match(source, /_SelectFields:\s*\["Id",\s*"DiyTableId",\s*"DiyTableName"\]/);
    assert.match(source, /path:\s*`\/diy\/diy-design\/\$\{diyTableId\}`/);
});
