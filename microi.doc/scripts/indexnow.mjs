import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { readFile, writeFile, lstat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { SITE_URL, canonicalPath, isIndexablePage } from '../docs/.vitepress/config/seo-policy.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const endpoint = 'https://api.indexnow.org/indexnow'
const hash = value => createHash('sha256').update(value).digest('hex')
export const changedPaths = ['/', '/doc/', '/contact/', '/case/case-index.html', '/doc/about/partner.html', '/doc/about/update-log.html', '/doc/more/security.html', '/doc/system-engine/databases.html', '/doc/system-engine/ai-engine.html', '/doc/v8-engine/ai-apiengine.html']

export function payload(key, urls) {
  assert.match(key, /^[a-f0-9]{64}$/, 'Invalid private site-verification configuration')
  assert.ok(Array.isArray(urls) && urls.length > 0 && urls.length <= 10000, 'A bounded public URL list is required')
  const urlList = [...new Set(urls.map(value => {
    const url = new URL(value)
    assert.ok(url.origin === SITE_URL && !url.username && !url.password && !url.search && !url.hash, 'Only canonical public site URLs are accepted')
    assert.ok(url.pathname === canonicalPath(url.pathname) && isIndexablePage(url.pathname), 'Utility or noncanonical pages cannot be submitted')
    return url.href
  }))]
  return { host: new URL(SITE_URL).hostname, key, keyLocation: `${SITE_URL}/${key}.indexnow.txt`, urlList }
}

async function boundedText(response, limit) {
  let bytes = 0; const chunks = []
  for await (const chunk of response.body || []) {
    bytes += chunk.byteLength
    assert.ok(bytes <= limit, 'Discovery response exceeds the bounded read limit')
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString('utf8')
}

export async function notify({ key, urls, fetchImpl = fetch, onRecord = async () => {} }) {
  const body = payload(key, urls)
  const report = { schemaVersion: 1, startedAt: new Date().toISOString(), endpoint, host: body.host,
    urls: body.urlList, urlCount: body.urlList.length, retries: 0, indexingConfirmed: false, status: 'Preflight' }
  await onRecord(report)
  let submitting = false
  try {
    const proof = await fetchImpl(body.keyLocation, { redirect: 'error', signal: AbortSignal.timeout(15000) })
    assert.ok(proof.status === 200 && (await boundedText(proof, 4096)).trim() === key, 'Live site verification file is absent or differs')
    const sitemapResponse = await fetchImpl(`${SITE_URL}/sitemap.xml`, { redirect: 'error', signal: AbortSignal.timeout(15000) })
    assert.equal(sitemapResponse.status, 200, 'Live sitemap is unavailable')
    const sitemap = new Set([...(await boundedText(sitemapResponse, 4 * 1024 * 1024)).matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]))
    assert.ok(body.urlList.every(url => sitemap.has(url)), 'Submitted pages must belong to the live indexable sitemap')
    report.siteProofVerified = true; report.status = 'Submitting'; await onRecord(report); submitting = true
    const response = await fetchImpl(endpoint, { method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) })
    report.httpStatus = response.status; report.responseSha256 = hash(await boundedText(response, 4096))
    report.accepted = response.status === 200 || response.status === 202
    report.status = response.status === 200 ? 'Received' : response.status === 202 ? 'ReceivedKeyValidationPending' : 'Rejected'
  } catch {
    report.accepted = false; report.status = submitting ? 'SubmissionOutcomeUnknown' : 'PreflightFailed'
  }
  report.completedAt = new Date().toISOString(); await onRecord(report)
  return report
}

async function privateConfig(filename) {
  filename = path.resolve(filename)
  for (let current = filename; ; current = path.dirname(current)) {
    assert.ok(!(await lstat(current)).isSymbolicLink(), 'Private verification configuration cannot cross a reparse point')
    if (path.dirname(current) === current) break
  }
  const stat = await lstat(filename); assert.ok(stat.isFile(), 'Private verification configuration must be a regular file')
  if (process.platform === 'win32') {
    const quoted = filename.replaceAll("'", "''")
    const script = `$ErrorActionPreference='Stop';$a=Get-Acl -LiteralPath '${quoted}';$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;$allowed=@($sid,'S-1-5-18');if($a.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $sid){exit 1};foreach($r in $a.Access){if($r.AccessControlType -eq 'Allow' -and $r.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -notin $allowed){exit 1}}`
    const result = spawnSync('pwsh', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true, stdio: 'ignore', timeout: 15000 })
    assert.ok(!result.error && result.status === 0, 'Private verification configuration ACL is not restricted to its owner and SYSTEM')
  } else assert.ok((stat.mode & 0o077) === 0 && stat.uid === process.getuid(), 'Private verification configuration permissions are too broad')
  const config = JSON.parse((await readFile(filename, 'utf8')).replace(/^\uFEFF/, ''))
  assert.ok(config.schemaVersion === 1 && config.siteUrl === SITE_URL, 'Verification configuration belongs to a different site')
  payload(config.key, [SITE_URL + '/'])
  return config
}

async function main() {
  const [action, ...args] = process.argv.slice(2); const options = {}
  for (let i = 0; i < args.length; i += 2) { assert.ok(['--config', '--out'].includes(args[i]) && args[i + 1], 'Use prepare[-if-configured] or submit, --config PATH and --out NEW_RECEIPT.json'); options[args[i]] = args[i + 1] }
  assert.ok(['prepare', 'prepare-if-configured', 'submit'].includes(action), 'An explicit prepare or submit action is required')
  const filename = options['--config'] || process.env.MICROI_DOC_INDEXNOW_CONFIG || path.resolve(root, '../.microi-seo/indexnow.json')
  try { await lstat(filename) } catch (error) { if (error.code === 'ENOENT' && action === 'prepare-if-configured') { console.log('IndexNow: no private site configuration; no verification file or network request created.'); return } throw error }
  const { key } = await privateConfig(filename)
  if (action.startsWith('prepare')) {
    const directory = path.join(root, 'docs/public')
    for (const parent of [root, path.join(root, 'docs'), directory]) { const stat = await lstat(parent); assert.ok(stat.isDirectory() && !stat.isSymbolicLink(), 'Verification asset parents must be real directories') }
    const file = path.join(directory, `${key}.indexnow.txt`)
    try { const stat = await lstat(file); assert.ok(stat.isFile() && !stat.isSymbolicLink(), 'Existing verification asset must be a regular file'); assert.equal((await readFile(file, 'utf8')).trim(), key, 'Existing verification asset differs') }
    catch (error) { if (error.code !== 'ENOENT') throw error; await writeFile(file, key + '\n', { flag: 'wx' }) }
    console.log('IndexNow: verification asset prepared from restricted local configuration; no URL submission performed.')
    return
  }
  assert.ok(options['--out'], 'Submission requires a new receipt path; unknown requests are never automatically replayed')
  await writeFile(options['--out'], JSON.stringify({ status: 'Prepared', indexingConfirmed: false }), { flag: 'wx' })
  const report = await notify({ key, urls: changedPaths.map(value => SITE_URL + value), onRecord: value => writeFile(options['--out'], JSON.stringify(value, null, 2) + '\n') })
  console.log(JSON.stringify({ status: report.status, httpStatus: report.httpStatus ?? null, urlCount: report.urlCount, indexingConfirmed: false }))
  if (!report.accepted) process.exitCode = 1
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => { console.error('IndexNow stopped; inspect the redacted receipt and private configuration. No automatic retry.'); process.exitCode = 1 })
