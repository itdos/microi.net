import test from 'node:test'
import assert from 'node:assert/strict'
import { createResourceDirectory, directoryState, registrationRequest, updateRequest, formatResourceBytes, resourceError, resourceSessionIdentity } from '../src/file-resource-directory.mjs'

const caps = { Protocol: 'ManagedFileResource/1', Scope: 'CurrentTenantPublicMetadataOnly', Actions: ['Capabilities', 'Policy', 'List', 'Register', 'Update', 'Evaluate'], NoStorageWrites: true, RuntimeRoutingEnabled: false, DependencyGroupsSupported: false, CrossTenantGovernanceSupported: false }
const row = { Id: 'record-1', Name: '树模型', RowVersion: 7, SourceRevision: 'revision-1', Enabled: 1, Kind: 'PlatformStatic', ObjectKey: 'itdos/scene/tree.glb', Size: 200, ContentHash: 'a'.repeat(64), ContentType: 'model/gltf-binary' }
const staticForm = () => ({ Kind: 'PlatformStatic', Name: '树模型', ObjectKey: 'itdos/scene/tree.glb', Size: '200', ContentHash: 'a'.repeat(64), ContentType: 'model/gltf-binary' })
const list = (rows = [row]) => ({ Rows: rows, TotalCount: rows.length, PageIndex: 1, PageSize: 20, TrafficState: 'Unknown', WindowBytes: null, UseBackup: false })
const success = Data => ({ Code: 1, Data })
function harness(overrides = {}) {
  const calls = []
  const model = createResourceDirectory(async p => {
    calls.push(structuredClone(p))
    if (overrides[p.Action]) return overrides[p.Action](p)
    return success(({ Capabilities: caps, Policy: { FileServerBak: 'https://hub.example:1120', ThresholdBytes: 1073741824, WindowHours: 24, Blockers: [] }, List: list(), Register: { Resource: row, UseBackup: false }, Update: { Resource: { ...row, Name: p.Name, Enabled: p.Enabled ? 1 : 0, RowVersion: 8 }, UseBackup: false }, Evaluate: { ResourceId: row.Id, SourceRevision: row.SourceRevision, Blockers: ['TrustedTrafficCollectorNotConnected'], UseBackup: false } })[p.Action])
  })
  return { model, calls, state: model.state }
}

