const fs = require('node:fs')
const path = require('node:path')
const { parse } = require('@vue/compiler-sfc')

function assertCompiledStyle(source, css, filename) {
  const { descriptor, errors } = parse(source, { filename })
  if (errors.length) throw new Error(`${filename}: Vue 源码解析失败`)
  const styles = descriptor.styles.map(style => style.content).join('\n').replace(/\/\*[\s\S]*?\*\//g, '')
  if (!/\{[^}]*:/.test(styles)) return false
  const compiled = String(css || '').replace(/\/\*[\s\S]*?\*\//g, '')
  // 仅有 uni.scss 变量注释的空产物也可能被增量编译器报告成功，必须验证实际样式规则。
  if (!/\{[^}]*:/.test(compiled)) throw new Error(`${filename}: WXSS 缺少实际样式规则，请重新编译样式`)
  const rootClass = descriptor.template?.content.match(/\bclass="([A-Za-z][\w-]*)/)?.[1]
  if (rootClass && styles.includes(`.${rootClass}`) && !compiled.includes(`.${rootClass}`)) {
    throw new Error(`${filename}: WXSS 与当前 Profile 模板不匹配（${rootClass}）`)
  }
  return true
}

function checkBuiltProfileStyles(projectRoot, mode = 'dev') {
  const sourceRoot = path.join(projectRoot, 'src')
  const outputRoot = path.join(projectRoot, 'dist', mode, 'mp-weixin')
  if (!fs.existsSync(outputRoot)) throw new Error(`微信产物不存在: ${outputRoot}`)
  let checked = 0
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name)
      if (entry.isDirectory()) walk(file)
      else if (entry.isFile() && file.endsWith('.vue')) {
        const relative = path.relative(sourceRoot, file)
        const output = path.join(outputRoot, relative.replace(/\.vue$/, '.wxss'))
        if (fs.existsSync(output) && assertCompiledStyle(fs.readFileSync(file, 'utf8'), fs.readFileSync(output, 'utf8'), relative)) checked++
      }
    }
  }
  walk(sourceRoot)
  if (!checked) throw new Error('未检查任何包含样式的微信组件')
  return checked
}

if (require.main === module) {
  const mode = process.argv[2] === 'build' ? 'build' : 'dev'
  console.log(`[mp-styles] PASS: ${checkBuiltProfileStyles(path.resolve(__dirname, '..'), mode)} 个 ${mode} 组件的 WXSS 包含真实样式且匹配当前模板`)
}

module.exports = { assertCompiledStyle, checkBuiltProfileStyles }
