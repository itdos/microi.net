import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_MARKETPLACE_STATE,
  buildMarketplaceHref,
  readMarketplaceState
} from '../docs/.vitepress/theme/utils/marketplace-query-state.js'

test('reads shareable marketplace filters from stable English query keys', () => {
  assert.deepEqual(
    readMarketplaceState('?category=game&sort=FavoriteCount&q=%E9%BA%BB%E5%B0%86'),
    { category: 'game', sort: 'FavoriteCount', q: '麻将' }
  )
})

test('keeps the virtual recommended category shareable in the URL', () => {
  assert.deepEqual(
    readMarketplaceState('?category=recommended'),
    { ...DEFAULT_MARKETPLACE_STATE, category: 'recommended' }
  )
  assert.equal(
    buildMarketplaceHref(
      { pathname: '/apps.html', search: '', hash: '#ai-apps' },
      { ...DEFAULT_MARKETPLACE_STATE, category: 'recommended' }
    ),
    '/apps.html?category=recommended#ai-apps'
  )
})

test('falls back safely for invalid category and sort values', () => {
  assert.deepEqual(
    readMarketplaceState('?category=%3Cscript%3E&sort=drop-table&q=%20%20Texas%20%20'),
    { ...DEFAULT_MARKETPLACE_STATE, q: 'Texas' }
  )
})

test('writes filters while preserving unrelated query parameters and hash', () => {
  const href = buildMarketplaceHref(
    { pathname: '/apps.html', search: '?from=share&category=office', hash: '#ai-apps' },
    { category: 'game', sort: 'ViewCount', q: '斗地主' }
  )
  assert.equal(href, '/apps.html?from=share&category=game&sort=ViewCount&q=%E6%96%97%E5%9C%B0%E4%B8%BB#ai-apps')
})

test('removes default filters to keep the canonical URL compact', () => {
  const href = buildMarketplaceHref(
    { pathname: '/apps.html', search: '?category=game&sort=ViewCount&q=card', hash: '' },
    DEFAULT_MARKETPLACE_STATE
  )
  assert.equal(href, '/apps.html')
})
