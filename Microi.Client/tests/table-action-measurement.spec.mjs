import assert from 'node:assert/strict';
import test from 'node:test';
import { measureActionColumnWidth, observeActionColumnWidth } from '../src/views/form-engine/utils/table-action-column-width.js';
import actionWidthMixin from '../src/views/form-engine/mixins/diy-table-action-width.mixin.js';

function fixture() {
    const frames = new Map();
    const listeners = new Map();
    const fontListeners = new Map();
    const observers = { resize: [], mutation: [] };
    let frameId = 0;
    const view = {
        getComputedStyle: element => element.style,
        requestAnimationFrame(callback) { frames.set(++frameId, callback); return frameId; },
        cancelAnimationFrame(id) { frames.delete(id); },
        addEventListener(name, callback) { listeners.set(name, callback); },
        removeEventListener(name) { listeners.delete(name); },
        ResizeObserver: class {
            constructor(callback) { this.callback = callback; this.elements = new Set(); observers.resize.push(this); }
            observe(element) { this.elements.add(element); }
            unobserve(element) { this.elements.delete(element); }
            disconnect() { this.elements.clear(); this.disconnected = true; }
        },
        MutationObserver: class {
            constructor(callback) { this.callback = callback; this.elements = new Map(); observers.mutation.push(this); }
            observe(element, options) { this.elements.set(element, options); }
            disconnect() { this.elements.clear(); this.disconnected = true; }
        }
    };
    const document = {
        defaultView: view,
        documentElement: {},
        fonts: {
            addEventListener(name, callback) { fontListeners.set(name, callback); },
            removeEventListener(name) { fontListeners.delete(name); }
        },
        createRange() {
            let selected;
            return { selectNodeContents(element) { selected = element; }, getBoundingClientRect() { return { width: selected.textWidth || 0 }; } };
        }
    };
    const root = element(0, 800);
    root.ownerDocument = document;
    root.matches = value => value === '.el-table';
    const rows = [];
    const headers = [];
    root.querySelectorAll = selector => selector === '.diy-table-action-content' ? rows
        : selector === '.action-column-settings-trigger' ? headers
        : [...rows.flatMap(row => row.children.flatMap(button => [button, ...button.badges])), ...headers.flatMap(header => header.children)];
    function element(left, width, style = {}) {
        return {
            left, width, style, children: [], badges: [], shown: true,
            classList: { contains() { return false; } },
            getClientRects() { return this.shown ? [{}] : []; },
            getBoundingClientRect() { return { left: this.left, right: this.left + this.width, width: this.width }; },
            closest(selector) { return selector === '.el-table' ? root : selector === '.cell' ? this.cell : this.td; },
            querySelectorAll() { return this.badges; }
        };
    }
    function row(widths, { gap = 6, start = -100, padding = 6 } = {}) {
        const result = element(0, 100, { paddingRight: padding + 'px' });
        result.cell = element(0, 100, { paddingLeft: '12px', paddingRight: '12px' });
        result.td = element(0, 100, { borderRightWidth: '1px' });
        let position = start;
        result.children = widths.map(width => {
            const button = element(position, width);
            position += width + gap;
            return button;
        });
        rows.push(result);
        return result;
    }
    function header(textWidth) {
        const result = element(0, 100, { columnGap: '8px' });
        result.cell = element(0, 100, { paddingLeft: '12px', paddingRight: '12px' });
        const label = element(0, 600);
        label.textWidth = textWidth;
        label.classList.contains = value => value === 'col-header-label';
        result.children = [label, element(608, 15)];
        headers.push(result);
        return result;
    }
    function flush() {
        for (const [id, callback] of [...frames]) { frames.delete(id); callback(); }
    }
    return { root, rows, headers, view, document, row, header, element, frames, listeners, fontListeners, observers, flush };
}

test('measures rendered row geometry including real gaps, cell chrome and badge overhang even when clipped on the left', () => {
    const f = fixture();
    f.row([80, 125, 64]);
    const widest = f.row([100, 140, 85]);
    widest.children.at(-1).badges.push(f.element(widest.children.at(-1).left + 80, 14));
    f.header(28);
    assert.equal(measureActionColumnWidth(f.root), 378);
});

