import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const FRONTEND = 'http://localhost:61500';
const OUTPUT = path.resolve(process.cwd(), '../.tmp/screenshots/webos-current-fixes-2026-08-30');
const HARNESS_URL = `${FRONTEND}/__webos-current-fixes-harness`;

const harnessHtml = `<!doctype html>
<html lang="zh-CN" style="--mci-color-primary:#8b5cf6;--mci-color-primary-rgb:139,92,246;--mci-text-primary:#172033;--mci-text-secondary:#5d687b;--mci-border-rgb:100,116,139">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    html,body,#app{width:100%;height:100%;margin:0;overflow:hidden}
    body{font-family:Inter,"Microsoft YaHei",sans-serif;background:radial-gradient(circle at 68% 18%,#6d28d9 0,transparent 34%),linear-gradient(135deg,#17113d,#3b1271 58%,#7022a6)}
    .form-window-harness__desktop{width:100%;height:100%;display:grid;place-items:center}
    .form-window-harness__parent{width:86%;height:64%;overflow:hidden;border:1px solid rgba(255,255,255,.34);border-radius:20px;background:rgba(247,249,255,.88);box-shadow:0 28px 72px rgba(4,9,30,.32)}
    .form-window-harness__parent header{padding:18px 24px;border-bottom:1px solid rgba(71,85,105,.14);font-weight:700;color:#172033}
    .form-window-harness__table{margin:20px 24px;padding:20px;border-radius:14px;background:rgba(226,232,240,.74);color:#596579}
    .form-window-harness__content{padding:0 12px 22px}
    .form-window-harness__hero{display:flex;justify-content:space-between;align-items:center;padding:18px 22px;border-radius:16px;background:linear-gradient(115deg,#a42d82,#66205d);color:#fff}
    .form-window-harness__hero strong{font-size:22px}.form-window-harness__hero span{opacity:.82}
    .form-window-harness__grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:18px}
    .form-window-harness__grid label{display:grid;grid-template-columns:92px 1fr;align-items:center;padding:12px 16px;border:1px solid rgba(148,163,184,.18);border-radius:12px;background:rgba(255,255,255,.68);color:#4b5563}
    .form-window-harness__grid input{border:0;outline:0;background:transparent;color:#182033;font-weight:600}
  </style>
</head>
<body><div id="app"></div>
<script type="module">
  import { createApp, h, ref, Teleport } from '/node_modules/.vite/deps/vue.js';
  import ElementPlus, { ElDialog } from '/node_modules/.vite/deps/element-plus.js';
  import '/node_modules/element-plus/dist/index.css';
  import '/src/views/form-engine/styles/diy-form-full.global.scss';
  import DesktopFolderMenu from '/src/views/webos/components/DesktopFolderMenu.vue';
  import DockFolderMenu from '/src/views/webos/components/DockFolderMenu.vue';
  import diyFormFullDialogMixin from '/src/views/form-engine/mixins/diy-form-full-dialog.mixin.js';

  const children = [
    ['系统管理','/sys'],['系统架构','/architecture'],['应用商城','/store'],['我发布的应用','/published'],['我安装的应用','/installed'],
    ['接口引擎','/api'],['AI助手','/assistant'],['AI平台治理','/governance'],['表单引擎','/form'],['采集引擎','/spider'],
    ['模块引擎','/module'],['数据库扩展','/database'],['界面引擎','/page'],['数据大屏','/dashboard'],['多语言','/language']
  ].map(([Name, Url], index) => ({ Id: 'menu-' + index, Name, Url }));
  children[3]._Child = [{ Id: 'nested', Name: '发布中心', Url: '/published/center' }];
  const item = { Id:'engine', Name:'系统引擎', SecondMenuWidth:750, SecondMenuHeight:600, SecondMenuLineCount:5, _Child:children };
  const mode = ref('desktop');
  window.__setWebosHarnessMode = value => { mode.value = value; };
  const FormWindowHarness = {
    mixins: [diyFormFullDialogMixin],
    data() {
      return {
        ShowFieldForm:true,
        WebosFormMaximized:false,
        WebosFormMinimized:false,
        ParentWindowMaximized:false
      };
    },
    render() {
      const windowControls = h('span', {
        class:'diy-form-webos-window-controls',
        'aria-label':'WebOS 表单窗口控制'
      }, [
        h('button', {
          type:'button', title:'最小化表单窗口', 'aria-label':'最小化表单窗口',
          onPointerdown:event => event.stopPropagation(),
          onClick:this.WebosMinimizeFormWindow
        }, [h('svg', { viewBox:'0 0 16 16', 'aria-hidden':'true' }, [h('path', { d:'M3 12.5h10' })])]),
        h('button', {
          type:'button', title:this.IsWebosWindowMaximized() ? '还原表单窗口' : '最大化表单窗口',
          'aria-label':this.IsWebosWindowMaximized() ? '还原表单窗口' : '最大化表单窗口',
          onPointerdown:event => event.stopPropagation(),
          onClick:this.WebosToggleMaximizeFormWindow
        }, [h('svg', { viewBox:'0 0 16 16', 'aria-hidden':'true' }, [h('rect', { x:'3', y:'3', width:'10', height:'10', rx:'1' })])])
      ]);
      const dialog = h(ElDialog, {
        modelValue:this.ShowFieldForm,
        'onUpdate:modelValue':value => { this.ShowFieldForm = value; },
        class:[
          'diy-form-container',
          'diy-form-modern-dialog',
          this.IsWebosWindowMaximized() ? 'is-webos-form-maximized' : '',
          this.WebosFormMinimized ? 'is-webos-form-minimized' : ''
        ],
        draggable:!this.IsWebosWindowMaximized(),
        fullscreen:this.IsWebosWindowMaximized(),
        alignCenter:true,
        width:'80%',
        modal:true,
        modalClass:[
          'diy-form-modern-overlay',
          'mci-unified-overlay',
          'diy-form-webos-body-overlay',
          this.WebosFormMinimized ? 'diy-form-webos-minimized-overlay' : ''
        ].filter(Boolean).join(' '),
        appendToBody:true,
        modalAppendToBody:true,
        showClose:false,
        destroyOnClose:true
      }, {
        header:() => h('div', { class:'diy-form-dialog-title' }, [
          h('div', { class:'diy-form-dialog-title__copy' }, [
            h('span', { class:'diy-form-dialog-title__eyebrow' }, 'EDIT RECORD'),
            h('div', { class:'diy-form-dialog-title__heading' }, [h('span', '编辑 - 我的联系人')])
          ]),
          h('div', { class:'diy-form-dialog-actions diy-form-toolbar' }, [windowControls])
        ]),
        default:() => h('div', { class:'form-window-harness__content' }, [
          h('div', { class:'form-window-harness__hero' }, [
            h('strong', '张三'), h('span', '136 0000 2026')
          ]),
          h('div', { class:'form-window-harness__grid' }, [
            h('label', [h('span', '姓名'), h('input', { value:'张三', readonly:true })]),
            h('label', [h('span', '手机号'), h('input', { value:'136 0000 2026', readonly:true })]),
            h('label', [h('span', '英文名'), h('input', { value:'Neo', readonly:true })]),
            h('label', [h('span', '录入人'), h('input', { value:'管理员', readonly:true })])
          ])
        ])
      });
      const restore = this.WebosFormMinimized
        ? h(Teleport, { to:'body' }, h('button', {
            type:'button', class:'diy-form-webos-restore', title:'恢复表单窗口', 'aria-label':'恢复表单窗口',
            onClick:this.WebosRestoreFormWindow
          }, [h('span', '编辑 - 我的联系人')]))
        : null;
      return h('div', {
        class:'form-window-harness__desktop',
        'data-parent-maximized':String(this.ParentWindowMaximized)
      }, [
        h('section', { class:'form-window-harness__parent' }, [
          h('header', '我的联系人（父级数据表格窗口）'),
          h('div', { class:'form-window-harness__table' }, '姓名　手机号　英文名　创建人')
        ]),
        dialog,
        restore
      ]);
    }
  };
  const app = createApp({
    render() {
      if (mode.value === 'form') {
        return h(FormWindowHarness);
      }
      if (mode.value === 'dock') {
        return h(DockFolderMenu, { item, platform:'macos', anchorRect:{ left:850, top:820, width:80, height:60 } });
      }
      return h(DesktopFolderMenu, { item, platform:'macos', phone:false });
    }
  });
  app.config.globalProperties.$webosWindow = { active:true, platform:'macos' };
  app.use(ElementPlus);
  app.mount('#app');
</script></body></html>`;

