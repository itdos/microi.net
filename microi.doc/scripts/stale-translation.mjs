import { lstatSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, relative, sep } from 'node:path'
import { createHash } from 'node:crypto'

function ordinaryFile(root, file) {
  const rel = relative(root, file)
  if (!rel || rel.startsWith(`..${sep}`) || rel === '..' || resolve(file) === root) throw new Error('Translation path escaped the docs directory')
  let current = root
  const parts = rel.split(sep)
  for (let i = -1; i < parts.length; i++) {
    if (i >= 0) current = resolve(current, parts[i])
    const entry = lstatSync(current)
    if (entry.isSymbolicLink()) throw new Error('Translation path contains a symbolic link or junction')
    if (i === parts.length - 1 && (!entry.isFile() || entry.nlink !== 1)) throw new Error('Translation target must be an ordinary unshared file')
    if (i < parts.length - 1 && !entry.isDirectory()) throw new Error('Translation parent must be a directory')
  }
}

export function withdrawStaleTranslations(docsDirectory, sourcePaths) {
  if (!Array.isArray(sourcePaths) || sourcePaths.length === 0 || sourcePaths.length > 20 || new Set(sourcePaths).size !== sourcePaths.length) throw new Error('Specify 1–20 distinct Chinese source paths')
  const root = resolve(docsDirectory)
  // Validate the complete batch before the first write. The destination language is fixed, never caller-controlled.
  const changes = sourcePaths.map(source => {
    if (typeof source !== 'string' || !/^(?:apiengine|case|contact|doc|faq|guide)\/[a-zA-Z0-9_/-]+\.md$/.test(source) || source.includes('//')) throw new Error('Expected a Chinese Markdown path relative to docs')
    const sourceFile = resolve(root, source)
    const target = `en/${source}`
    const targetFile = resolve(root, target)
    ordinaryFile(root, sourceFile)
    ordinaryFile(root, targetFile)
    const sourceSha256 = createHash('sha256').update(readFileSync(sourceFile)).digest('hex')
    const url = `https://microi.net/${source.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '.html')}`
    const content = `---\ntitle: Translation update pending\ndescription: This English translation has been withdrawn. Consult the current authoritative Chinese document.\nnoindex: true\nsearch: false\nlastUpdated: false\ntranslationStatus: withdrawn-pending-update\ntranslationSource: ${JSON.stringify(source)}\ntranslationSourceSha256: ${sourceSha256}\n---\n\n# Translation update pending\n\nThe previous English translation has been withdrawn because the authoritative source changed. This page is not an updated translation.\n\nPlease consult the [current Chinese document](${url}).\n`
    return { source, target, targetFile, sourceSha256, content, changed: readFileSync(targetFile, 'utf8') !== content }
  })
  for (const item of changes) if (item.changed) writeFileSync(item.targetFile, item.content, 'utf8')
  return changes.map(({ source, target, sourceSha256, changed }) => ({ source, target, sourceSha256, changed, status: 'withdrawn-pending-update' }))
}
