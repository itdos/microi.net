import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/^\uFEFF/u, '')
const guide = read('../docs/doc/system-engine/vision-engine.md')
const v8Server = read('../docs/doc/v8-engine/v8-server.md')
const homepage = read('../docs/doc/index.md')
const sourceArchitecture = read('../docs/doc/getting-started/source-code-architecture.md')
const mapping = JSON.parse(read('../docs/mapping_zh.json'))
const visualProfiles = read('../docs/.vitepress/theme/doc-visual-profiles.js')

test('vision engine has one discoverable Chinese documentation route', () => {
  assert.equal(mapping['vision-engine.md'], '视觉引擎')
  assert.match(visualProfiles, /'system-engine\/vision-engine': 'guide'/u)
  assert.match(homepage, /href="\/doc\/system-engine\/vision-engine"/u)
  assert.match(sourceArchitecture, /\[视觉引擎\]\(\/doc\/system-engine\/vision-engine\)/u)
  assert.match(v8Server, /\[视觉引擎\]\(\.\.\/system-engine\/vision-engine\.md\)/u)
})

test('vision guide preserves runtime, database-first and AI-pending contracts', () => {
  for (const token of [
    'Microi.Vision',
    'V8.Vision',
    'platform-vision-runtime',
    'platform-vision-ai-worker',
    'platform-vision-custom-hook',
    'LocalMatched',
    'AiPending',
    'Unmatched',
    'MatchSource',
    'Microi.AI',
    'RecognizeFramesAsync',
    'V8.Vision.Analyze',
    'V8.Vision.Search',
    'V8.Vision.Stabilize',
    'HNSW',
    'StreamSessionId',
    '暂停',
    '继续',
    '再次识别',
    'builtin-visual-fingerprint-v1',
  ]) assert.match(guide, new RegExp(token.replaceAll('.', '\\.'), 'u'))
})

test('vision guide documents install resources and biometric safety', () => {
  for (const table of [
    'mci_vision_category',
    'mci_vision_subject',
    'mci_vision_sample',
    'mci_vision_request',
    'mci_vision_profile',
  ]) assert.match(guide, new RegExp(table, 'u'))

  assert.match(guide, /CreateIfMissing/u)
  assert.match(guide, /Managed/u)
  assert.match(guide, /明确同意/u)
  assert.match(guide, /不能单独作为处罚、抓捕、解雇或身份认证依据/u)
  assert.match(guide, /误接受率/u)
  assert.match(guide, /误拒绝率/u)
})
