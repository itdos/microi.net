import test from 'node:test'
import assert from 'node:assert/strict'
import { splitTenantProvisioningError } from '../src/tenant-provisioning-error.js'

test('separates actionable guidance from the exact original exception', () => {
  const value = '数据库账号权限不足\n处理方法：更新 OsClientDbConn\n\n【原始错误详情】\nMySqlException: Access denied\n at CreateTenantDatabaseAccess()'
  assert.deepEqual(splitTenantProvisioningError(value), {
    summary: '数据库账号权限不足\n处理方法：更新 OsClientDbConn',
    details: 'MySqlException: Access denied\n at CreateTenantDatabaseAccess()'
  })
})
test('preserves legacy errors, null input and literal markup', () => {
  assert.deepEqual(splitTenantProvisioningError('legacy failure'), { summary: 'legacy failure', details: '' })
  assert.deepEqual(splitTenantProvisioningError(null), { summary: '', details: '' })
  assert.equal(splitTenantProvisioningError('失败【原始错误详情】<script>literal</script>').details, '<script>literal</script>')
})
