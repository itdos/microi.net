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
assert.match(businessDetail, /@scrolltolower="loadActiveRelatedPage"/,
  '客户详情滚动到底必须触发下一页加载')
assert.match(businessDetail, /loadActiveRelatedPage\(\)[\s\S]*?target\.loadMore\(\)/,
  '客户详情触底必须调用当前 Tab 列表的分页方法')

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
