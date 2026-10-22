const assert = require('node:assert/strict')
const test = require('node:test')
const { assertCompiledStyle } = require('./check-built-profile-styles.cjs')
const source = '<template><view class="home-page" /></template><style scoped>.home-page { height: 100vh; }</style>'

test('拒绝只有变量注释的空 WXSS，覆盖多 Profile 监听编译回归', () => {
  assert.throws(() => assertCompiledStyle(source, '/* uni.scss 变量注释 */', 'home.vue'), /缺少实际样式/)
})
test('拒绝来自其它 Profile 的样式，不能只看产物文件存在', () => {
  assert.throws(() => assertCompiledStyle(source, '.workbench-page { height: auto; }', 'home.vue'), /Profile 模板不匹配/)
})
test('接受当前模板和真实作用域样式', () => {
  assert.equal(assertCompiledStyle(source, '.home-page.data-v-demo { height: 100vh; }', 'home.vue'), true)
})
test('无内联样式的包装组件保持兼容', () => {
  assert.equal(assertCompiledStyle('<template><view /></template>', '', 'wrapper.vue'), false)
})
