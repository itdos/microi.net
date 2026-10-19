import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const guide = fs.readFileSync(path.join(root, 'docs/doc/v8-engine/microi-agent.md'), 'utf8')
// 历史发行记录是当时的证据，不作为当前使用方法；只检查更新日志之前的现行说明。
const current = guide.slice(0, guide.indexOf('\n## 更新日志'))

test('current employee guide separates durable message confirmation from model readiness', () => {
  assert.match(current, /未配置模型[^\n]*不回滚[^\n]*消息/)
  assert.match(current, /原请求标识[^\n]*只读核对/)
  assert.doesNotMatch(current, /此在线确认不调用模型/)
  assert.match(current, /不伪造[^\n]*在线/)
})

test('current navigation documents common shortcuts and one settings entry', () => {
  assert.match(current, /AI 员工、插件与自动化任务[^\n]*任务\/工作区上方/)
  assert.match(current, /其余[^\n]*设置/)
  assert.doesNotMatch(current, /侧栏依次为品牌、新会话、工作区、功能区和底栏/)
  assert.match(current, /模型目录[^\n]*预留[^\n]*不改变弹窗高度/)
})

test('upstream revision and release proof remain separate and historical evidence is kept', () => {
  assert.match(current, /0\.2\.1-rc\.2/)
  assert.match(current, /687f282e8625c6b8d11ff58211a90524be2e4317/)
  assert.match(current, /V4\.1[^\n]*模型[^\n]*不是[^\n]*软件版本/)
  assert.match(current, /自动标题仅处理[^\n]*开头完整闭合[^\n]*原有回退/)
  assert.match(current, /历史提供方标题[^\n]*保留用户命名[^\n]*原始事件[^\n]*追加模型请求/)
  assert.match(guide, /^\| 下载资源、官网模式 6、公开浏览器 \| \*\*v1\.4\.3\*\*；渠道 Completed；完整 EXE 与清单回读通过；.+\|$/m)
  assert.match(guide, /^### v1\.4\.2 - \(\d{4}-\d{2}-\d{2}\)$/m)
  assert.match(guide, /^### v1\.4\.1 - \(2026-10-17\)$/m)
  assert.match(guide, /39a0fb9cf7b6cc72e1b78b992d300de02ad89bed/)
  assert.match(guide, /03bfb220f43c95000f1b8e6df2e02595589792cc5ef23b823c24a052b54a1c32/)
  assert.match(guide, /^aside: true$/m)
  assert.match(guide, /^outline: \[2, 3\]$/m)
})
