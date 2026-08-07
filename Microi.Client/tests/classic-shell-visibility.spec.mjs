import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
    exitClassicShellUrlMode,
    removeClassicShellParamsFromUrl,
    resolveClassicShellVisibility,
    syncClassicShellVisibilityFromUrl
} from "../src/utils/classic-shell-visibility.js";

function createStore(initial = {}) {
    return {
        ShowClassicTop: initial.ShowClassicTop ?? 1,
        ShowClassicLeft: initial.ShowClassicLeft ?? 1,
        IsTabFullScreen: initial.IsTabFullScreen ?? false,
        setState(key, value) {
            this[key] = value;
        }
    };
}

test("URL visibility parameters hide only the requested classic shell regions", () => {
    assert.deepEqual(
        resolveClassicShellVisibility("http://localhost/?OsClient=iTdos#/notice?ShowClassicTop=0&ShowClassicLeft=false"),
        {
            ShowClassicTop: 0,
            ShowClassicLeft: 0,
            hasClassicShellParams: true,
            hasHiddenClassicShell: true
        }
    );

    const topOnly = resolveClassicShellVisibility("http://localhost/#/notice?ShowClassicTop=0");
    assert.equal(topOnly.ShowClassicTop, 0);
    assert.equal(topOnly.ShowClassicLeft, 1);
});

test("removing URL parameters restores stale hidden shell state", () => {
    const store = createStore({ ShowClassicTop: 0, ShowClassicLeft: 0 });
    syncClassicShellVisibilityFromUrl(store, "http://localhost/?OsClient=iTdos#/notice");
    assert.equal(store.ShowClassicTop, 1);
    assert.equal(store.ShowClassicLeft, 1);
});

test("URL synchronization does not override active tab fullscreen state", () => {
    const store = createStore({ ShowClassicTop: 0, ShowClassicLeft: 0, IsTabFullScreen: true });
    syncClassicShellVisibilityFromUrl(store, "http://localhost/#/notice");
    assert.equal(store.ShowClassicTop, 0);
    assert.equal(store.ShowClassicLeft, 0);
});

test("Esc exit restores the shell and removes only classic shell parameters", () => {
    const href = "http://localhost/?OsClient=iTdos#/notice?ShowClassicTop=0&ShowClassicLeft=0&FormDataId=abc";
    const store = createStore({ ShowClassicTop: 0, ShowClassicLeft: 0 });
    let replacedUrl = "";

    assert.equal(exitClassicShellUrlMode(store, href, (url) => { replacedUrl = url; }), true);
    assert.equal(store.ShowClassicTop, 1);
    assert.equal(store.ShowClassicLeft, 1);
    assert.equal(replacedUrl, "http://localhost/?OsClient=iTdos#/notice?FormDataId=abc");
});

test("classic shell parameter cleanup supports outer and hash queries", () => {
    const clean = removeClassicShellParamsFromUrl(
        "https://os.example.com/?OsClient=iTdos&ShowClassicTop=0#/notice?x=1&ShowClassicLeft=0"
    );
    assert.equal(clean, "https://os.example.com/?OsClient=iTdos#/notice?x=1");
});

test("Pinia 4 persistence uses pick allowlists instead of obsolete paths", () => {
    for (const file of ["diy.js", "app.js", "settings.js"]) {
        const source = fs.readFileSync(new URL(`../src/pinia/modules/${file}`, import.meta.url), "utf8");
        assert.match(source, /persist\s*:\s*\{[\s\S]*?\bpick\s*:/);
        assert.doesNotMatch(source, /persist\s*:\s*\{[\s\S]*?\bpaths\s*:/);
    }
});

test("application lifecycle wires URL resync and Esc exit into the shell", () => {
    const appSource = fs.readFileSync(new URL("../src/App.vue", import.meta.url), "utf8");
    const mainSource = fs.readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
    const tagsSource = fs.readFileSync(
        new URL("../src/layout/components/TagsView/index.vue", import.meta.url),
        "utf8"
    );

    assert.match(appSource, /"\$route\.fullPath"[\s\S]*syncClassicShellVisibility/);
    assert.match(appSource, /event\.key\s*!==\s*"Escape"[\s\S]*exitClassicShellUrlMode/);
    assert.match(mainSource, /syncClassicShellVisibilityFromUrl\(diyStore, location\.href\)/);
    assert.match(tagsSource, /Escape[\s\S]*stopImmediatePropagation\(\)[\s\S]*exitFullScreen\(\)/);
});
