import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('the last shell theme bridge preserves the sidebar theme on the entire Top/TopSide navbar', () => {
    const bridge = readFileSync(new URL('../src/styles/mci-admin-theme.scss', import.meta.url),'utf8');
    const navbar = readFileSync(new URL('../src/layout/components/Navbar.vue',import.meta.url),'utf8');
    // The dark design system applies an important background shorthand to navbars.
    // A component-only normal declaration loses its image and silently turns white/dark.
    assert.ok(/html \.navbar-microi\.navbar-microi--themed/.test(bridge),'the bridge must match html.dark selector specificity');
    assert.ok(/\.navbar-microi\.navbar-microi--themed\s*\{[^}]*background:\s*var\(--sidebar-bg-gradient\)\s*!important/.test(bridge),'bridge must preserve the themed background against dark shorthand overrides');
    assert.ok(/\.navbar-microi\.navbar-microi--themed\s*\{[^}]*color:\s*var\(--sidebar-text-color\)\s*!important/.test(bridge),'bridge must preserve the readable themed foreground');
    assert.match(navbar,/\['Top', 'TopSide'\]\.includes\(navigationLayout\.value\)/);
});

test('Top navigation foreground updates immediately when its themed background changes', () => {
    const top = readFileSync(new URL('../src/layout/components/TopNavigation.vue',import.meta.url),'utf8');
    const declaration = top.match(/\.mci-top-menu \.el-menu-item,\.mci-top-menu \.el-sub-menu__title\s*\{([^}]+)\}/)?.[1] || '';
    assert.ok(/transition-property:\s*background-color,\s*border-color\s*!important/.test(declaration),'menu foreground must not interpolate a stale dark color over a newly dark background');
});
