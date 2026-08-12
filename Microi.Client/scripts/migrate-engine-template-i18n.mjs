import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const roots = [
  { directory: path.join(clientRoot, 'src/views/page-engine'), helper: '$pet' },
  { directory: path.join(clientRoot, 'src/views/print-engine'), helper: '$prt' },
]

const walkVueFiles = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const fullPath = path.join(directory, entry.name)
  return entry.isDirectory() ? walkVueFiles(fullPath) : entry.name.endsWith('.vue') ? [fullPath] : []
})

const quote = value => `'${value.replace(/\\/gu, '\\\\').replace(/'/gu, "\\'")}'`

const migrateTemplate = (source, helper) => {
  const templateStart = source.search(/<template\b/iu)
  const scriptStart = source.search(/<script\b/iu)
  if (templateStart < 0 || scriptStart < 0) return source
  const templateEnd = source.lastIndexOf('</template>', scriptStart)
  if (templateEnd < templateStart) return source

  const before = source.slice(0, templateStart)
  const template = source.slice(templateStart, templateEnd + '</template>'.length)
  const after = source.slice(templateEnd + '</template>'.length)
  const comments = []
  let migrated = template.replace(/<!--[\s\S]*?-->/gu, value => {
    const token = `__MICROI_TEMPLATE_COMMENT_${comments.length}__`
    comments.push(value)
    return token
  })

  migrated = migrated.replace(
    /(?<![\w:@-])(aria-label|start-placeholder|end-placeholder|range-separator|label|title|placeholder|confirm-button-text|cancel-button-text)\s*=\s*"([^"\r\n]*\p{Script=Han}[^"\r\n]*)"/gu,
    (_match, attribute, value) => `:${attribute}="${helper}(${quote(value.trim())})"`,
  )

  migrated = migrated.replace(/>([^<>{}]*\p{Script=Han}[^<>{}]*)</gu, (_match, rawValue) => {
    const leading = rawValue.match(/^\s*/u)?.[0] || ''
    const trailing = rawValue.match(/\s*$/u)?.[0] || ''
    const value = rawValue.trim().replace(/\s+/gu, ' ')
    return `>${leading}{{ ${helper}(${quote(value)}) }}${trailing}<`
  })

  comments.forEach((value, index) => {
    migrated = migrated.replace(`__MICROI_TEMPLATE_COMMENT_${index}__`, value)
  })
  return `${before}${migrated}${after}`
}

let changed = 0
for (const { directory, helper } of roots) {
  for (const file of walkVueFiles(directory)) {
    const source = fs.readFileSync(file, 'utf8')
    const migrated = migrateTemplate(source, helper)
    if (migrated === source) continue
    fs.writeFileSync(file, migrated, 'utf8')
    changed += 1
  }
}

for (const relativePath of [
  'src/views/print-engine/engine/utils/provider1.js',
  'src/views/print-engine/engine/utils/provider2.js',
]) {
  const file = path.join(clientRoot, relativePath)
  const source = fs.readFileSync(file, 'utf8')
  let migrated = source
  if (!migrated.includes("from '../i18n.js'")) {
    migrated = migrated.replace(
      /import \{ hiprint \} from "vue-plugin-hiprint";?/u,
      '$&\nimport { printT } from \'../i18n.js\'',
    )
  }
  migrated = migrated
    .replace(/title\s*:\s*"([^"\r\n]*\p{Script=Han}[^"\r\n]*)"/gu, (_match, value) => `title: printT(${quote(value)})`)
    .replace(/PrintElementTypeGroup\("([^"\r\n]*\p{Script=Han}[^"\r\n]*)"/gu, (_match, value) => `PrintElementTypeGroup(printT(${quote(value)})`)
  if (migrated !== source) {
    fs.writeFileSync(file, migrated, 'utf8')
    changed += 1
  }
}

console.log(`Migrated ${changed} Page/Print Vue templates to locale-owned literal rendering.`)
