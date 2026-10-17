import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { compileString } from 'sass';
import { parse,compileScript,compileTemplate,compileStyle } from '@vue/compiler-sfc';
import { buildUiDensityVariables } from '../src/utils/ui-density.js';
const read = file => readFileSync(new URL('../src/' + file,import.meta.url),'utf8');
test('90%密度同步缩小真实表格行槽与父菜单底圈，保留内容自然高度和触屏目标',()=>{
    const compact=buildUiDensityVariables(90), normal=buildUiDensityVariables(100);
    assert.equal(compact['--mci-ui-table-cell-padding'],'3.6px');assert.equal(compact['--mci-ui-table-line-height'],'19.8px');
    assert.ok(parseFloat(compact['--mci-ui-menu-icon-size'])+2*parseFloat(compact['--mci-ui-menu-icon-inset'])<parseFloat(compact['--mci-ui-menu-height'])-8);
    assert.ok(parseFloat(compact['--mci-ui-table-line-height'])+2*parseFloat(compact['--mci-ui-table-cell-padding'])<parseFloat(normal['--mci-ui-table-line-height'])+2*parseFloat(normal['--mci-ui-table-cell-padding']));
    const css=compileString(read('styles/ui-density.scss')).css;
    assert.match(css,/html\[data-mci-ui-density\] body \.diy-table \.el-table td \.cell[^{]*\{\s*line-height: var\(--mci-ui-table-line-height\) !important/);
    assert.match(css,/\.diy-table \.diy-table-action-content\s*\{\s*padding-block: 0 !important/);
    assert.match(css,/\.diy-table-action-content:has\(\.button-stat-badge\)[^{]*\{[^}]*padding-top: calc\(6px \* var\(--mci-ui-scale\)\) !important/);
    assert.match(css,/@media \(min-width: 769px\)\s*\{[^}]*\.diy-table-action-content > \.el-button[^}]*height: var\(--mci-ui-control-height\) !important/);
    assert.equal(compact['--mci-touch-target'],'44px');
});
test('直角确认框的编译选择器强于统一消息壳，且不隐藏html',()=>{
    const css=compileString(read('styles/theme-shape.scss')).css;
    assert.match(css,/html\[data-mci-corner-style=square\] \.el-message-box\.mci-unified-message-box\s*\{\s*border-radius: 0 !important;/);
    assert.doesNotMatch(css,/html\[data-mci-corner-style=square\]\s*\{[^}]*display:\s*none/);
});
test('导航、角色页和共享拖拽组件的真实SFC均可编译',()=>{
    for(const file of ['layout/index.vue','layout/components/TopNavigation.vue','layout/components/TopNavigationItem.vue','layout/components/Sidebar/Item.vue','views/system/sysrole-manage.vue','views/form-engine/left-right/LeftTreeJoinRightForm.vue','components/MciResizablePane/index.vue']) {
        const {descriptor,errors}=parse(read(file),{filename:file});assert.deepEqual(errors,[],file);
        const script=compileScript(descriptor,{id:'layout-contract'});
        const template=compileTemplate({source:descriptor.template.content,filename:file,id:'layout-contract',compilerOptions:{bindingMetadata:script.bindings}});assert.deepEqual(template.errors,[],file);
        for(const style of descriptor.styles)if(!style.lang)assert.deepEqual(compileStyle({source:style.content,id:'layout-contract',scoped:style.scoped}).errors,[],file);
    }
});
test('Top主导航保留独立选中底线、可读hover和内部滚动，取消标题提示浮层',()=>{
    const top=read('layout/components/TopNavigation.vue'), item=read('layout/components/Sidebar/Item.vue');
    const {descriptor}=parse(top);const css=compileString(descriptor.styles[0].content).css;
    assert.match(css,/\.mci-top-menu > \.el-sub-menu.is-active > \.el-sub-menu__title::after/);
    assert.match(top,/:popper-offset="0"/);
    assert.match(css,/height: 3px/);assert.match(css,/\.mci-top-navigation-popup > \.el-menu--popup\s*\{[^}]*overflow-y: auto/);
    assert.match(css,/\.el-popper.mci-top-navigation-popup[^}]*border: 0 !important/);
    assert.match(top,/color:var\(--sidebar-text-color\) !important/);
    assert.match(css,/\.mci-top-menu \.el-menu-item\.is-active[^}]*background: var\(--sidebar-bg-color\) !important/);
    assert.match(css,/\.mci-top-menu \.el-menu-item:not\(\.is-disabled\):hover[^}]*background: var\(--sidebar-bg-color\) !important/);
    assert.doesNotMatch(css,/background: var\(--sidebar-(?:active|hover)-bg\) !important/);

    assert.doesNotMatch(item,/:title=/);assert.doesNotMatch(top,/<el-tooltip/);assert.doesNotMatch(top,/:title="brandTitle"/);
    const topItem=read('layout/components/TopNavigationItem.vue');assert.equal((topItem.match(/:title-tooltip="false"/g)||[]).length,3);
    assert.match(item,/v-if="title && titleTooltip"/);assert.match(item,/v-else-if="title" class="menu-title" :aria-label="title"/);
    const layout=read('layout/index.vue');assert.match(layout,/\.desktop-shell\.top-navigation-layout \.classic-workspace\s*\{ padding-inline: 0 !important/);
    assert.match(layout,/\.classic-workspace > :deep\(\.tags-view-container-microi\)\s*\{ padding-inline: 10px/);
    assert.match(layout,/\.desktop-shell\.hybrid-navigation-layout > :deep\(\.navbar-microi\)/);
});

// 验证实际低代码角色入口，旧 sysrole-manage 并非所有租户的当前路由。
test('低代码角色树仅按权威表名使用账号偏好，其它左右模块保留配置比例和原筛选链',()=>{
    const source=read('views/form-engine/left-right/LeftTreeJoinRightForm.vue');
    const {descriptor}=parse(source);
    const script=descriptor.script.content.replace(/^import .*?;\r?\n/gm,'').replace('export default','return');
    const options=new Function('computed','defineAsyncComponent','useDiyStore','LeftView','RightView','MciResizablePane','PanelLayoutMixin',script)(()=>{},()=>({}),()=>({}),{},{},{},{});
    for(const value of ['sys_role','Sys_Role','SYS_ROLE'])assert.equal(options.computed.isRoleTreeLayout.call({$route:{meta:{DiyTableName:value}}}),true);
    for(const meta of [{title:'角色管理'},{DiyTableName:'sys_user'},{ModuleEngineKey:'sys_role'}])assert.equal(options.computed.isRoleTreeLayout.call({$route:{meta}}),false);
    const vm={isRoleTreeLayout:true,roleTreeWidthPreference:336,roleTreeCollapsedPreference:true,colData:{Left:6},$t:()=> '组织'};
    assert.deepEqual(options.computed.leftPanelProps.call(vm),{width:336,collapsed:true,label:'组织'});
    vm.isRoleTreeLayout=false;assert.deepEqual(options.computed.leftPanelProps.call(vm),{span:6});
    assert.match(source,/@commit="isRoleTreeLayout && savePanelLayout\(\{ RoleTreeWidth: \$event \}\)"/);
    assert.match(source,/:PropsFilterReloadOnly="true"/);assert.match(source,/clickVersion !== self.NodeClickVersion/);
    assert.match(source,/MobileTreeDrawer = false/);
});