test.use({ viewport: { width: 1280, height: 800 } });

test.beforeEach(async ({ page }) => {
    await page.route(HARNESS_URL, route => route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: harnessHtml,
    }));
    await page.goto(HARNESS_URL, { waitUntil: 'domcontentloaded' });
});

test('系统引擎图标保持正圆、箭头居中且弹窗可拖动', async ({ page }) => {
    await fs.mkdir(OUTPUT, { recursive: true });
    const panel = page.locator('.webos-desktop-folder');
    await expect(panel).toBeVisible();
    const icons = panel.locator('.webos-theme-menu-icon');
    expect(await icons.count()).toBe(15);
    const geometry = await icons.evaluateAll(elements => elements.map(element => {
        const rect = element.getBoundingClientRect();
        return {
            width: rect.width,
            height: rect.height,
            radius: getComputedStyle(element).borderTopLeftRadius,
        };
    }));
    expect(geometry.every(row => Math.abs(row.width - row.height) < .5), JSON.stringify(geometry)).toBe(true);
    expect(geometry.every(row => parseFloat(row.radius) >= row.width / 2 - .5), JSON.stringify(geometry)).toBe(true);

    const nestedItem = panel.locator('.webos-desktop-folder__item.has-children').first();
    const aligned = await nestedItem.evaluate(element => {
        const icon = element.querySelector('.webos-theme-menu-icon').getBoundingClientRect();
        const chevron = element.querySelector('.webos-desktop-folder__chevron').getBoundingClientRect();
        return Math.abs((icon.top + icon.height / 2) - (chevron.top + chevron.height / 2));
    });
    expect(aligned).toBeLessThanOrEqual(1);

    const before = await panel.boundingBox();
    const header = await panel.locator('.webos-desktop-folder__header').boundingBox();
    await page.mouse.move(header.x + header.width / 2, header.y + header.height / 2);
    await page.mouse.down();
    await page.mouse.move(header.x + header.width / 2 + 130, header.y + header.height / 2 + 70, { steps: 8 });
    await page.mouse.up();
    const after = await panel.boundingBox();
    expect(after.x - before.x).toBeGreaterThan(100);
    expect(after.y - before.y).toBeGreaterThan(50);
    expect(after.x).toBeGreaterThanOrEqual(9);
    expect(after.y).toBeGreaterThanOrEqual(9);
    expect(after.x + after.width).toBeLessThanOrEqual(1271);
    expect(after.y + after.height).toBeLessThanOrEqual(791);

    await page.screenshot({ path: path.join(OUTPUT, 'system-engine-circle-icons-dragged.png') });
});

