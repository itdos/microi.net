import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDir, '..')
const relatedFile = path.join(projectRoot, 'src/components/mci-business-related-list/mci-business-related-list.vue')
const permissionFile = path.join(projectRoot, 'src/pages/business/utils/xjy-row-actions.js')
const source = fs.readFileSync(relatedFile, 'utf8')
const permissionSource = fs.readFileSync(permissionFile, 'utf8')

assert.match(source, /canAddMenuRecord\(this\.menuId \|\| this\.childMenuId, this\.currentUser\)/,
  '关联 Tab 新增入口必须校验该子菜单的 Add/新增权限')
assert.match(source, /showFloatingAdd && canAdd && !isPreview/,
  '编辑页关联列表悬浮新增按钮必须受 canAdd 控制')
assert.match(source, /v-if="canAdd" class="preview-action preview-action--add"/,
  '详情页关联列表新增按钮必须受 canAdd 控制')
assert.match(source, /if \(!this\.canAdd\)[\s\S]*?当前账号没有新增权限/,
  '关联列表 openAdd 方法必须二次校验新增权限')
assert.match(permissionSource, /filter\(\(item\) => String\(item\.FkId \|\| ''\) === String\(menuId\)\)[\s\S]*?\.some\(\(row\)/,
  '同一用户多个角色的菜单权限必须取并集')

console.log('关联 Tab 列表新增权限检查通过')
