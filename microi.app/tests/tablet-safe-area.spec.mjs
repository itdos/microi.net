import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
    APK_DESKTOP_STATUSBAR_DIAGNOSTICS,
    APK_DESKTOP_STATUSBAR_FALLBACK,
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

function createAndroidRuntime({
    immersed = true,
    statusbarHeight = 28,
    safeAreaTop = 0,
    nativeInsetPixels = 0,
    nativeResourcePixels = 0,
    scale = 1
} = {}) {
    const styles = [];
    const statusbarStyles = [];
    const nativeWebview = {};
    const rootInsets = {};
    const activity = {};
    const resources = {};
    return {
        styles,
        statusbarStyles,
        runtime: {
            os: { name: 'Android' },
            navigator: {
                isImmersedStatusbar: () => immersed,
                getStatusbarHeight: () => statusbarHeight,
                getSafeAreaInsets: () => ({ top: safeAreaTop }),
                setStatusBarStyle: (style) => statusbarStyles.push(style)
            },
            screen: { scale },
            android: {
                currentWebview: () => nativeWebview,
                runtimeMainActivity: () => activity,
                invoke(target, method) {
                    if (target === nativeWebview && method === 'getRootWindowInsets') {
                        return nativeInsetPixels > 0 ? rootInsets : null;
                    }
                    if (target === rootInsets &&
                        (method === 'getSystemWindowInsetTop' || method === 'getStableInsetTop')) {
                        return nativeInsetPixels;
                    }
                    if (target === activity && method === 'getResources') return resources;
                    if (target === resources && method === 'getIdentifier') {
                        return nativeResourcePixels > 0 ? 1 : 0;
                    }
                    if (target === resources && method === 'getDimensionPixelSize') {
                        return nativeResourcePixels;
                    }
                    return null;
                }
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
    assert.ok(manifest.permissions?.Invocation);
});

test('Android phone layout remains immersive at the 768px boundary', () => {
    const fake = createAndroidRuntime();
    const targetWindow = createAppWindow(MICROI_PHONE_LAYOUT_MAX_WIDTH);

    const result = syncApkDesktopStatusbarInset({
        targetWindow,
        plusRuntime: fake.runtime
    });

    assert.equal(result.active, false);
    assert.equal(result.top, 0);
    assert.equal(result.reason, 'phone-immersive');
    assert.equal(result.source, 'phone-immersive');
    assert.deepEqual(fake.styles, [{ top: '0px', bottom: '0px' }]);
    assert.equal(targetWindow[APK_DESKTOP_STATUSBAR_FLAG], false);
    assert.deepEqual(targetWindow[APK_DESKTOP_STATUSBAR_DIAGNOSTICS], result);
    assert.deepEqual(fake.statusbarStyles, []);
});

test('Android tablet PC layout uses the real status bar height and resets after rotation', () => {
    const fake = createAndroidRuntime({ statusbarHeight: 31 });
    const targetWindow = createAppWindow(1280);

    const tabletResult = syncApkDesktopStatusbarInset({
        targetWindow,
        plusRuntime: fake.runtime
    });
    assert.equal(tabletResult.active, true);
    assert.equal(tabletResult.top, 31);
    assert.equal(tabletResult.reason, 'desktop-inset');
    assert.equal(tabletResult.source, 'plus-statusbar');
    assert.equal(tabletResult.immersedReported, true);
    assert.deepEqual(fake.styles[0], { top: '31px', bottom: '0px' });
    assert.equal(targetWindow[APK_DESKTOP_STATUSBAR_FLAG], true);
    assert.deepEqual(fake.statusbarStyles, ['dark']);

    targetWindow.innerWidth = 390;
    const phoneResult = syncApkDesktopStatusbarInset({
        targetWindow,
        plusRuntime: fake.runtime
    });
    assert.equal(phoneResult.active, false);
    assert.equal(phoneResult.top, 0);
    assert.equal(phoneResult.reason, 'phone-immersive');
    assert.deepEqual(fake.styles[1], { top: '0px', bottom: '0px' });
    assert.equal(targetWindow[APK_DESKTOP_STATUSBAR_FLAG], false);
});

test('custom tablet ROM still reserves a clickable top area when 5+ reports false and zero', () => {
    const fake = createAndroidRuntime({ immersed: false, statusbarHeight: 0 });
    const targetWindow = createAppWindow(1280);

    const result = syncApkDesktopStatusbarInset({
        targetWindow,
        plusRuntime: fake.runtime
    });

    assert.equal(result.active, true);
    assert.equal(result.top, APK_DESKTOP_STATUSBAR_FALLBACK);
    assert.equal(result.source, 'desktop-fallback');
    assert.equal(result.immersedReported, false);
    assert.deepEqual(fake.styles, [
        { top: `${APK_DESKTOP_STATUSBAR_FALLBACK}px`, bottom: '0px' }
    ]);
    assert.equal(targetWindow[APK_DESKTOP_STATUSBAR_FLAG], true);
});

test('tablet prefers reported safe area when status bar height is unavailable', () => {
    const fake = createAndroidRuntime({ statusbarHeight: 0, safeAreaTop: 29 });
    const targetWindow = createAppWindow(1280);

    const result = syncApkDesktopStatusbarInset({
        targetWindow,
        plusRuntime: fake.runtime
    });

    assert.equal(result.top, 29);
    assert.equal(result.source, 'plus-safe-area');
    assert.deepEqual(fake.styles, [{ top: '29px', bottom: '0px' }]);
});

test('tablet converts native Android physical insets to WebView logical pixels', () => {
    const fake = createAndroidRuntime({
        statusbarHeight: 0,
        nativeInsetPixels: 72,
        nativeResourcePixels: 60,
        scale: 2
    });
    const targetWindow = createAppWindow(1280);

    const result = syncApkDesktopStatusbarInset({
        targetWindow,
        plusRuntime: fake.runtime
    });

    assert.equal(result.top, 36);
    assert.equal(result.source, 'android-window-insets');
    assert.deepEqual(fake.styles, [{ top: '36px', bottom: '0px' }]);
});

test('launcher and remote client both apply the same tablet-only breakpoint', () => {
    assert.match(launcherSource, /window\.innerWidth > 768/);
    assert.match(launcherSource, /getStatusbarHeight\(\)/);
    assert.match(launcherSource, /getSafeAreaInsets\(\)/);
    assert.match(launcherSource, /status_bar_height/);
    assert.match(launcherSource, /APK_DESKTOP_STATUSBAR_FALLBACK = 32/);
    assert.doesNotMatch(launcherSource, /isImmersedStatusbar\(\) !== true/);
    assert.match(launcherSource, /currentWebview\.setStyle\(\{ top: top \+ 'px', bottom: '0px' \}\)/);
    assert.match(clientAppSource, /syncApkDesktopStatusbarInset/);
    assert.match(clientPermissionSource, /__microi_apkDesktopStatusbarInset === true/);
});
