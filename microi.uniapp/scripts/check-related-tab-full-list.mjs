import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

const businessDetail = read('src/pages/business/detail.vue')
const nativeForm = read('src/pages/native-form/index.vue')
const moduleDetail = read('src/pages/module/detail.vue')
const relatedList = read('src/components/mci-business-related-list/mci-business-related-list.vue')

for (const [name, source] of [
  ['客户详情页', businessDetail],
  ['通用表单查看/编辑页', nativeForm],
  ['模块详情页', moduleDetail]
]) {
  assert.match(source, /v-for="relatedTab in standaloneRelatedTabs"[\s\S]*?display-mode="full"/,
    `${name}的独立子表 Tab 必须直接使用完整列表`)
}

assert.doesNotMatch(businessDetail,
  /v-for="relatedTab in standaloneRelatedTabs"[\s\S]{0,900}?show-preview-header/,
  '客户详情独立子表 Tab 不应再显示折叠标题')
assert.match(businessDetail, /:independent-scroll="standaloneListMode"/,
	'客户详情独立子表 Tab 必须启用组件内滚动')
assert.match(relatedList, /class="related-list-body"[\s\S]*?@scrolltolower="loadMore"/,
	'客户详情子表列表触底必须调用组件分页方法')
assert.match(relatedList, /related-business-list--independent-scroll[\s\S]*?display:\s*flex[\s\S]*?overflow:\s*hidden/,
	'独立子表必须建立固定头部与列表滚动区的高度约束')
assert.match(businessDetail, /:viewport-height="relatedListViewportHeight"/,
	'客户详情必须向子表传递 Tab 面板的明确可视高度')
assert.match(nativeForm, /:independent-scroll="standaloneListMode"/,
	'客户新增和编辑页的独立关联 Tab 必须与客户详情页使用相同的组件内滚动模式')
assert.match(nativeForm, /:viewport-height="relatedListViewportHeight"/,
	'客户新增和编辑页必须向关联列表传入可视高度')
assert.match(nativeForm, /native-form--standalone-list[\s\S]*?\.related-tab-panel[\s\S]*?flex:\s*1/,
	'客户新增和编辑页的关联 Tab 必须占满表单剩余空间')
assert.match(relatedList, /independentRootStyle[\s\S]*?height:[\s\S]*?this\.viewportHeight[\s\S]*?maxHeight:/,
	'子表根节点必须使用客户详情传入的像素高度约束滚动区域')
assert.match(relatedList, /relatedListBodyStyle[\s\S]*?this\.listBodyHeight[\s\S]*?maxHeight:/,
	'子表 scroll-view 必须使用明确像素高度，不能只依赖 flex 或百分比高度')
assert.match(relatedList, /:enable-flex="independentScroll && !isPreview"/,
	'客户详情子表必须启用微信原生 flex 内容布局')
assert.match(relatedList, /:show-scrollbar="false"/,
	'客户详情子表滚动时必须隐藏原生滚动条')
assert.match(relatedList, /related-list-body--scroll::\-webkit-scrollbar[\s\S]*?display:\s*none/,
	'客户详情子表必须通过样式隐藏开发者工具和 WebView 滚动指示条')
assert.doesNotMatch(businessDetail, /<scroll-view class="detail-scroll"/,
	'客户详情列表不能使用停用滚动的父 scroll-view 包裹子列表 scroll-view')
assert.match(relatedList, /class="related-list-scroll-content"[\s\S]*?padding-bottom:\s*calc\(138rpx/,
	'列表底部安全留白必须位于 scroll-view 的真实内容节点内')

for (const token of [
  "const pageSize = this.isPreview ? Math.max(1, this.previewLimit) : (this.config.pageSize || 15)",
  '_PageIndex: this.pageIndex',
  '_PageSize: pageSize',
  'loadMore() { this.loadData(false) }',
  "<text>{{ loading ? '正在加载' : '加载更多' }}</text>",
  '<view v-else-if="!isPreview" class="load-finished"><text>共 {{ count }} 条</text></view>'
]) {
  assert.ok(relatedList.includes(token), `完整关联列表分页能力缺失：${token}`)
}

console.log('关联 Tab 完整列表、无折叠标题与分页加载检查通过')
