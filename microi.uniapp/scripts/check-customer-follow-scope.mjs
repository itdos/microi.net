import assert from 'node:assert/strict'
import {
  CUSTOMER_FOLLOW_FIELDS,
  customerFollowScopeValues,
  hasCustomerOwner
} from '../src/tenants/xjy/customer-follow-scope.mjs'

const publicValues = {
  [CUSTOMER_FOLLOW_FIELDS.owner]: '',
  [CUSTOMER_FOLLOW_FIELDS.ownerId]: ''
}
assert.equal(hasCustomerOwner(publicValues), false)
assert.deepEqual(customerFollowScopeValues(publicValues), {
  KehuGJZT: '公海',
  KehuGJZTZ: 2
})

const privateById = {
  [CUSTOMER_FOLLOW_FIELDS.owner]: '',
  [CUSTOMER_FOLLOW_FIELDS.ownerId]: 'user-001'
}
assert.equal(hasCustomerOwner(privateById), true)
assert.deepEqual(customerFollowScopeValues(privateById), {
  KehuGJZT: '私有',
  KehuGJZTZ: 1
})

const privateByName = {
  [CUSTOMER_FOLLOW_FIELDS.owner]: '赵157',
  [CUSTOMER_FOLLOW_FIELDS.ownerId]: ''
}
assert.equal(hasCustomerOwner(privateByName), true)
assert.deepEqual(customerFollowScopeValues(privateByName), {
  KehuGJZT: '私有',
  KehuGJZTZ: 1
})

console.log('customer follow scope checks: OK')
