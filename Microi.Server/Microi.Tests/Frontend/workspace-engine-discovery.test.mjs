import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import workspacePaths from '../../../microi.uniapp/scripts/lib/workspace-paths.js'

const workspaceRoot = fileURLToPath(new URL('../../../', import.meta.url))

function fixture(t) {
  const tempParent = path.join(workspaceRoot, '.tmp')
  fs.mkdirSync(tempParent, { recursive: true })
  const root = fs.mkdtempSync(path.join(tempParent, 'engine-discovery-test-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const engineRoot = path.join(root, 'Microi-V8-Engine', '集福鲤平台 (api.jifulii.com)', 'xjy.Product.Internal', '接口引擎')
  fs.mkdirSync(engineRoot, { recursive: true })
  const write = (relative) => {
    const file = path.join(engineRoot, relative)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, 'return { Code: 1 }')
    return file
  }
  return { root, engineRoot, write, find: (key) => workspacePaths.findSyncedXjyEngine(root, key, root) }
}

test('接口引擎分类和标题变更后仍按唯一 ApiEngineKey 定位', (t) => {
  const { find, write } = fixture(t)
  const oldFile = write('未分类/旧标题(target-key).js')
  assert.equal(find('target-key'), oldFile)
  const renamedFile = write('小程序客户/子分类/新标题(target-key).js')
  fs.rmSync(oldFile)
  assert.equal(find('target-key'), renamedFile)
})

test('显示名称含 Key、相似 Key 和其它扩展名不会被误选', (t) => {
  const { find, write } = fixture(t)
  write('分类/target-key(other-key).js')
  write('分类/扩展(target-key-extra).js')
  write('分类/备份(target-key).js.bak')
  const expected = write('分类/正式(target-key).js')
  assert.equal(find('target-key'), expected)
})

test('同步器重复显示 Key 的文件名仍匹配末尾精确 Key', (t) => {
  const { find, write } = fixture(t)
  const expected = write('通讯录/系统人员(get-sysUser-list)(get-sysUser-list).js')
  assert.equal(find('get-sysUser-list'), expected)
})

test('不同分类存在相同 Key 时拒绝任意选择', (t) => {
  const { find, write } = fixture(t)
  write('甲/标题(target-key).js')
  write('乙/标题(target-key).js')
  assert.throws(() => find('target-key'), (error) => {
    assert.match(error.message, /^Ambiguous synced xjy ApiEngineKey target-key:/)
    assert.ok(error.message.includes('甲/标题(target-key).js'))
    assert.ok(error.message.includes('乙/标题(target-key).js'))
    return true
  })
})

test('快照或 Key 缺失时明确提示官方拉取，不能回退到猜测路径', (t) => {
  const { find, engineRoot } = fixture(t)
  assert.throws(() => find('missing-key'), /not found.*official microi pull api/)
  fs.rmSync(engineRoot, { recursive: true })
  assert.throws(() => find('missing-key'), /Synced xjy API engines not found.*official microi pull api/)
})

test('非法 Key 和符号链接不会逃离当前租户快照', (t) => {
  const { find, root, engineRoot, write } = fixture(t)
  for (const key of ['', ' ', null, '../secret', 'dir\\secret', 'bad\0key']) {
    assert.throws(() => find(key), /ApiEngineKey without path separators/)
  }
  const outside = path.join(root, 'outside')
  fs.mkdirSync(outside)
  fs.writeFileSync(path.join(outside, '外部(target-key).js'), '')
  fs.symlinkSync(outside, path.join(engineRoot, '外部链接'), 'dir')
  const expected = write('当前分类/正式(target-key).js')
  assert.equal(find('target-key'), expected)
})
