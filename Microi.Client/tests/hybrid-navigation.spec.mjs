import assert from 'node:assert/strict';
import test from 'node:test';
import { firstNavigationLeaf, navigationTarget, resolveHybridNavigation, visibleNavigationRoutes } from '../src/utils/hybrid-navigation.js';
const node = (path, children, extra = {}) => ({ path, meta: { title: path }, ...(children ? { children } : {}), ...extra });

test('current deep link selects the authorized root and projects only its visible secondary menus', () => {
    const routes = [node('/home'), node('/engine', [node('forms', [node('design')]), node('private', undefined, { Display:'0' })]), node('/admin', [node('users')])];
    const snapshot = JSON.stringify(routes);
    const state = resolveHybridNavigation(routes, '/engine/forms/design');
    assert.equal(state.activeRoot, '/engine');
    assert.deepEqual(state.sidebarRoutes.map(route => route.path), ['/engine/forms']);
    assert.equal(JSON.stringify(routes), snapshot, 'route projection must not rewrite the shared permission tree');
    assert.equal(firstNavigationLeaf(state.root), '/engine/forms/design');
});

test('one child stays secondary, leaf roots remove the sidebar, and an explicit selection wins', () => {
    const routes = [node('/leaf'), node('/one', [node('child')])];
    assert.equal(resolveHybridNavigation(routes, '/one/child').sidebarRoutes.length, 1);
    assert.deepEqual(resolveHybridNavigation(routes, '/one/child', '/leaf').sidebarRoutes, []);
    assert.equal(resolveHybridNavigation(routes, '/leaf').activeRoot, '/leaf');
    assert.deepEqual(resolveHybridNavigation([], '/missing').sidebarRoutes, []);
});

test('hidden routes and raw invalid inputs cannot populate navigation, query and external destinations stay intact', () => {
    assert.deepEqual(visibleNavigationRoutes(null), []);
    assert.deepEqual(visibleNavigationRoutes([node('/no', undefined, { hidden:true }), node('/zero', undefined, { Display:0 }), { path:'/no-meta' }]), []);
    assert.equal(navigationTarget(node('/orders', undefined, { UrlParam:'kind=a' })), '/orders?kind=a');
    assert.equal(firstNavigationLeaf(node('/group', [node('https://example.com/item', undefined, { UrlParam:'kind=a' })])), 'https://example.com/item?kind=a');
    const state = resolveHybridNavigation([node('/group', [node('orders', undefined, { UrlParam:'kind=a' })])], '/group/orders');
    assert.equal(navigationTarget(state.sidebarRoutes[0]), '/group/orders?kind=a');
});
