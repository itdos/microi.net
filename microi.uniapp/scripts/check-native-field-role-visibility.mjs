import assert from 'node:assert/strict'
import {
  currentUserRoleIds,
  filterFieldsByHiddenCollapseScope,
  isPlatformAdmin,
  nativeFieldRoleVisibility,
  nativeRoleCacheKey,
  normalizeRoleIds
} from '../src/platform/native-field-visibility.mjs'

const salesId = 'ROLE-SALES'
const financeId = 'role-finance'

assert.deepEqual(normalizeRoleIds(`[{"Id":"${salesId}"},"${financeId}"]`), ['role-sales', 'role-finance'])
assert.deepEqual(currentUserRoleIds({ _Roles: [{ Id: salesId }], Roles: JSON.stringify([{ Id: financeId }]) }), ['role-sales', 'role-finance'])
assert.equal(nativeFieldRoleVisibility({ BindRole: JSON.stringify([salesId]) }, { RoleIds: [salesId] }).visible, true)
assert.equal(nativeFieldRoleVisibility({ BindRole: JSON.stringify([salesId]) }, { RoleIds: [financeId] }).visible, false)
assert.equal(nativeFieldRoleVisibility({ BindRole: '[]' }, {}).visible, true)
assert.equal(nativeFieldRoleVisibility({ BindRole: JSON.stringify([salesId]) }, { _IsAdmin: true }).visible, true)
assert.equal(isPlatformAdmin({ Level: 9999 }), true)
assert.notEqual(nativeRoleCacheKey({ RoleIds: [salesId] }), nativeRoleCacheKey({ RoleIds: [financeId] }))

const scopedFields = filterFieldsByHiddenCollapseScope([
  { Name: 'Before', component: 'Text', visible: true },
  {
    Name: 'RestrictedGroup',
    component: 'CollapseGroup',
    visible: false,
    config: { CollapseGroup: { ScopeMode: 'FieldCount', FieldCount: 1 } }
  },
  { Name: 'RestrictedChild', component: 'TableChild', visible: true },
  { Name: 'After', component: 'Text', visible: true }
], {
  layoutComponents: ['CollapseGroup', 'Divider', 'Tabs'],
  guardedComponents: []
})
assert.deepEqual(scopedFields.map((field) => field.Name), ['Before', 'After'])

console.log('Native field BindRole visibility checks passed.')