test('Dock 文件夹同样保持圆形图标并支持标题栏拖动', async ({ page }) => {
    await fs.mkdir(OUTPUT, { recursive: true });
    await page.evaluate(() => window.__setWebosHarnessMode('dock'));
    const panel = page.locator('.webos-dock-folder');
    await expect(panel).toBeVisible();
    const firstIcon = panel.locator('.webos-theme-menu-icon').first();
    const iconBox = await firstIcon.boundingBox();
    expect(Math.abs(iconBox.width - iconBox.height)).toBeLessThan(.5);

    const before = await panel.boundingBox();
    const header = await panel.locator('header').boundingBox();
    await page.mouse.move(header.x + header.width / 2, header.y + header.height / 2);
    await page.mouse.down();
    await page.mouse.move(header.x + header.width / 2 - 120, header.y + header.height / 2 - 70, { steps: 8 });
    await page.mouse.up();
    const after = await panel.boundingBox();
    expect(before.x - after.x).toBeGreaterThan(90);
    expect(before.y - after.y).toBeGreaterThan(50);

    await page.screenshot({ path: path.join(OUTPUT, 'dock-folder-circle-icons-dragged.png') });
});

test('WebOS 表单挂到 body，最大化与最小化都只作用于表单自身', async ({ page }) => {
    await fs.mkdir(OUTPUT, { recursive: true });
    await page.evaluate(() => window.__setWebosHarnessMode('form'));
    const dialog = page.locator('.diy-form-modern-dialog');
    await expect(dialog).toBeVisible();

    const bodyLayer = await dialog.evaluate(element => ({
        bodyContains: document.body.contains(element),
        parentIsOverlayDialog: element.parentElement?.classList.contains('el-overlay-dialog') === true,
        overlayIsBodyChild: element.parentElement?.parentElement?.parentElement === document.body,
        overlayZIndex: getComputedStyle(element.closest('.diy-form-webos-body-overlay')).zIndex
    }));
    expect(bodyLayer).toEqual({
        bodyContains:true,
        parentIsOverlayDialog:true,
        overlayIsBodyChild:true,
        overlayZIndex:'10030'
    });

    const parent = page.locator('.form-window-harness__desktop');
    await expect(parent).toHaveAttribute('data-parent-maximized', 'false');
    await dialog.getByRole('button', { name:'最大化表单窗口' }).click();
    await expect(dialog).toHaveClass(/is-webos-form-maximized/);
    await expect(parent).toHaveAttribute('data-parent-maximized', 'false');
    const maximized = await dialog.boundingBox();
    expect(maximized.width).toBeGreaterThan(1200);
    expect(maximized.height).toBeGreaterThan(680);
    await page.screenshot({ path: path.join(OUTPUT, 'form-body-layer-maximized.png') });

    await dialog.getByRole('button', { name:'还原表单窗口' }).click();
    await expect(dialog).not.toHaveClass(/is-webos-form-maximized/);
    await dialog.getByRole('button', { name:'最小化表单窗口' }).click();
    const restore = page.getByRole('button', { name:'恢复表单窗口' });
    await expect(restore).toBeVisible();
    await expect(dialog).toBeHidden();
    await restore.click();
    await expect(dialog).toBeVisible();
    await expect(parent).toHaveAttribute('data-parent-maximized', 'false');
});
