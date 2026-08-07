import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { createContextMenuController } from '../src/views/webos/utils/context-menu-controller.js';
import {
    isMacWidgetCollection,
    normalizeMacDesktopPages,
} from '../src/views/webos/utils/desktop-menu-layout.js';

const read = relativePath => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

test('context menus remain single-instance and a second right-click reopens at the new point', () => {
    const opened = [];
    const closed = [];
    const controller = createContextMenuController(options => {
        opened.push(options);
        return opened.length;
    }, id => closed.push(id));

    controller.open(null, { follow: [10, 20] });
    controller.open(null, { follow: [20, 30] });
    assert.deepEqual(closed, [1]);

    const event = {
        clientX: 40,
        clientY: 50,
        prevented: false,
        stopped: false,
        preventDefault() { this.prevented = true; },
        stopPropagation() { this.stopped = true; },
        target: {
            closest(selector) {
                return selector === '.ve__layer-contextmenu' ? {} : null;
            },
        },
    };

    const handled = controller.handleDocumentContextMenu(event, currentEvent => {
        controller.open(currentEvent, { follow: [currentEvent.clientX, currentEvent.clientY] });
    });

    assert.equal(handled, true);
    assert.equal(event.prevented, true);
    assert.equal(event.stopped, true);
    assert.deepEqual(closed, [1, 2]);
    assert.deepEqual(opened.at(-1).follow, [40, 50]);
});

test('macOS desktop uses stable auto rows instead of a container-dependent row repeat', () => {
    const source = read('src/views/webos/components/mac/desk.vue');
    assert.match(source, /grid-auto-rows:\s*var\(--icon-size\)/);
    assert.doesNotMatch(source, /grid-template-rows:\s*repeat\(auto-fill,\s*var\(--icon-size\)\)/);
    assert.match(source, /grid-auto-flow:\s*row dense/);
    assert.match(source, /SetModuleList\('macos'/);
});

test('macOS expands widget-only containers while preserving normal menu folders', () => {
    const widgetFolder = {
        Id: 'widgets',
        Name: 'WebOS',
        _Child: [
            { Id: 'clock', IconComponent: '/views/module/today.vue', SizeWidthMac: 2, SizeHeightMac: 1 },
            { Id: 'calendar', IconComponent: '/views/module/calendar4x2.vue', SizeWidthMac: 4, SizeHeightMac: 2 },
            { Id: 'shortcut', Icon: '/shortcut.png', SizeWidthMac: 1, SizeHeightMac: 1 },
        ],
    };
    const normalFolder = {
        Id: 'system',
        Name: '系统管理',
        _Child: [{ Id: 'users', Icon: '/users.png' }],
    };

    assert.equal(isMacWidgetCollection(widgetFolder), true);
    assert.equal(isMacWidgetCollection(normalFolder), false);

    const [page] = normalizeMacDesktopPages([{ Name: '首页', List: [widgetFolder, normalFolder] }]);
    assert.deepEqual(page.List.map(item => item.Id), ['clock', 'calendar', 'shortcut', 'system']);
    assert.equal(page.List[0]._WebosWidgetContainerId, 'widgets');
    assert.equal(page.List[3], normalFolder);
});

test('Windows desktop fills vertical taskbar-style columns and has an isolated cache', () => {
    const source = read('src/views/webos/components/win/desk.vue');
    assert.match(source, /class="microi-windows-desk/);
    assert.match(source, /grid-template-rows:\s*repeat\(auto-fill,\s*100px\)/);
    assert.match(source, /grid-auto-flow:\s*column/);
    assert.match(source, /SetModuleList\('windows'/);
});

test('WebOS toolbar carries the classic-shell quick functions', () => {
    const source = read('src/views/webos/components/Toolbar.vue');
    for (const component of [
        'BackgroundTaskCenter',
        'HeaderSearch',
        'LangSelect',
        'ThemeSelect',
        'DesktopAiAssistant',
        'BluetoothPrinterEntry',
    ]) {
        assert.match(source, new RegExp(`<${component}(?:\\s|\\/)`));
    }
});

test('desktop styles use per-style persisted menus and safe external links', () => {
    const store = read('src/views/webos/store/index.js');
    const macDesk = read('src/views/webos/components/mac/desk.vue');
    const winDesk = read('src/views/webos/components/win/desk.vue');
    assert.match(store, /ModuleListByDesktopType/);
    assert.match(store, /pick:\s*\['SwiperIndex',\s*'ModuleListByDesktopType'/);
    assert.match(macDesk, /'_blank',\s*'noopener,noreferrer'/);
    assert.match(winDesk, /'_blank',\s*'noopener,noreferrer'/);
});
