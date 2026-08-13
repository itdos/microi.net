import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const skillsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = path.join(skillsRoot, '.progressive-disclosure-manifest.json')
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const requested = process.argv.slice(2)
if (requested.length === 0) {
  throw new Error('Pass each intentionally changed skill name explicitly.')
}
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex')

for (const skillName of requested) {
  const skill = manifest.skills[skillName]
  if (!skill) throw new Error(`${skillName} is not a progressive-disclosure skill`)
  const sources = new Map()
  const entryPath = path.join(skillsRoot, skillName, 'SKILL.md')
  sources.set(`${skillName}/SKILL.md`, fs.readFileSync(entryPath, 'utf8'))
  for (const reference of skill.references) {
    const destination = `${skillName}/${reference.path}`
    sources.set(destination, fs.readFileSync(path.join(skillsRoot, destination), 'utf8'))
  }

  const ordered = []
  for (const chunk of skill.chunks) {
    let source = sources.get(chunk.destination)
    const openPattern = new RegExp(`<!-- microi-progressive:chunk id=${chunk.id} sha256=[a-f0-9]{64} -->`)
    const match = source.match(openPattern)
    if (!match) throw new Error(`${skillName}: missing chunk ${chunk.id}`)
    const markerStart = match.index
    const markerEnd = markerStart + match[0].length
    const contentStart = markerEnd + (source.startsWith('\r\n', markerEnd) ? 2 : 1)
    const close = '<!-- /microi-progressive:chunk -->'
    const contentEnd = source.indexOf(close, contentStart)
    const raw = source.slice(contentStart, contentEnd)
    const digest = hash(raw)
    source = source.slice(0, markerStart)
      + `<!-- microi-progressive:chunk id=${chunk.id} sha256=${digest} -->`
      + source.slice(markerEnd)
    sources.set(chunk.destination, source)
    chunk.sha256 = digest
    chunk.lines = raw.split(/\r?\n/).length
    ordered[chunk.ordinal] = raw
  }

  for (const [destination, source] of sources) {
    fs.writeFileSync(path.join(skillsRoot, destination), source, 'utf8')
  }
  const entry = sources.get(`${skillName}/SKILL.md`)
  const begin = entry.indexOf('<!-- microi-progressive:begin -->')
  const prefix = entry.slice(0, begin)
  skill.prefixSha256 = hash(prefix)
  skill.prefixBytes = Buffer.byteLength(prefix)
  skill.originalSha256 = hash(prefix + ordered.join(''))
  skill.originalLines = (prefix + ordered.join('')).split(/\r?\n/).length
  skill.entryLines = entry.split(/\r?\n/).length
}

manifest.generatedAt = new Date().toISOString()
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
console.log(`Accepted intentional knowledge updates for: ${requested.join(', ')}`)

