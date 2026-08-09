import test from 'node:test'
import assert from 'node:assert/strict'

import {
  fetchNugetOwnerStats,
  formatCompactDownloads,
  getSearchServiceEndpoints
} from '../docs/.vitepress/theme/utils/nuget-downloads.js'

test('discovers and deduplicates official NuGet search endpoints', () => {
  const endpoints = getSearchServiceEndpoints({
    resources: [
      { '@id': 'https://azuresearch-usnc.nuget.org/query', '@type': 'SearchQueryService' },
      { '@id': 'https://azuresearch-usnc.nuget.org/query', '@type': 'SearchQueryService/3.5.0' },
      { '@id': 'https://azuresearch-ussc.nuget.org/query', '@type': 'SearchQueryService/3.5.0' },
      { '@id': 'https://example.com/query', '@type': 'SearchQueryService/3.5.0' }
    ]
  })

  assert.deepEqual(endpoints, [
    'https://azuresearch-usnc.nuget.org/query',
    'https://azuresearch-ussc.nuget.org/query'
  ])
})

test('aggregates exact-owner packages and selects the freshest official node', async () => {
  const fetchImpl = async url => {
    if (url === 'https://api.nuget.org/v3/index.json') {
      return response({
        resources: [
          { '@id': 'https://azuresearch-usnc.nuget.org/query', '@type': 'SearchQueryService/3.5.0' },
          { '@id': 'https://azuresearch-ussc.nuget.org/query', '@type': 'SearchQueryService/3.5.0' }
        ]
      })
    }

    const isSecondary = url.startsWith('https://azuresearch-ussc.nuget.org/query')
    return response({
      totalHits: 3,
      data: [
        { id: 'Microi.net', owners: ['ITdos'], totalDownloads: isSecondary ? 140 : 120 },
        { id: 'Microi.Core', owners: 'ITdos', totalDownloads: isSecondary ? 90 : 80 },
        { id: 'Unrelated', owners: ['AnotherOwner'], totalDownloads: 999999 }
      ]
    })
  }

  const result = await fetchNugetOwnerStats({ fetchImpl })
  assert.equal(result.totalDownloads, 230)
  assert.equal(result.packageCount, 2)
  assert.equal(result.successfulEndpoints, 2)
  assert.equal(result.isLive, true)
})

test('formats Chinese and English compact download totals without rounding upward', () => {
  assert.equal(formatCompactDownloads(8923506, 'zh-CN'), '892万+')
  assert.equal(formatCompactDownloads(8923506, 'en-US'), '8.9M+')
  assert.equal(formatCompactDownloads(999, 'zh-CN'), '999')
})

test('falls back to the official NuGet search nodes when service discovery fails', async () => {
  const requested = []
  const fetchImpl = async url => {
    requested.push(url)
    if (url === 'https://api.nuget.org/v3/index.json') throw new Error('service index unavailable')
    return response({
      totalHits: 1,
      data: [{ id: 'Microi.net', owners: ['ITdos'], totalDownloads: 8923506 }]
    })
  }

  const result = await fetchNugetOwnerStats({ fetchImpl })
  assert.equal(result.totalDownloads, 8923506)
  assert.equal(result.successfulEndpoints, 2)
  assert.ok(requested.some(url => url.startsWith('https://azuresearch-usnc.nuget.org/query')))
  assert.ok(requested.some(url => url.startsWith('https://azuresearch-ussc.nuget.org/query')))
})

function response(payload) {
  return {
    ok: true,
    async json() { return payload }
  }
}
