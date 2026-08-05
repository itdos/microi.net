import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
    APK_DESKTOP_STATUSBAR_FLAG,
    MICROI_PHONE_LAYOUT_MAX_WIDTH,
    syncApkDesktopStatusbarInset
} from '../../Microi.Client/src/utils/apk-statusbar-safe-area.js';

const manifest = JSON.parse(
    readFileSync(new URL('../manifest.json', import.meta.url), 'utf8')
);
const launcherSource = readFileSync(
    new URL('../index.html', import.meta.url),
    'utf8'
);
const clientPermissionSource = readFileSync(
    new URL('../../Microi.Client/src/permission.js', import.meta.url),
    'utf8'
);
const clientAppSource = readFileSync(
    new URL('../../Microi.Client/src/App.vue', import.meta.url),
    'utf8'
);

function createAndroidRuntime({ immersed = true, statusbarHeight = 28 } = {}) {
    const styles = [];
    const statusbarStyles = [];
    return {
        styles,
        statusbarStyles,
        runtime: {
            os: { name: 'Android' },
            navigator: {
                isImmersedStatusbar: () => immersed,
                getStatusbarHeight: () => statusbarHeight,
                setStatusBarStyle: (style) => statusbarStyles.push(style)
            },
            webview: {
                currentWebview: () => ({
                    setStyle: (style) => styles.push(style)
                })
            }
        }
    };
}

function createAppWindow(width) {
    return {
        innerWidth: width,
        navigator: { userAgent: 'Mozilla/5.0 Html5Plus/1.0 MicroiApp' }
    };
}

test('APK keeps immersive mode enabled for supported Android devices', () => {
    assert.equal(manifest.plus?.statusbar?.immersed, 'supportedDevice');
    assert.equal(manifest.plus?.statusbar?.style, 'dark');
    assert.equal(manifest.plus?.statusbar?.background, '#FFFFFF');
    assert.equal(manifest.plus?.safearea?.bottom?.offset, 'auto');
});

test('Android phone layout remains immersive at the 768px boundary', () => {
    const fake = createAndroidRuntime();
    const targetWindow = createAppWindow(MICROI_PHONE_LAYOUT_MAX_WIDTH);

    const result = syncApkDesktopStatusbarInset({
        targetWindow,
        plusRuntime: fake.runtime
    });

    assert.deepEqual(result, { active: false, top: 0, reason: 'phone-immersive' });
    assert.deepEqual(fake.styles, [{ top: '0px', bottom: '0px' }]);
    assert.equal(targetWindow[APK_DESKTOP_STATUSBAR_FLAG], false);
    assert.deepEqual(fake.statusbarStyles, []);
});

test('Android tablet PC layout uses the real status bar height and resets after rotation', () => {
    const fake = createAndroidRuntime({ statusbarHeight: 31 });
    const targetWindow = createAppWindow(1280);

    const tabletResult = syncApkDesktopStatusbarInset({
        targetWindow,
        plusRuntime: fake.runtime
    });
    assert.deepEqual(tabletResult, { active: true, top: 31, reason: 'desktop-inset' });
    assert.deepEqual(fake.styles[0], { top: '31px', bottom: '0px' });
    assert.equal(targetWindow[APK_DESKTOP_STATUSBAR_FLAG], true);
    assert.deepEqual(fake.statusbarStyles, ['dark']);

    targetWindow.innerWidth = 390;
    const phoneResult = syncApkDesktopStatusbarInset({
        targetWindow,
        plusRuntime: fake.runtime
    });
    assert.deepEqual(phoneResult, { active: false, top: 0, reason: 'phone-immersive' });
    assert.deepEqual(fake.styles[1], { top: '0px', bottom: '0px' });
    assert.equal(targetWindow[APK_DESKTOP_STATUSBAR_FLAG], false);
});

test('launcher and remote client both apply the same tablet-only breakpoint', () => {
    assert.match(launcherSource, /window\.innerWidth > 768/);
    assert.match(launcherSource, /getStatusbarHeight\(\)/);
    assert.match(launcherSource, /currentWebview\.setStyle\(\{ top: top \+ 'px', bottom: '0px' \}\)/);
    assert.match(clientAppSource, /syncApkDesktopStatusbarInset/);
    assert.match(clientPermissionSource, /__microi_apkDesktopStatusbarInset === true/);
});