test('density, Vietnamese/Myanmar/English rendered widths and page changes can expand and shrink without a label-length model', () => {
    const f = fixture();
    f.header(28);
    for (const widths of [[65, 100], [78.5, 120.75], [109, 188], [185, 220], [80, 102]]) {
        f.rows.length = 0;
        f.row(widths);
        assert.equal(measureActionColumnWidth(f.root), Math.ceil(widths[0] + widths[1] + 6 + 31 + 1));
    }
    f.rows.length = 0;
    assert.equal(measureActionColumnWidth(f.root), 76);
});

test('hidden buttons and nested tables cannot reserve action width or expose hidden text', () => {
    const f = fixture();
    const row = f.row([80]);
    const hidden = f.element(100, 800);
    hidden.shown = false;
    row.children.push(hidden);
    const hiddenByVisibility = f.element(100, 900, { visibility: 'hidden' });
    row.children.push(hiddenByVisibility);
    const nested = f.row([2000]);
    nested.closest = () => ({});
    assert.equal(measureActionColumnWidth(f.root), 112);
    f.root.shown = false;
    assert.equal(measureActionColumnWidth(f.root), null);
});

test('translated header minimum follows text Range, not the current flex-fill width', () => {
    const f = fixture();
    const header = f.header(150);
    assert.equal(measureActionColumnWidth(f.root), 198);
    header.children[0].textWidth = 28;
    assert.equal(measureActionColumnWidth(f.root), 76);
});

test('observer batches density, font, translated DOM and resize notifications, reconciles rows, and suppresses no-op layout writes', () => {
    const f = fixture();
    const old = f.row([80]);
    const widths = [];
    const observer = observeActionColumnWidth(f.root, width => widths.push(width));
    observer.schedule();
    f.observers.mutation[0].callback();
    f.listeners.get('resize')();
    f.fontListeners.get('loadingdone')();
    assert.equal(f.frames.size, 1);
    f.flush();
    assert.deepEqual(widths, [112]);
    assert.ok(f.observers.resize[0].elements.has(old.children[0]));
    f.observers.resize[0].callback();
    f.flush();
    assert.deepEqual(widths, [112]);
    f.rows.length = 0;
    const next = f.row([140, 190]);
    f.observers.mutation[0].callback();
    f.flush();
    assert.deepEqual(widths, [112, 368]);
    assert.ok(!f.observers.resize[0].elements.has(old.children[0]));
    assert.ok(f.observers.resize[0].elements.has(next.children[0]));
    assert.equal(f.observers.mutation[0].elements.get(f.document.documentElement).attributes, true);
    observer.schedule();
    observer.stop();
    observer.stop();
    assert.equal(f.frames.size, 0);
    assert.equal(f.listeners.size, 0);
    assert.equal(f.fontListeners.size, 0);
    assert.ok(f.observers.resize[0].disconnected);
    assert.ok(f.observers.mutation[0].disconnected);
    observer.schedule();
    f.observers.resize[0].callback();
    f.flush();
    assert.deepEqual(widths, [112, 368]);
});

test('without ResizeObserver the initial/update/window measurement still works', () => {
    const f = fixture();
    delete f.view.ResizeObserver;
    f.row([80]);
    const widths = [];
    const observer = observeActionColumnWidth(f.root, value => widths.push(value));
    f.flush();
    f.rows[0].children[0].width = 100;
    f.listeners.get('resize')();
    f.flush();
    assert.deepEqual(widths, [112, 132]);
    observer.stop();
});

test('mixin pauses observers on keep-alive deactivation, resumes them and releases them on unmount', () => {
    const f = fixture();
    f.row([80]);
    let layouts = 0;
    const vm = {
        ...actionWidthMixin.data(), ...actionWidthMixin.methods,
        TableId: 'orders', $refs: { 'diy-table-orders': { $el: f.root, doLayout() { layouts++; } } },
        $nextTick(callback) { callback(); }
    };
    actionWidthMixin.mounted.call(vm);
    f.flush();
    assert.equal(vm.MeasuredActionColumnWidth, 112);
    assert.equal(layouts, 1);
    actionWidthMixin.deactivated.call(vm);
    actionWidthMixin.updated.call(vm);
    assert.equal(f.frames.size, 0);
    assert.ok(f.observers.resize[0].disconnected);
    actionWidthMixin.activated.call(vm);
    f.flush();
    assert.equal(layouts, 2);
    actionWidthMixin.beforeUnmount.call(vm);
    assert.ok(f.observers.resize[1].disconnected);
    assert.equal(f.frames.size, 0);
});
