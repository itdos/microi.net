import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const scriptUrl = new URL('../public/static/js/microi.startup-logo.js', import.meta.url);
function setup() {
    const images = [];
    const nodes = Object.fromEntries(['logoCore', 'startupLogoRing', 'startupDefaultLogo', 'startupTenantLogo'].map(id => {
        const classes = new Set();
        return [id, { hidden: false, src: '', classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c) } }];
    }));
    const window = {};
    vm.runInNewContext(readFileSync(scriptUrl, 'utf8'), {
        window, document: { getElementById: id => nodes[id] },
        Image: function () { images.push(this); }
    });
    return { nodes, images, apply: window.MicroiSetStartupLogo };
}

test('empty, malformed and unsafe logos keep the built-in artwork without network reads', () => {
    const { nodes, images, apply } = setup();
    for (const SysLogo of [null, '', ' ', {}, [], '[bad', '{}', '[]', 'javascript:alert(1)', 'data:image/svg+xml,bad']) {
        apply({ SysLogo, FileServer: 'https://cdn.example.test' });
        assert.equal(nodes.startupDefaultLogo.hidden, false);
        assert.equal(nodes.startupTenantLogo.hidden, true);
    }
    assert.equal(images.length, 0);
});

test('legacy string, object, JSON and array formats load the tenant logo before replacing the default', () => {
    for (const SysLogo of ['/logo.png', { Path: '/logo.png' }, [{ path: '/logo.png' }], '{"Path":"/logo.png"}', '[{"Path":"/logo.png"}]']) {
        const { nodes, images, apply } = setup();
        apply({ SysLogo, FileServer: 'https://cdn.example.test/' });
        assert.equal(images[0].src, 'https://cdn.example.test/logo.png');
        assert.equal(nodes.startupDefaultLogo.hidden, false);
        images[0].onload();
        assert.equal(nodes.startupDefaultLogo.hidden, true);
        assert.equal(nodes.startupTenantLogo.hidden, false);
        assert.equal(nodes.startupTenantLogo.src, images[0].src);
    }
});

test('broken logo, stale load and removed setting cannot replace the current fallback', () => {
    const { nodes, images, apply } = setup();
    apply({ SysLogo: 'https://cdn.example.test/old.png' });
    apply({ SysLogo: 'https://cdn.example.test/new.png' });
    images[0].onload();
    assert.equal(nodes.startupDefaultLogo.hidden, false);
    images[1].onerror();
    assert.equal(nodes.startupTenantLogo.hidden, true);
    apply({ SysLogo: '/good.png' });
    images[2].onload();
    assert.equal(nodes.startupTenantLogo.hidden, false);
    apply({});
    images[2].onload();
    assert.equal(nodes.startupDefaultLogo.hidden, false);
    assert.equal(nodes.startupTenantLogo.hidden, true);
});

test('startup markup uses the vector Microi brand fallback and current config refresh reaches the same renderer', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const store = readFileSync(new URL('../src/pinia/modules/diy.js', import.meta.url), 'utf8');
    assert.match(html, /id="startupDefaultLogo"[^>]+\/static\/img\/logo\/logo20200526\.svg/);
    assert.match(html, /\.mci-logo-core\.has-default-logo img\s*\{[^}]*width:\s*80px;[^}]*height:\s*80px;/);
    assert.doesNotMatch(html, /\.mci-logo-ring\.has-default-logo::before[\s\S]{0,180}display:\s*none/);
    assert.doesNotMatch(html, /microi-startup-brand\.png/);
    assert.match(html, /MicroiSetStartupLogo\(cfg\)/);
    assert.doesNotMatch(html, /lc\.innerHTML/);
    assert.match(store, /MicroiSetStartupLogo\(val\)/);
});