test('registration sends only current contract metadata, never browser evidence or tenant overrides', () => {
  const payload = registrationRequest({ ...staticForm(), Tenant: 'other', SourceTenant: 'other', Ready: true, WindowBytes: 99999999999, BackupUrl: 'https://attacker' })
  assert.deepEqual(Object.keys(payload.Resource), ['Kind', 'Name', 'ObjectKey', 'ContentHash', 'Size', 'ContentType'])
  assert.equal(payload.Resource.Size, 200)
})
test('application file registration leaves all source metadata to the authoritative backend', () => {
  const result = registrationRequest({ ...staticForm(), Kind: 'ApplicationPublicBuild', SourceFileId: 'file-1' })
  assert.deepEqual(result, { Action: 'Register', Resource: { Kind: 'ApplicationPublicBuild', Name: '树模型', SourceFileId: 'file-1' } })
})
test('signed URLs, traversal, unknown resource kind and unsafe sizes are rejected locally', () => {
  for (const ObjectKey of ['https://host/key?signature=x', 'itdos/../x.js', '/itdos/a.js', 'itdos/%2e/x.js', 'itdos/a b.js', 'itdos\\a.js']) assert.throws(() => registrationRequest({ ...staticForm(), ObjectKey }))
  for (const Size of ['', -1, 0, 1.1, Number.MAX_SAFE_INTEGER + 1, 'nan']) assert.throws(() => registrationRequest({ ...staticForm(), Size }))
  assert.throws(() => registrationRequest({ ...staticForm(), Kind: 'Private' }))
})
test('unknown byte counts remain unknown, and actual zero is displayed independently', () => {
  for (const n of [null, undefined, '', NaN]) assert.equal(formatResourceBytes(n), '未知')
  assert.equal(formatResourceBytes(0), '0 B'); assert.equal(formatResourceBytes(1073741824), '1 GiB')
})
test('update is name/enabled only and preserves the observed CAS row version', () => {
  assert.deepEqual(updateRequest(row, { Name: '新名称', Enabled: false, Ready: true, RowVersion: 1000 }), { Action: 'Update', Id: 'record-1', ExpectedRowVersion: 7, Name: '新名称', Enabled: false })
  assert.throws(() => updateRequest({ ...row, RowVersion: 0 }, { Name: 'x' }))
})
test('initial read checks protocol capabilities, then reads real policy and current-tenant list', async () => {
  const h = harness(); await h.model.refresh()
  assert.deepEqual(h.calls, [{ Action: 'Capabilities' }, { Action: 'Policy' }, { Action: 'List', PageIndex: 1, PageSize: 20 }])
  assert.equal(h.state.policy.ThresholdBytes, 1073741824); assert.equal(h.state.loaded, true)
})
test('unsupported or forbidden capability disables edits without querying records', async () => {
  for (const changed of [{ Protocol: 'other' }, { RuntimeRoutingEnabled: true }, { NoStorageWrites: false }, { CrossTenantGovernanceSupported: true }]) {
    const h = harness({ Capabilities: () => success({ ...caps, ...changed }) }); await h.model.refresh(); await h.model.register(staticForm())
    assert.equal(h.calls.length, 1); assert.equal(h.state.capabilities, null); assert.ok(h.state.error)
  }
})
test('denied admin request never exposes catalogue or attempts a write', async () => {
  const h = harness({ Capabilities: () => ({ Code: 0, Msg: 'PLATFORM_ADMIN_REQUIRED' }) }); await h.model.refresh(); await h.model.register(staticForm())
  assert.equal(h.calls.length, 1); assert.deepEqual(h.state.rows, []); assert.match(h.state.error, /管理员/)
})
test('null count is not converted into zero and failed read is not an empty success', async () => {
  const h = harness({ List: () => success({ ...list(), TotalCount: null }) }); await h.model.refresh(); assert.equal(h.state.total, null)
  const bad = harness({ List: () => success({ Rows: 'invalid' }) }); await bad.model.refresh(); assert.equal(bad.state.loaded, false); assert.ok(bad.state.error)
})
test('unknown errors and transport exceptions cannot echo server payloads or credentials', async () => {
  const h = harness({ Capabilities: () => { throw Error('password=private') } }); await h.model.refresh()
  assert.doesNotMatch(h.state.error, /private|password/); assert.doesNotMatch(resourceError('password=private'), /private/)
})
test('registration reads records after success and never reports successful routing', async () => {
  const h = harness(); await h.model.refresh(); assert.equal(await h.model.register(staticForm()), true)
  assert.deepEqual(h.calls.slice(-2).map(x => x.Action), ['Register', 'List']); assert.match(h.state.notice, /不启用分流/)
})
test('unknown write outcome locks further writes until explicit catalogue reread', async () => {
  let found = false
  const h = harness({ Register: () => { throw Error('disconnect') }, List: () => success(list(found ? [row] : [])) }); await h.model.refresh()
  assert.equal(await h.model.register(staticForm()), false); assert.equal(h.state.writeUncertain, true)
  await h.model.register(staticForm()); assert.equal(h.calls.filter(x => x.Action === 'Register').length, 1)
  await h.model.refresh(); assert.equal(h.state.writeUncertain, true)
  found = true; await h.model.refresh(); assert.equal(h.state.writeUncertain, false)
})
test('confirmed write followed by failed list retains an explicit readback-pending state', async () => {
  let reads = 0
  const h = harness({ List: () => { if (++reads > 1) throw Error('offline'); return success(list()) } }); await h.model.refresh()
  assert.equal(await h.model.update(row, { Name: '新名称', Enabled: true }), false)
  assert.equal(h.state.writeUncertain, true); assert.match(h.state.error, /服务已确认保存/)
})
test('SDK-wrapped unknown failures are treated as uncertain writes rather than permission to retry', async () => {
  for (const Msg of ['Network Error', 'RESOURCE_READBACK_MISMATCH', 'raw internal exception']) {
    const h = harness({ Register: () => ({ Code: 0, Msg }) }); await h.model.refresh(); await h.model.register(staticForm())
    assert.equal(h.state.writeUncertain, true); assert.match(h.state.error, /结果尚未确认/)
  }
})
test('CAS conflict is surfaced and never automatically retried', async () => {
  const h = harness({ Update: () => ({ Code: 0, Msg: 'RESOURCE_CONFLICT' }) }); await h.model.refresh()
  await h.model.update(row, { Name: 'x', Enabled: true }); assert.equal(h.calls.filter(x => x.Action === 'Update').length, 1); assert.match(h.state.error, /其他操作更新/)
})
test('duplicate click during a pending write does not submit twice', async () => {
  let release
  const h = harness({ Register: () => new Promise(resolve => { release = resolve }) }); await h.model.refresh()
  const first = h.model.register(staticForm()); await h.model.register(staticForm()); release(success({ Resource: row, UseBackup: false })); await first
  assert.equal(h.calls.filter(x => x.Action === 'Register').length, 1)
})
test('tenant or account reset discards a late response and clears all previous records', async () => {
  let release
  const h = harness({ Capabilities: () => new Promise(resolve => { release = resolve }) }); const pending = h.model.refresh(); h.model.reset(); release(success(caps)); await pending
  assert.equal(h.calls.length, 1); assert.equal(h.state.loaded, false); assert.equal(h.state.capabilities, null)
})
test('a completed old-session write cannot trigger a list read under the new session', async () => {
  let release
  const h = harness({ Register: () => new Promise(resolve => { release = resolve }) }); await h.model.refresh()
  const pending = h.model.register(staticForm()); h.model.reset(); release(success({ Resource: row, UseBackup: false })); await pending
  assert.equal(h.calls.at(-1).Action, 'Register'); assert.deepEqual(h.state.rows, []); assert.equal(h.state.notice, '')
})
test('evaluation stays bound to selected resource and revision', async () => {
  const h = harness(); await h.model.refresh(); await h.model.evaluate(row); assert.equal(h.state.evaluation.UseBackup, false)
  for (const changed of [{ ResourceId: 'other' }, { SourceRevision: 'new' }, { UseBackup: true }]) {
    const bad = harness({ Evaluate: () => success({ ResourceId: row.Id, SourceRevision: row.SourceRevision, Blockers: [], UseBackup: false, ...changed }) }); await bad.model.refresh(); await bad.model.evaluate(row)
    assert.equal(bad.state.evaluation, null); assert.ok(bad.state.error)
  }
})
test('normal JWT renewal retains a stable session but true session/account/tenant changes do not', () => {
  const token = (session, exp) => `a.${Buffer.from(JSON.stringify({ MicroiSessionId: session, exp })).toString('base64url')}.s`
  const context = { apiBase: 'https://api.example', osClient: 'itdos', currentUser: { Id: 'one' }, token: token('session-1', 1) }
  const identity = resourceSessionIdentity(context)
  assert.equal(resourceSessionIdentity({ ...context, token: token('session-1', 2) }), identity)
  for (const change of [{ token: token('session-2', 3) }, { osClient: 'other' }, { currentUser: { Id: 'two' } }, { token: '' }]) assert.notEqual(resourceSessionIdentity({ ...context, ...change }), identity)
})
test('uncertain mutation survives component disposal in the same session and needs matching target readback', async () => {
  const pending = new Map(), send = async p => p.Action === 'Register' ? (() => { throw Error('lost') })() : success(p.Action === 'Capabilities' ? caps : p.Action === 'Policy' ? { Blockers: [] } : list([]))
  const old = createResourceDirectory(send, directoryState(), pending); old.reset('session-a'); await old.refresh(); await old.register(staticForm()); old.dispose()
  const next = createResourceDirectory(send, directoryState(), pending); next.reset('session-a'); await next.refresh(); assert.equal(next.state.writeUncertain, true)
  next.reset('session-b'); await next.refresh(); assert.equal(next.state.writeUncertain, false)
  const confirmed = createResourceDirectory(async p => success(p.Action === 'Capabilities' ? caps : p.Action === 'Policy' ? { Blockers: [] } : list()), directoryState(), pending); confirmed.reset('session-a'); await confirmed.refresh(); assert.equal(confirmed.state.writeUncertain, false)
})
test('a definitive rejection after tab unmount clears only the original pending mutation', async () => {
  const pending = new Map(); let finish
  const send = async p => p.Action === 'Update' ? new Promise(resolve => { finish = resolve }) : success(p.Action === 'Capabilities' ? caps : p.Action === 'Policy' ? { Blockers: [] } : list())
  const old = createResourceDirectory(send, directoryState(), pending); old.reset('session-a'); await old.refresh()
  const save = old.update(row, { Name: 'not-saved', Enabled: false }); old.dispose(); finish({ Code: 0, Msg: 'RESOURCE_CONFLICT' }); await save
  assert.equal(pending.size, 0)
  const next = createResourceDirectory(send, directoryState(), pending); next.reset('session-a'); await next.refresh(); assert.equal(next.state.writeUncertain, false)
})

test('backend rejection certainty is separate from friendly display messages', async () => {
  for (const Msg of ['INVALID_FILE_SERVER_BASE', 'UNSUPPORTED_SOURCE_PROVIDER', 'APPLICATION_METADATA_MUST_BE_AUTHORITATIVE']) {
    const h = harness({ Register: () => ({ Code: 0, Msg }) }); await h.model.refresh(); await h.model.register(staticForm())
    assert.equal(h.state.writeUncertain, false); assert.ok(h.state.error)
  }
  for (const Msg of ['NETWORK_UNAVAILABLE', 'WRITE_RESULT_UNKNOWN', 'RESPONSE_INVALID', 'RESOURCE_OPERATION_FAILED']) {
    const h = harness({ Register: () => ({ Code: 0, Msg }) }); await h.model.refresh(); await h.model.register(staticForm())
    assert.equal(h.state.writeUncertain, true)
  }
})
