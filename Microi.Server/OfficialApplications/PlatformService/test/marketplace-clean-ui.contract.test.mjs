import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const marketplace = await readFile(new URL('../src/Marketplace.vue', import.meta.url), 'utf8')
const clientSdk = await readFile(new URL('../src/utils/microi.v8.js', import.meta.url), 'utf8')
const compactStyles = await readFile(new URL('../src/marketplace-compact.css', import.meta.url), 'utf8')
const modalStyles = await readFile(new URL('../src/marketplace-modal.css', import.meta.url), 'utf8')

test('应用商城以语义 Tab、来源单选和常显复选筛选保留全部业务入口', () => {
  assert.match(marketplace, /role="tablist"/)
  assert.match(marketplace, /data-testid="marketplace-source-group"/)
  assert.match(marketplace, /type="radio"/)
  assert.match(marketplace, /data-testid="marketplace-filter-categories"/)
  assert.match(marketplace, /data-testid="marketplace-filter-application-types"/)
  assert.match(marketplace, /data-testid="marketplace-filter-visibility"/)
  assert.match(marketplace, /type="checkbox"/)
  assert.doesNotMatch(marketplace, /class="(?:hero-menu|filter-menu)"/)
  assert.match(marketplace, /class="card-more"/)
  for (const label of [
    '发布 / 制作离线包',
    '安装离线包',
    '来源设置',
    '全部平台应用安装 / 更新',
    '发布新应用',
    '详情',
    '预览',
    '开发'
  ]) {
    assert.match(marketplace, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})

test('应用卡片预览和首屏几何保持紧凑并覆盖响应式布局', () => {
  assert.match(compactStyles, /\.preview-wrap\s*\{\s*height:\s*92px;/)
  assert.match(compactStyles, /\.market-hero\s*\{[\s\S]*?min-height:\s*58px;/)
  assert.match(compactStyles, /\.hero-copy::before\s*\{[\s\S]*?width:\s*4px;/)
  assert.match(compactStyles, /\.hero-metrics\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4,/)
  assert.match(compactStyles, /\.app-grid\s*\{\s*grid-template-columns:\s*repeat\(5,/)
  assert.match(compactStyles, /@media \(max-width:\s*760px\)[\s\S]*?\.app-grid\s*\{\s*grid-template-columns:\s*1fr;/)
  assert.match(marketplace, /context\.themeTokens\?\.textPrimary/)
  assert.match(marketplace, /context\.themeTokens\?\.textSecondary/)
  assert.match(marketplace, /'--mci-text-on-primary': context\.themeOnPrimary/)
})

test('应用详情展示独立更新日志并对旧商城源诚实降级', () => {
  assert.match(marketplace, /id="marketplace-changelog-title">应用更新日志/)
  assert.match(marketplace, /append\.ChangeLogs/)
  assert.match(marketplace, /append\.ChangeLogAvailable/)
  assert.match(marketplace, /当前应用尚未补录独立更新日志/)
  assert.match(marketplace, /当前商城源尚未提供应用更新日志能力/)
  assert.match(modalStyles, /\.changelog-list::before/)
  assert.match(modalStyles, /article\[data-tone="breaking"\]/)
})

test('平台官方公共源在浏览器边界直连只读接口且绝不携带凭据', () => {
  assert.match(marketplace, /OFFICIAL_SOURCE_API_BASE\s*=\s*'https:\/\/api\.itdos\.com'/)
  assert.match(marketplace, /OFFICIAL_SOURCE_OSCLIENT\s*=\s*'iTdos'/)
  assert.match(marketplace, /function isOfficialPublicSource\(source\)/)
  assert.match(marketplace, /credentials:'omit'/)
  assert.match(marketplace, /apiEngine:true/)
  assert.match(marketplace, /tenantContext:false/)
  assert.match(marketplace, /acceptReturnedToken:false/)
  assert.match(marketplace, /MarketplaceBrowserPublicTransport:options\.browser===true/)
  assert.match(marketplace, /const formalEndpoint=endpointFor\(operation\)/)
  assert.match(marketplace, /const legacyEndpoint='get-microi-store'/)
  assert.match(marketplace, /MarketplaceListRouteFallback:append\.MarketplaceListRouteFallback===true\|\|options\.legacy===true/)
  assert.match(marketplace, /else if\(isOfficialPublicSource\(source\)\)result=await officialPublicRequest\(operation,param\)/)
  assert.match(marketplace, /isOfficialPublicSource\(sourceForm\)\?await discoverOfficialPublicSource\(sourceForm\)/)
  assert.match(clientSdk, /options\.tenantContext !== false/)
  assert.match(clientSdk, /fetchOptions\.credentials = options\.credentials/)
  assert.match(clientSdk, /options\.acceptReturnedToken !== false && options\.auth !== false/)
})

test('官方公共源只在浏览器传输失败时回退同源可信代理', () => {
  assert.match(marketplace, /function marketplaceBusinessError\(result,fallback\)/)
  assert.match(marketplace, /marketplaceBusinessFailure=true/)
  assert.match(marketplace, /function marketplaceBrowserTransportFailure\(value\)/)
  assert.match(marketplace, /if\(!marketplaceBrowserTransportFailure\(error\)\)throw error/)
  assert.match(marketplace, /officialPublicProxyRequest\(operation,param\)/)
  assert.match(marketplace, /client\.post\('\/api\/MarketplaceSource\/Query'/)
  assert.match(marketplace, /MarketplaceProxyFallback:options\.proxy===true/)
  assert.match(marketplace, /failed to fetch\|networkerror\|network request failed\|load failed\|cors/)
})

test('当前租户列表仅在正式路由不存在时回退旧地址，并通过平台 Tips 隐藏原始错误', () => {
  assert.match(marketplace, /function marketplaceListRouteUnavailable\(value\)/)
  assert.match(marketplace, /NoExistData\\\[\(\?:ApiAddress\|ApiEngineKey\)\\\]/)
  assert.match(marketplace, /currentSourceRequest\(source,operation,param\)/)
  assert.match(marketplace, /apiengine\/get-microi-store\?OsClient=/)
  assert.match(marketplace, /MarketplaceListRouteFallback:true/)
  assert.match(marketplace, /action:'showMessage'/)
  assert.match(marketplace, /const options=\{checkCode:false,silentError:true\}/)
  assert.match(marketplace, /actions\.includes\('showMessage'\)/)
  assert.match(clientSdk, /Object\.defineProperty\(error, 'status'/)
  assert.match(clientSdk, /Object\.defineProperty\(error, 'response'/)
  assert.match(clientSdk, /value: \{ status: statusCode, data: body \}/)
  assert.match(marketplace, /当前租户的应用商城接口尚未完成兼容升级/)
  assert.doesNotMatch(marketplace, /class="notice"/)
})

test('应用市场首次加载默认勾选平台应用并提交数组筛选', () => {
  assert.match(marketplace, /const DEFAULT_APPLICATION_TYPE\s*=\s*'Platform'/)
  assert.match(marketplace, /selectedApplicationTypes=ref\(\[DEFAULT_APPLICATION_TYPE\]\)/)
  assert.match(marketplace, /ApplicationTypes:applicationTypeValues/)
  assert.match(marketplace, /Categories:categoryValues/)
  assert.match(marketplace, /Visibility:visibilityFilterValue\.value/)
})

test('相同安装参数失败后再次点击会创建新的幂等任务', () => {
  assert.match(marketplace, /operationId=Date\.now\(\)/)
  assert.match(marketplace, /IdempotencyKey:`marketplace:[^`]*\$\{operationId\}`/)
  assert.match(marketplace, /installingIds\.value\.includes\(key\)/)
})

test('本地安装版本读取失败时失败关闭且不会伪造未安装清单', () => {
  assert.match(marketplace, /installedVersionsReady=ref\(false\)/)
  assert.match(marketplace, /'Id','StoreId','AppId','AppName','AppVersion','AppVersionInstall','PackageVersion','InstallStatus','IsDeleted','InstallTime','UpdateTime','LastCheckTime','CreateTime'/)
  assert.match(marketplace, /_OrderBy:'UpdateTime',_OrderByType:'DESC'/)
  assert.match(marketplace, /normalizeInstalledVersions\(versionResult\.Data\)/)
  assert.match(marketplace, /normalizeInstalledVersions\(applicationResult\.Data\)/)
  assert.match(marketplace, /installedVersionsReady\.value=true/)
  assert.match(marketplace, /if\(!installedVersionsReady\.value\)\{try\{await loadInstalled\(\)\}catch\(error\)\{apps\.value=\[\];dataCount\.value=0;showMessage\(error,'error'\);return\}\}/)
  assert.match(marketplace, /读取本地应用安装状态失败/)
  assert.doesNotMatch(marketplace, /catch\(_\)\{installedVersions\.value=\[\]\}/)
})
