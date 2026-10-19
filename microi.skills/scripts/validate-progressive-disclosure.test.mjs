import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const scriptsRoot = path.dirname(fileURLToPath(import.meta.url))
const validator = path.join(scriptsRoot, 'validate-progressive-disclosure.mjs')
const tempRoot = path.resolve(scriptsRoot, '../../.tmp/progressive-disclosure-eol-regression')
const hash = value => crypto.createHash('sha256').update(value).digest('hex')
const eol = (value, ending) => value.replace(/\r\n/g, '\n').replace(/\n/g, ending)
const prefix = '---\nname: sample\n---\n# Sample\n\n'
const bodies = ['## First\nALPHA\n\n', '## Second\nBETA\n\n']
const close = '<!-- /microi-progressive:chunk -->'

function runFixture(options = {}) {
  const { sourceEol = '\n', manifestEol = '\n', prefixManifestEol = manifestEol, chunkManifestEols = [manifestEol, manifestEol], referenceEol = sourceEol, mutation = '' } = options
  fs.mkdirSync(tempRoot, { recursive: true })
  const root = fs.mkdtempSync(path.join(tempRoot, 'case-'))
  // 只删除本次创建的普通私有夹具；原校验器与清单始终只读。
  try {
    const scripts = path.join(root, 'scripts')
    fs.mkdirSync(scripts)
    fs.mkdirSync(path.join(root, 'sample/references'), { recursive: true })
    fs.copyFileSync(validator, path.join(scripts, 'validate-progressive-disclosure.mjs'))
    const chunks = bodies.map((body, ordinal) => ({
      id: `sample-${ordinal}`, ordinal,
      destination: ordinal === 0 ? 'sample/SKILL.md' : 'sample/references/detail.md',
      sha256: hash(eol(body, chunkManifestEols[ordinal]))
    }))
    if (mutation === 'reordered') chunks.forEach(chunk => { chunk.ordinal = 1 - chunk.ordinal })
    const manifest = {
      version: 1,
      policy: { maxEntryLines: 285 },
      skills: { sample: {
        prefixSha256: hash(eol(prefix, prefixManifestEol)),
        originalSha256: hash(eol(prefix, prefixManifestEol) + bodies.map((body, index) => eol(body, chunkManifestEols[index])).join('')),
        references: [{ path: 'references/detail.md' }], chunks
      } }
    }
    if (mutation === 'original-hash') manifest.skills.sample.originalSha256 = '0'.repeat(64)
    const block = (index, body) => `<!-- microi-progressive:chunk id=${chunks[index].id} sha256=${chunks[index].sha256} -->\n${body}${close}\n`
    let actualPrefix = prefix
    let firstBody = bodies[0]
    if (mutation === 'prefix-text') actualPrefix = prefix.replace('Sample', 'Changed')
    if (mutation === 'prefix-whitespace') actualPrefix = prefix.replace('# Sample', '# Sample ')
    if (mutation === 'chunk-text') firstBody = firstBody.replace('ALPHA', 'DELTA')
    if (mutation === 'trailing-newline') firstBody = firstBody.slice(0, -1)
    if (mutation === 'lone-cr') firstBody = firstBody.replace('ALPHA', 'AL\rPHA')
    let entry = actualPrefix + '<!-- microi-progressive:begin -->\n' + block(0, firstBody) + '<!-- microi-progressive:end -->\n'
    if (mutation === 'begin-missing') entry = entry.replace('<!-- microi-progressive:begin -->', '<!-- removed -->')
    const reference = mutation === 'chunk-missing' ? '# Empty reference\n' : '# Reference\n' + block(1, bodies[1])
    const files = [path.join(root, '.progressive-disclosure-manifest.json'), path.join(root, 'sample/SKILL.md'), path.join(root, 'sample/references/detail.md')]
    fs.writeFileSync(files[0], JSON.stringify(manifest))
    fs.writeFileSync(files[1], eol(entry, sourceEol))
    fs.writeFileSync(files[2], eol(reference, referenceEol))
    const before = files.map(file => hash(fs.readFileSync(file)))
    const result = spawnSync(process.execPath, [path.join(scripts, 'validate-progressive-disclosure.mjs'), 'sample'], {
      cwd: root, encoding: 'utf8', timeout: 10_000, windowsHide: true
    })
    assert.equal(result.error, undefined)
    assert.equal(result.signal, null)
    assert.deepEqual(files.map(file => hash(fs.readFileSync(file))), before, 'validation must not rewrite source or manifest')
    return result
  } finally {
    assert.equal(fs.realpathSync(root), root)
    assert.equal(fs.lstatSync(root).isSymbolicLink(), false)
    assert.ok(root.startsWith(tempRoot + path.sep))
    fs.rmSync(root, { recursive: true })
    assert.equal(fs.existsSync(root), false)
  }
}

for (const [name, options] of [
  ['exact LF manifest and source', {}],
  ['mixed recorded EOL reconstructs exact original after LF checkout', { sourceEol: '\n', prefixManifestEol: '\r\n', chunkManifestEols: ['\n', '\r\n'] }],
  ['mixed recorded EOL reconstructs exact original after CRLF checkout', { sourceEol: '\r\n', prefixManifestEol: '\n', chunkManifestEols: ['\r\n', '\n'] }],
  ['exact CRLF manifest and source', { sourceEol: '\r\n', manifestEol: '\r\n' }],
  ['CRLF manifest survives LF checkout', { sourceEol: '\n', manifestEol: '\r\n' }],
  ['LF manifest survives CRLF checkout', { sourceEol: '\r\n', manifestEol: '\n' }],
  ['reference checkout ending may differ without changing text', { sourceEol: '\n', referenceEol: '\r\n', manifestEol: '\r\n' }]
]) {
  test(name, () => {
    const result = runFixture(options)
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /Validated 1 skills and 2 lossless chunks/)
  })
}

for (const [name, mutation, error] of [
  ['prefix body remains significant', 'prefix-text', /entry prefix changed/],
  ['prefix whitespace is not trimmed', 'prefix-whitespace', /entry prefix changed/],
  ['chunk body remains significant', 'chunk-text', /chunk sample-0 changed/],
  ['manifest chunk reordering remains rejected', 'reordered', /reconstructed knowledge differs/],
  ['wrong original hash remains rejected', 'original-hash', /reconstructed knowledge differs/],
  ['missing chunk remains rejected', 'chunk-missing', /missing chunk sample-1/],
  ['last newline remains significant', 'trailing-newline', /chunk sample-0 changed/],
  ['standalone CR is not a line ending conversion', 'lone-cr', /chunk sample-0 changed/],
  ['missing progressive begin remains rejected', 'begin-missing', /missing progressive begin marker/]
]) {
  test(name, () => {
    const result = runFixture({ sourceEol: '\n', manifestEol: '\r\n', mutation })
    assert.equal(result.status, 1)
    assert.match(result.stderr, error)
  })
}
