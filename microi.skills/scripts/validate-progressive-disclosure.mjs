import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const skillsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(fs.readFileSync(path.join(skillsRoot, '.progressive-disclosure-manifest.json'), 'utf8'))
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex')
const lineCount = (value) => value.length === 0 ? 0 : value.split(/\r?\n/).length

let checkedChunks = 0
for (const [skillName, skill] of Object.entries(manifest.skills)) {
  const entryPath = path.join(skillsRoot, skillName, 'SKILL.md')
  const entry = fs.readFileSync(entryPath, 'utf8')
  const begin = entry.indexOf('<!-- microi-progressive:begin -->')
  if (begin < 0) throw new Error(`${skillName}: missing progressive begin marker`)
  const prefix = entry.slice(0, begin)
  if (hash(prefix) !== skill.prefixSha256) throw new Error(`${skillName}: entry prefix changed`)
  if (lineCount(entry) > manifest.policy.maxEntryLines) throw new Error(`${skillName}: entry exceeds line budget`)

  const sources = new Map([[`${skillName}/SKILL.md`, entry]])
  for (const reference of skill.references) {
    const relative = `${skillName}/${reference.path}`
    const content = fs.readFileSync(path.join(skillsRoot, relative), 'utf8')
    if (lineCount(content) > 300) throw new Error(`${relative}: reference exceeds 300 lines`)
    sources.set(relative, content)
  }

  const ordered = []
  for (const chunk of skill.chunks) {
    const source = sources.get(chunk.destination)
    if (source == null) throw new Error(`${skillName}: missing ${chunk.destination}`)
    const open = `<!-- microi-progressive:chunk id=${chunk.id} sha256=${chunk.sha256} -->`
    const startMarker = source.indexOf(open)
    if (startMarker < 0) throw new Error(`${skillName}: missing chunk ${chunk.id}`)
    const contentStart = startMarker + open.length + (source.startsWith('\r\n', startMarker + open.length) ? 2 : 1)
    const close = '<!-- /microi-progressive:chunk -->'
    const contentEnd = source.indexOf(close, contentStart)
    if (contentEnd < 0) throw new Error(`${skillName}: unterminated chunk ${chunk.id}`)
    const raw = source.slice(contentStart, contentEnd)
    if (hash(raw) !== chunk.sha256) throw new Error(`${skillName}: chunk ${chunk.id} changed`)
    ordered[chunk.ordinal] = raw
    checkedChunks += 1
  }
  const reconstructed = prefix + ordered.join('')
  if (hash(reconstructed) !== skill.originalSha256) {
    throw new Error(`${skillName}: reconstructed knowledge differs from original`)
  }
}

console.log(`Validated ${Object.keys(manifest.skills).length} skills and ${checkedChunks} lossless chunks.`)

