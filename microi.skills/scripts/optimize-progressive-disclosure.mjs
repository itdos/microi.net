import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const skillsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = path.join(skillsRoot, '.progressive-disclosure-manifest.json')
const maxEntryLines = 285
const keepBudgetLines = 170
const referenceBudgetLines = 245

const hash = (value) => crypto.createHash('sha256').update(value).digest('hex')
const lineCount = (value) => value.length === 0 ? 0 : value.split(/\r?\n/).length
const slug = (value) => value
  .replace(/^#+\s*/, '')
  .replace(/[`*_]/g, '')
  .trim()
  .toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 48) || 'reference'

const splitAtHeading = (value, headingPattern) => {
  const matches = [...value.matchAll(headingPattern)]
  if (matches.length <= 1) return [value]
  const parts = []
  if (matches[0].index > 0) parts.push(value.slice(0, matches[0].index))
  for (let index = 0; index < matches.length; index += 1) {
    parts.push(value.slice(matches[index].index, matches[index + 1]?.index ?? value.length))
  }
  return parts.filter(Boolean)
}

const splitOversized = (value, eol) => {
  if (lineCount(value) <= referenceBudgetLines) return [value]
  let parts = splitAtHeading(value, /^###\s+.+$/gm)
  if (parts.length === 1) parts = splitAtHeading(value, /^####\s+.+$/gm)
  const output = []
  for (const part of parts) {
    if (lineCount(part) <= referenceBudgetLines) {
      output.push(part)
      continue
    }
    const lines = part.split(/\r?\n/)
    let start = 0
    while (start < lines.length) {
      let end = Math.min(start + referenceBudgetLines - 8, lines.length)
      if (end < lines.length) {
        for (let cursor = end; cursor > start + 40; cursor -= 1) {
          if (lines[cursor - 1].trim() === '') {
            end = cursor
            break
          }
        }
      }
      const hasTrailingBreak = end < lines.length || part.endsWith(eol)
      output.push(lines.slice(start, end).join(eol) + (hasTrailingBreak ? eol : ''))
      start = end
    }
  }
  return output
}

const headingOf = (value, fallback) => value.match(/^#{2,4}\s+(.+)$/m)?.[1]?.trim() || fallback

const skillDirectories = fs.readdirSync(skillsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(skillsRoot, entry.name, 'SKILL.md')))
  .map((entry) => entry.name)
  .sort()

const manifest = {
  version: 1,
  generatedAt: new Date().toISOString(),
  policy: {
    maxEntryLines,
    referenceBudgetLines,
    note: 'Original prefix and ordered chunks reconstruct the exact pre-split SKILL.md bytes.'
  },
  skills: {}
}

for (const skillName of skillDirectories) {
  const skillPath = path.join(skillsRoot, skillName, 'SKILL.md')
  const original = fs.readFileSync(skillPath, 'utf8')
  if (lineCount(original) <= 300) continue
  if (original.includes('<!-- microi-progressive:begin -->')) {
    throw new Error(`${skillName} is already optimized; validate instead of running twice`)
  }

  const eol = original.includes('\r\n') ? '\r\n' : '\n'
  const sectionMatches = [...original.matchAll(/^##\s+.+$/gm)]
  if (sectionMatches.length < 2) {
    throw new Error(`${skillName} needs at least two level-2 sections for safe semantic splitting`)
  }
  const prefix = original.slice(0, sectionMatches[0].index)
  const sections = sectionMatches.map((match, index) => ({
    heading: match[0].replace(/^##\s+/, '').trim(),
    raw: original.slice(match.index, sectionMatches[index + 1]?.index ?? original.length),
  }))

  const kept = []
  const moved = []
  let keptLines = lineCount(prefix)
  for (const section of sections) {
    // Keep one contiguous prefix only. Picking a later short section after an
    // earlier section was moved would reorder the original knowledge stream.
    if (moved.length === 0 && (kept.length === 0 || keptLines + lineCount(section.raw) <= keepBudgetLines)) {
      kept.push(section)
      keptLines += lineCount(section.raw)
    } else {
      moved.push(section)
    }
  }
  if (moved.length === 0) {
    moved.push(kept.pop())
  }

  const fragments = moved.flatMap((section) => splitOversized(section.raw, eol).map((raw, index) => ({
    raw,
    heading: headingOf(raw, `${section.heading} (${index + 1})`),
  })))

  const referenceGroups = []
  let current = []
  let currentLines = 5
  for (const fragment of fragments) {
    const cost = lineCount(fragment.raw) + 3
    if (current.length && currentLines + cost > referenceBudgetLines) {
      referenceGroups.push(current)
      current = []
      currentLines = 5
    }
    current.push(fragment)
    currentLines += cost
  }
  if (current.length) referenceGroups.push(current)

  const referencesDirectory = path.join(skillsRoot, skillName, 'references')
  fs.mkdirSync(referencesDirectory, { recursive: true })
  const chunkRecords = []
  let ordinal = 0
  const wrapChunk = (raw, destination) => {
    const id = `${skillName}-${String(ordinal).padStart(3, '0')}`
    const record = {
      id,
      ordinal,
      destination: destination.replaceAll('\\', '/'),
      sha256: hash(raw),
      lines: lineCount(raw),
      heading: headingOf(raw, skillName),
    }
    chunkRecords.push(record)
    ordinal += 1
    return `<!-- microi-progressive:chunk id=${id} sha256=${record.sha256} -->${eol}${raw}<!-- /microi-progressive:chunk -->${eol}`
  }

  const entryChunks = kept.map((section) => wrapChunk(section.raw, `${skillName}/SKILL.md`)).join('')
  const referenceRecords = []
  referenceGroups.forEach((group, index) => {
    const fileName = `progressive-${String(index + 1).padStart(2, '0')}-${slug(group[0].heading)}.md`
    const relative = `references/${fileName}`
    const destination = `${skillName}/${relative}`
    const body = group.map((fragment) => wrapChunk(fragment.raw, destination)).join('')
    const title = `# ${skillName} 详细参考 ${index + 1}${eol}${eol}`
    const note = `> 按需读取；本文件由 SKILL.md 的原章节无损拆分。${eol}${eol}`
    fs.writeFileSync(path.join(referencesDirectory, fileName), title + note + body, 'utf8')
    referenceRecords.push({
      path: relative,
      headings: group.map((fragment) => fragment.heading),
    })
  })

  const routerLines = [
    '## 详细参考路由（渐进披露）',
    '',
    '仅在当前任务涉及对应主题时读取；下列文件合计保留了原 SKILL.md 的全部详细知识。',
    '',
    ...referenceRecords.map((reference) =>
      `- [${reference.path}](${reference.path})：${reference.headings.join('；')}`),
    '',
  ].join(eol)
  const rewritten = prefix
    + `<!-- microi-progressive:begin -->${eol}`
    + entryChunks
    + routerLines
    + `<!-- microi-progressive:end -->${eol}`
  if (lineCount(rewritten) > maxEntryLines) {
    throw new Error(`${skillName} entry remains ${lineCount(rewritten)} lines; lower keepBudgetLines`)
  }
  fs.writeFileSync(skillPath, rewritten, 'utf8')

  manifest.skills[skillName] = {
    originalSha256: hash(original),
    originalLines: lineCount(original),
    prefixSha256: hash(prefix),
    prefixBytes: Buffer.byteLength(prefix),
    entryLines: lineCount(rewritten),
    chunks: chunkRecords,
    references: referenceRecords,
  }
}

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
console.log(`Optimized ${Object.keys(manifest.skills).length} skills; manifest: ${manifestPath}`)
