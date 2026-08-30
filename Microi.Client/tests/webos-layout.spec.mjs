import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { createContextMenuController } from '../src/views/webos/utils/context-menu-controller.js';
import {
    isMacWidgetCollection,
    normalizeMacDesktopPages,
} from '../src/views/webos/utils/desktop-menu-layout.js';
import { isWebosImageSource } from '../src/views/webos/utils/icon-source.js';
import {
    WEBOS_PERSONAL_CENTER_PATH,
    openWebosPersonalCenter,
} from '../src/views/webos/utils/navigation.js';

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
        stopImmediatePropagation() { this.immediateStopped = true; },
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
    assert.equal(event.immediateStopped, true);
    assert.deepEqual(closed, [1, 2]);
    assert.deepEqual(opened.at(-1).follow, [40, 50]);
});

test('active WebOS context menu suppresses the browser menu when the second click hits a teleported mask', () => {
    const opened = [];
    const controller = createContextMenuController(options => {
        opened.push(options);
        return opened.length;
    }, () => {});
    controller.open(null, { follow: [10, 20] });

    const event = {
        clientX: 80,
        clientY: 90,
        prevented: false,
        stopped: false,
        immediateStopped: false,
        preventDefault() { this.prevented = true; },
        stopPropagation() { this.stopped = true; },
        stopImmediatePropagation() { this.immediateStopped = true; },
        target: { closest() { return null; } },
    };

    const handled = controller.handleDocumentContextMenu(event, currentEvent => {
        controller.open(currentEvent, { follow: [currentEvent.clientX, currentEvent.clientY] });
    });

    assert.equal(handled, true);
    assert.equal(event.prevented, true);
    assert.equal(event.stopped, true);
    assert.equal(event.immediateStopped, true);
    assert.deepEqual(opened.at(-1).follow, [80, 90]);
    assert.equal(opened.at(-1).shade, false);
});

test('WebOS image detection keeps Icon ahead of IconClass for URL variants and private files', () => {
    assert.equal(isWebosImageSource('/icons/app.webp?v=2'), true);
    assert.equal(isWebosImageSource('https://cdn.example.com/app.svg#mark'), true);
    assert.equal(isWebosImageSource('data:image/webp;base64,UklGRg=='), true);
    assert.equal(isWebosImageSource('https://api.example.com/api/HDFS/OpenPrivateFile?o=x&t=y'), true);
    assert.equal(isWebosImageSource('fa-solid fa-gear'), false);
});

test('all WebOS personal-center entries use the classic-shell micro-app route', async () => {
    const pushed = [];
    await openWebosPersonalCenter({ push: path => { pushed.push(path); return Promise.resolve(); } });
    assert.equal(WEBOS_PERSONAL_CENTER_PATH, '/micro-app/microi-platform-service/personal-settings');
    assert.deepEqual(pushed, [WEBOS_PERSONAL_CENTER_PATH]);

    for (const sourcePath of [
        'src/views/webos/components/Toolbar.vue',
        'src/views/webos/components/Touch.vue',
        'src/views/webos/components/mac/desk.vue',
        'src/views/webos/components/win/desk.vue',
    ]) {
        assert.match(read(sourcePath), /openWebosPersonalCenter/);
    }
    assert.doesNotMatch(read('src/views/webos/components/Toolbar.vue'), /<DiyForm/);
});

test('WebOS widget static backgrounds are present and theme variables are wired', () => {
    for (const asset of [
        'public/static/img/dayworld.jpeg',
        'public/static/img/22831288_700x700.jpeg',
        'public/static/img/logo.svg',
    ]) {
        assert.equal(fs.existsSync(path.join(process.cwd(), asset)), true, asset);
    }
    const styles = read('src/views/webos/styles/webos.scss');
    assert.match(styles, /--webos-folder-bg/);
    assert.match(styles, /--webos-chat-surface/);
    assert.match(styles, /\.webos-diy-chat/);
    assert.match(styles, /background:\s*var\(--webos-chat-surface\)/);
    assert.match(styles, /--mci-color-primary-rgb/);
    assert.match(styles, /html\[data-theme='dark'\]/);

    const desktop = read('src/views/webos/layouts/desktop.vue');
    assert.match(desktop, /document\.body\.classList\.remove\('Classic'\)/);
    assert.match(desktop, /document\.body\.classList\.add\('WebOS'\)/);
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
    assert.match(source, /grid-template-rows:\s*repeat\(auto-fill,\s*96px\)/);
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
    assert.match(source, /diyStore\.DiyChat/);
    assert.match(source, /<LangSelect[^>]+compact/);
    assert.match(source, /openWebosPersonalCenter/);
    assert.match(source, /\.webos-quick-actions :deep\(\.el-icon svg\)/);
    const avatarRule = source.match(/\.wavatar\s*\{([\s\S]*?)\n\}/)?.[1] || '';
    assert.match(avatarRule, /background:\s*transparent/);
    assert.match(avatarRule, /border:\s*0/);
});

