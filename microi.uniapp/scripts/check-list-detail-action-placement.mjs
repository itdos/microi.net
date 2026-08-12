import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const businessList = read('src/pages/business/list.vue')
const moduleList = read('src/pages/module/list.vue')
const businessDetail = read('src/pages/business/detail.vue')
const moduleDetail = read('src/pages/module/detail.vue')
const nativeForm = read('src/pages/native-form/index.vue')

assert.doesNotMatch(businessList, /class="nav-icon"[^>]*@tap="openAdd"/, '业务列表顶部加号必须删除')
assert.match(businessList, /v-if="canAddRecord" class="floating-add"[^>]*@tap="openAdd"/, '业务列表右下角新增入口必须保留')
assert.doesNotMatch(moduleList, /module-nav__button--add[^>]*@tap="openAdd"/, '通用模块列表顶部加号必须删除')

assert.doesNotMatch(businessDetail, /class="nav-button nav-button--edit"/, '业务详情顶部编辑必须删除')
assert.match(businessDetail, /v-if="canEditRecord"[\s\S]*?@tap="openFullForm"/, '业务详情底部编辑必须保留')
assert.doesNotMatch(moduleDetail, /<template #right>[\s\S]*?openEdit/, '通用模块详情顶部编辑必须删除')
assert.match(moduleDetail, /class="detail-action-bar"[\s\S]*?@tap="openEdit"/, '通用模块详情底部编辑必须保留')
assert.doesNotMatch(nativeForm, /<template #right>[\s\S]*?switchToEdit/, '原生表单详情顶部编辑必须删除')
assert.match(nativeForm, /class="form-view-actions"[\s\S]*?@tap="switchToEdit"/, '原生表单详情底部编辑必须保留')

console.log('列表顶部新增与详情底部编辑布局检查通过')
