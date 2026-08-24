import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const updateLog = await readFile(new URL('../docs/doc/about/update-log.md', import.meta.url), 'utf8')
const styles = await readFile(new URL('../docs/.vitepress/theme/styles/update-log.scss', import.meta.url), 'utf8')
const theme = await readFile(new URL('../docs/.vitepress/theme/index.ts', import.meta.url), 'utf8')

test('更新日志标题下明确区分平台框架与商城应用升级', () => {
  const titleIndex = updateLog.indexOf('# 更新日志')
  const bannerIndex = updateLog.indexOf('class="mci-release-scope-banner"')
  const firstVersionIndex = updateLog.indexOf('## v')

  assert.ok(titleIndex >= 0)
  assert.ok(bannerIndex > titleIndex)
  assert.ok(firstVersionIndex > bannerIndex)
  assert.match(updateLog, /只记录 <strong>Microi吾码 AI 开发框架<\/strong>的升级内容/)
  assert.match(updateLog, /更新前端与后端源码，或拉取并部署对应版本的 Docker 镜像/)
  assert.match(updateLog, /进入平台【应用商城】，按应用查看更新日志并执行安装或更新/)
})

test('更新日志说明 Banner 具备亮暗主题与移动端布局', () => {
  assert.match(theme, /import "\.\/styles\/update-log\.scss"/)
  assert.match(styles, /\.mci-release-scope-banner\s*\{/)
  assert.match(styles, /\.dark \.mci-release-scope-banner/)
  assert.match(styles, /@media \(max-width:\s*700px\)/)
  assert.match(styles, /grid-template-columns:\s*repeat\(2,/)
})