test('Dock replaces PNG menu artwork with centered theme-aware SVG and reserves hover headroom', () => {
    for (const sourcePath of [
        'src/views/webos/components/mac/dock.vue',
        'src/views/webos/components/win/dock.vue',
    ]) {
        const source = read(sourcePath);
        assert.match(source, /import ThemeMenuIcon/);
        assert.match(source, /<ThemeMenuIcon :item="item" mode="theme"/);
        assert.match(source, /<ThemeMenuIcon :item="task" mode="theme"/);
        assert.doesNotMatch(source, /GetFileServerUrl\((?:item|task)\.Icon\)/);
        assert.doesNotMatch(source, /hasImageIcon\((?:item|task)\)/);
    }
    const macDock = read('src/views/webos/components/mac/dock.vue');
    assert.match(macDock, /min-height:\s*78px/);
    assert.match(macDock, /transform:\s*scale\(1\.13\) translateY\(-3px\)/);
});

test('desktop styles use per-style persisted menus and safe external links', () => {
    const store = read('src/views/webos/store/index.js');
    const macDesk = read('src/views/webos/components/mac/desk.vue');
    const winDesk = read('src/views/webos/components/win/desk.vue');
    assert.match(store, /ModuleListByDesktopType/);
    assert.match(store, /pick:\s*\['SwiperIndex',\s*'ModuleListByDesktopType'/);
    assert.match(macDesk, /openSafeExternalUrl\(item\.Url\)/);
    assert.match(winDesk, /openSafeExternalUrl\(item\.Url\)/);
    const navigation = read('src/views/webos/utils/navigation.js');
    assert.match(navigation, /\['http:', 'https:'\]/);
    assert.match(navigation, /'_blank', 'noopener,noreferrer'/);
});

test('macOS and Windows force table forms into managed dialogs with table-defined width', () => {
    const table = read('src/views/form-engine/diy-table.vue');
    const form = read('src/views/form-engine/diy-form-full.vue');
    const dialogMixin = read('src/views/form-engine/mixins/diy-form-full-dialog.mixin.js');
    const adapter = read('src/views/webos/utils/v8-adapter.js');
    const manager = read('src/views/webos/components/WindowManager.vue');

    assert.match(table, /isWebosDesktopWindow[\s\S]*?\? "Dialog"/);
    assert.match(table, /Width:\s*self\.CurrentDiyTableModel\.FormOpenWidth \|\| "80%"/);
    assert.match(form, /:append-to-body="true"/);
    assert.match(form, /:modal-append-to-body="true"/);
    assert.match(form, /:fullscreen="IsWebosWindowMaximized\(\)"/);
    assert.match(form, /class="diy-form-webos-restore"/);
    assert.match(form, /class="diy-form-webos-window-controls"/);
    assert.match(dialogMixin, /WebosMinimizeFormWindow\(\)[\s\S]*?this\.WebosFormMinimized = true/);
    assert.match(dialogMixin, /WebosToggleMaximizeFormWindow\(\)[\s\S]*?this\.WebosFormMaximized = !this\.WebosFormMaximized/);
    assert.doesNotMatch(dialogMixin, /\$webosWindow\?\.(?:minimize|toggleMaximize)/);
    assert.match(adapter, /_SelectFields:\s*\['Id', 'FormOpenType', 'FormOpenWidth'\]/);
    assert.match(adapter, /menu\.FormOpenWidth = table\.FormOpenWidth \|\| '80%'/);
    assert.match(manager, /isCurrentUserAdmin\.value && isWebosDesignerRouteForMenu/);
});
