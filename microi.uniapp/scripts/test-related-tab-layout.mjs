import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { test } from 'node:test'
import { isStandaloneChildLayout } from '../src/platform/related-tab-layout.mjs'

const child = key => ({ key, type: 'child', field: { Name: key } })
const pages = ['business/detail', 'native-form/index', 'module/detail']

for (const route of pages) {
  const source = readFileSync(new URL(`../src/pages/${route}.vue`, import.meta.url), 'utf8')
  const body = source.match(/standaloneListMode\(\)\s*\{([^}]+)\}/)[1]
  const compute = vm.runInNewContext(`(function () { ${body} })`, { isStandaloneChildLayout })
  const state = (groups, relations, extra = {}) => ({
    loading: false, error: '', groups, visibleSections: groups,
    standaloneRelatedTabs: relations, standaloneChildTab: relations.find(item => item.type === 'child'),
    ...extra
  })

  test(`${route}: long form plus follow-up child keeps page scrolling in View/Add/Edit`, () => {
    for (const mode of ['View', 'Add', 'Edit']) {
      const groups = [{ fields: Array.from({ length: 20 }, (_, i) => ({ Name: `field${i}` })) }]
      assert.equal(compute.call(state(groups, [child('followups')], { mode })), false)
    }
  })

  test(`${route}: tab switches restore full list only for a single standalone child`, () => {
    const fields = [{ fields: [{ Name: 'title' }] }]
    assert.equal(compute.call(state(fields, [])), false)
    assert.equal(compute.call(state([], [child('followups')])), true)
    assert.equal(compute.call(state(fields, [child('followups')])), false)
    assert.equal(compute.call(state([], [child('followups'), child('contacts')])), false)
    assert.equal(compute.call(state([], [child('followups'), { type: 'join' }])), false)
    assert.equal(compute.call(state([], [child('followups')], { loading: true })), false)
    assert.equal(compute.call(state([], [child('followups')], { error: 'offline' })), false)
  })
}

test('embedded groups retain their own preview layout and never lock the whole form', () => {
  assert.equal(isStandaloneChildLayout([{ source: 'CollapseGroup', relatedFields: [child('contacts')] }], []), false)
  assert.equal(isStandaloneChildLayout(), false)
})
