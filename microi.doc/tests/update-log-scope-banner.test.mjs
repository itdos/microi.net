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

test('更新日志按发布时间倒序排列，并在页面底部保留最早历史', () => {
  const headings = [...updateLog.matchAll(/^## v(\d+)\.(\d+)\.(\d+)(?:（(前端|后端)）)? - \(([^)\r\n]+)\)$/gm)]
    .map(match => ({
      version: [Number(match[1]), Number(match[2]), Number(match[3])],
      track: match[4] || '统一',
      date: match[5],
      dateKey: match[5].length === 10 ? `${match[5]} 00:00` : match[5]
    }))

  assert.ok(headings.length > 500, `应完整读取历史版本，实际只有 ${headings.length} 条`)
  for (let index = 1; index < headings.length; index += 1) {
    const previous = headings[index - 1]
    const current = headings[index]
    assert.match(previous.date, /^\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2})?$/)
    assert.ok(previous.dateKey >= current.dateKey, `发布时间未倒序：${previous.date} 后出现 ${current.date}`)
  }

  assert.ok(headings.at(-1).date <= '2021-12-31 23:59', `页面底部未展示平台早期历史：${headings.at(-1).date}`)
  assert.ok(
    updateLog.indexOf('v2.8.5（后端） - (2025-11-20)') < updateLog.indexOf('v3.12.15（前端） - (2022-12-16 01:16)'),
    '不同版本线也应按发布时间倒序展示'
  )
})

test('旧双版本线均有前后端标识，v4.1.0 分水岭说明清晰', () => {
  const dividerIndex = updateLog.indexOf('<!-- mci-release-version-era:begin -->')
  const lastUnifiedIndex = updateLog.lastIndexOf('## v4.1.0 - (2026-01-04)')
  const firstLegacyIndex = updateLog.indexOf('## v3.5.2（后端） - (2025-12-29)')
  const legacyHeadings = [...updateLog.slice(dividerIndex).matchAll(/^## v\d+\.\d+\.\d+(?:（(前端|后端)）) - /gm)]

  assert.ok(dividerIndex > lastUnifiedIndex)
  assert.ok(firstLegacyIndex > dividerIndex)
  assert.match(updateLog, /这里是前后端版本号合并的分水岭/)
  assert.match(updateLog, /v3\.12\.15（前端） - \(2022-12-16 01:16\)/)
  assert.match(updateLog, /v2\.8\.5（后端） - \(2025-11-20\)/)
  assert.match(updateLog, /本页按发布时间从新到旧排列，页面底部保留平台最早期的更新历史/)
  assert.ok(legacyHeadings.length > 250, `旧版本标识数量异常：${legacyHeadings.length}`)
  assert.doesNotMatch(updateLog.slice(dividerIndex), /^## v\d+\.\d+\.\d+ - /m)
})

test('版本分水岭复用品牌 Banner，并覆盖亮暗主题与窄屏', () => {
  assert.match(updateLog, /class="mci-release-scope-banner mci-release-era-banner"/)
  assert.match(styles, /\.mci-release-era-banner\s*\{/)
  assert.match(styles, /\.dark \.mci-release-era-banner/)
  assert.match(styles, /\.mci-release-era-banner \.mci-release-scope-banner__mark span/)
})
