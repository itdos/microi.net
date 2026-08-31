import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const formUrl = new URL('../src/views/form-engine/diy-form.vue', import.meta.url)
const styleUrl = new URL('../src/views/form-engine/styles/diy-form.scss', import.meta.url)
const formUtilsUrl = new URL('../src/views/form-engine/mixins/form-utils.mixin.js', import.meta.url)
const formStateUrl = new URL('../src/views/form-engine/mixins/diy-form-state.mixin.js', import.meta.url)
const themeUrl = new URL('../src/styles/mci-admin-theme.scss', import.meta.url)
const dateTimeUrl = new URL('../src/views/form-engine/diy-field-component/diy-datetime.vue', import.meta.url)

test('字段说明按标签方向直接呈现且不再使用信息图标提示', async () => {
  const [source, styles, formUtils, formState, theme, dateTime, formUtilsMixin] = await Promise.all([
    readFile(formUrl, 'utf8'),
    readFile(styleUrl, 'utf8'),
    readFile(formUtilsUrl, 'utf8'),
    readFile(formStateUrl, 'utf8'),
    readFile(themeUrl, 'utf8'),
    readFile(dateTimeUrl, 'utf8'),
    import(formUtilsUrl.href).then((module) => module.default)
  ])

  assert.equal(source.includes('<InfoFilled'), false)
  assert.equal(source.includes('GetLabelPosition(field) === \'top\''), true)
  assert.equal(source.includes('GetLabelPosition(field) !== \'top\''), true)
  assert.equal((source.match(/diy-field-description--inline/g) || []).length, 2)
  assert.equal((source.match(/diy-field-description--below/g) || []).length, 2)
  assert.equal((source.match(/:style="getFieldDescriptionStyle\(field\)"/g) || []).length, 2)
  assert.match(styles, /\.diy-field-description--inline[\s\S]*text-overflow:\s*ellipsis/)
  assert.match(styles, /\.diy-field-description--below[\s\S]*line-clamp:\s*2/)
  assert.match(formUtils, /labelPosition\s*=\s*String\(this\.GetLabelPosition\(field\)[\s\S]*?labelPosition\s*!==\s*'right'/)
  assert.match(formUtils, /marginInlineStart:\s*normalizedWidth/)
  const getDescriptionStyle = formUtilsMixin.methods.getFieldDescriptionStyle
  const styleContext = (position, showLabel = true) => ({
    GetLabelPosition: () => position,
    GetFormLabelWidth: () => '120px',
    shouldShowLabel: () => showLabel
  })
  assert.deepEqual(getDescriptionStyle.call(styleContext('left'), {}), {})
  assert.deepEqual(getDescriptionStyle.call(styleContext('top'), {}), {})
  assert.deepEqual(getDescriptionStyle.call(styleContext('right', false), {}), {})
  assert.deepEqual(getDescriptionStyle.call(styleContext('right'), {}), {
    marginInlineStart: '120px',
    maxWidth: 'calc(100% - 120px)'
  })
  const tallComponents = formState.match(/var tallComponents = \[([\s\S]*?)\];/)?.[1] || ''
  assert.equal(tallComponents.includes("'Checkbox'"), false)
  assert.equal(tallComponents.includes("'Radio'"), false)
  assert.match(theme, /diy-field-description-tooltip[\s\S]*?clip-path:\s*polygon/)
  assert.match(dateTime, /class="diy-datetime-control"/)
  assert.match(dateTime, /\.diy-datetime-control\s*\{[\s\S]*?display:\s*flex;[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0;/)
  const effectiveStyles = styles
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
  const presentationControlRule = effectiveStyles.match(
    /:deep\(\.diy-presentation-field-card \.el-input__wrapper\),\s*:deep\(\.diy-presentation-field-card \.el-select__wrapper\)\s*\{([\s\S]*?)\}/
  )?.[1] || ''
  assert.notEqual(presentationControlRule, '')
  assert.doesNotMatch(presentationControlRule, /(?:^|[;\r\n])\s*height\s*:/m)
  assert.match(presentationControlRule, /min-height:\s*34px;/)
})
