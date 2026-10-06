<template>
  <main
    class="marketplace"
    data-testid="marketplace-page"
    :data-theme="themeMode"
    :data-palette="context.themePalette || 'custom'"
    :style="{
      '--accent-brand': context.themeColor || '#2563eb',
      '--accent': context.themePrimaryText || context.themeColor || '#2563eb',
      '--accent-strong': context.themeColorStrong || context.themePrimaryText || context.themeColor || '#1d4ed8',
      '--accent-on': context.themeOnPrimary || '#ffffff',
      '--ink': context.themeTokens?.textPrimary || (themeMode === 'dark' ? '#e5edf8' : '#0f172a'),
      '--muted': context.themeTokens?.textSecondary || (themeMode === 'dark' ? '#b4c0d0' : '#475569'),
      '--line': context.themeTokens?.border || (themeMode === 'dark' ? '#334155' : '#cbd5e1'),
      '--panel': context.themeTokens?.surface || (themeMode === 'dark' ? '#111c2e' : '#ffffff'),
      '--soft': context.themeTokens?.surfaceSoft || (themeMode === 'dark' ? '#172337' : '#f1f5f9'),
      '--mci-color-primary': context.themeColor || '#2563eb',
      '--mci-color-primary-on-surface': context.themePrimaryText || context.themeColor || '#2563eb',
      '--mci-color-primary-strong': context.themeColorStrong || context.themeColor || '#1d4ed8',
      '--mci-text-on-primary': context.themeOnPrimary || '#ffffff',
      '--mci-text-primary': context.themeTokens?.textPrimary || (themeMode === 'dark' ? '#e5edf8' : '#0f172a'),
      '--mci-text-secondary': context.themeTokens?.textSecondary || (themeMode === 'dark' ? '#b4c0d0' : '#475569'),
      '--mci-bg-card': context.themeTokens?.surface || (themeMode === 'dark' ? '#111c2e' : '#ffffff'),
      '--mci-bg-soft': context.themeTokens?.surfaceSoft || (themeMode === 'dark' ? '#172337' : '#f1f5f9'),
      '--mci-border-color': context.themeTokens?.border || (themeMode === 'dark' ? '#334155' : '#cbd5e1')
    }"
  >
    <header class="market-hero" data-testid="marketplace-presentation">
      <div class="hero-copy" data-testid="marketplace-title-card">
        <p><i aria-hidden="true"></i>MICROI MARKETPLACE</p>
        <h1>应用商城</h1>
        <small>每个主租户与子租户都可以发布公开或私有应用，并从任意可信吾码平台安装指定版本。</small>
      </div>
      <div class="hero-metrics" aria-label="应用商城概览">
        <span class="is-primary" data-testid="marketplace-metric-sources"><i aria-hidden="true">◈</i><small>启用来源</small><b>{{ enabledSources.length }}</b></span>
        <span class="is-info" data-testid="marketplace-metric-results"><i aria-hidden="true">▦</i><small>{{ viewMode === 'published' ? '我的发布' : '当前结果' }}</small><b>{{ dataCount }}</b></span>
        <span class="is-success" data-testid="marketplace-metric-installed"><i aria-hidden="true">✓</i><small>已安装</small><b>{{ installedCount }}</b></span>
        <span class="is-warning" data-testid="marketplace-metric-updates"><i aria-hidden="true">↻</i><small>可更新</small><b>{{ updateCount }}</b></span>
      </div>
    </header>

    <div v-if="notice.text" class="market-tips" :class="notice.type" role="status" aria-live="polite">{{ notice.text }}</div>

    <nav class="market-tabs" role="tablist" aria-label="应用商城功能" data-testid="marketplace-tablist">
      <button v-for="tab in viewTabs" :id="`marketplace-tab-${tab.key}`" :key="tab.key" role="tab" :data-testid="`marketplace-tab-${tab.key}`" :aria-selected="viewMode === tab.key" :aria-controls="`marketplace-panel-${tab.key}`" :tabindex="viewMode === tab.key ? 0 : -1" :class="{ active: viewMode === tab.key }" @click="setViewMode(tab.key)">
        <span>{{ tab.label }}</span><b v-if="tab.count !== null">{{ tab.count }}</b>
      </button>
    </nav>

    <section v-if="viewMode !== 'offline'" :id="`marketplace-panel-${viewMode}`" class="market-content" role="tabpanel" :aria-labelledby="`marketplace-tab-${viewMode}`">
      <fieldset v-if="viewMode !== 'published'" class="source-picker" aria-label="商城来源" data-testid="marketplace-source-group">
        <legend>商城来源</legend>
        <div class="source-picker__options">
          <label v-for="source in enabledSources" :key="source.Id" :class="{ active: activeSourceId === source.Id }">
            <input name="marketplace-source" type="radio" :value="source.Id" :data-source-id="source.Id" :checked="activeSourceId === source.Id" @change="selectSource(source.Id)" />
            <span><b>{{ source.Name }}</b><small>{{ source.OsClient }}</small></span>
          </label>
        </div>
        <div v-if="effectiveSource" class="source-picker__summary">
          <span class="source-type">{{ sourceTypeText(effectiveSource) }}</span>
          <b>{{ effectiveSource.OsClient }}</b>
          <small>{{ sourceHost(effectiveSource) }}</small>
          <em>{{ effectiveSource.AccessibleApplicationCount ?? '—' }} 个应用<span v-if="effectiveSource.HasCredential"> · 已登录</span></em>
        </div>
        <button class="source-manage-button" title="ApiBase + OsClient" @click="openSourceEditor()">来源设置</button>
      </fieldset>

      <section class="market-toolbar">
        <div class="market-toolbar__main">
          <label class="search-box"><span>⌕</span><input v-model="keyword" data-testid="marketplace-search" placeholder="搜索名称、介绍、作者或 Key" @keyup.enter="loadApps(1)" /></label>
          <div class="toolbar-actions">
            <button class="toolbar-button" data-testid="marketplace-refresh" @click="loadApps(1)">刷新</button>
            <button v-if="viewMode === 'marketplace' && canInstallFromActiveSource" class="toolbar-button strong" data-testid="marketplace-batch-install" :disabled="batchLoading" @click="installAll">{{ batchLoading ? '正在提交…' : '全部平台应用安装 / 更新' }}</button>
            <button v-if="viewMode === 'published'" class="toolbar-button strong" data-testid="marketplace-publish" @click="openStoreForm('Add')">＋ 发布新应用</button>
          </div>
        </div>
        <div class="market-filters" aria-label="应用筛选">
          <fieldset class="filter-group filter-group--category" data-testid="marketplace-filter-categories">
            <legend>应用分类 <small>未勾选表示全部</small></legend>
            <div>
              <label v-for="item in categoryFilterOptions" :key="item.key" :class="{ active: selectedCategories.includes(item.key) }">
                <input type="checkbox" :value="item.key" :aria-label="item.label" data-filter-kind="category" :data-filter-value="item.key" :checked="selectedCategories.includes(item.key)" @change="toggleCategory(item.key, $event.target.checked)" />
                <span>{{ item.label }}</span>
              </label>
            </div>
          </fieldset>
          <div class="market-filters__secondary">
            <fieldset class="filter-group filter-group--type" data-testid="marketplace-filter-application-types">
              <legend>应用类型 <small>未勾选表示全部</small></legend>
              <div>
                <label v-for="item in applicationTypeFilterOptions" :key="item.key" :class="{ active: selectedApplicationTypes.includes(item.key) }">
                  <input type="checkbox" :value="item.key" :aria-label="item.label" data-filter-kind="application-type" :data-filter-value="item.key" :checked="selectedApplicationTypes.includes(item.key)" @change="toggleApplicationType(item.key, $event.target.checked)" />
                  <span>{{ item.label }}</span>
                </label>
              </div>
            </fieldset>
            <fieldset class="filter-group filter-group--visibility" data-testid="marketplace-filter-visibility">
              <legend>公开范围</legend>
              <div>
                <label v-for="item in visibilityOptions" :key="item.key" :class="{ active: selectedVisibilities.includes(item.key) }">
                  <input type="checkbox" :value="item.key" :aria-label="item.label" data-filter-kind="visibility" :data-filter-value="item.key" :checked="selectedVisibilities.includes(item.key)" @change="toggleVisibility(item.key, $event.target.checked)" />
                  <span>{{ item.label }}</span>
                </label>
              </div>
            </fieldset>
          </div>
        </div>
        <p v-if="effectiveSource" class="market-toolbar__source-context">
          <span>{{ effectiveSource.Name }}</span>
          <em v-if="isOfficialSourceReadOnly(effectiveSource)">平台官方源 · 只读展示</em>
          <em v-else-if="sameAsCurrent(effectiveSource) && viewMode !== 'published'">当前租户不能把应用安装到自身</em>
          <em v-else-if="effectiveSource.HasCredential">私有来源已登录</em>
        </p>
      </section>

      <section v-if="loading" class="app-grid loading-grid"><i v-for="item in 8" :key="item"></i></section>
      <section v-else-if="apps.length" class="app-grid">
        <article v-for="app in apps" :key="appCardKey(app)" class="app-card">
          <div class="preview-wrap">
            <img v-if="previewUrl(app)" :src="previewUrl(app)" :alt="`${appName(app)}预览图`" loading="lazy" @error="markPreviewFailed(app)" />
            <div v-else class="preview-fallback"><span>{{ appInitial(app) }}</span><small>{{ categoryLabel(app.Category) }}</small></div>
            <span class="visibility-badge" :class="isPublicApp(app) ? 'public' : 'private'">{{ isPublicApp(app) ? '公开' : '私有' }}</span>
            <span v-if="isOfficialSourceReadOnly(effectiveSource)" class="official-source-badge">平台官方源</span>
          </div>
          <div class="app-body">
            <div class="app-heading">
              <div><span>{{ app.ApplicationType || app.AppType || 'Platform' }}</span><h2>{{ appName(app) }}</h2><small>{{ app.AppId || app.AppKey || app.StoreId }}</small></div>
              <span class="install-state" :class="installStateClass(app)">{{ installStateText(app) }}</span>
            </div>
            <p class="app-description">{{ appDescription(app) }}</p>
            <div class="version-line"><span>商城版本 <b>{{ app.AppVersion || app.Version || '—' }}</b></span><span v-if="installedVersion(app)" class="installed-version">已装 <b>{{ installedVersion(app) }}</b></span></div>
            <div class="app-meta"><span>{{ categoryLabel(app.Category) }}</span><span>{{ app.AppAuthor || app.OwnerName || '未知作者' }}</span><span>{{ Number(app.InstallCount || 0) }} 次安装</span></div>
          </div>
          <footer>
            <button class="detail" @click="openDetail(app)">详情</button>
            <details v-if="canPreviewApp(app) || canDevelopApp(app)" class="card-more">
              <summary aria-label="更多应用操作">•••</summary>
              <div>
                <button v-if="canPreviewApp(app)" class="preview-action" @click="openAppPreview(app)">预览</button>
                <button v-if="canDevelopApp(app)" class="develop-action" @click="openAppDevelopment(app)">开发</button>
              </div>
            </details>
            <button v-if="viewMode === 'published'" class="install" @click="openStoreForm('Edit', app)">编辑 / 制作</button>
            <button v-else-if="canInstallApp(app)" class="install" :disabled="installingIds.includes(appCardKey(app)) || app.StoreInstallStatus === 'Abnormal'" @click="prepareInstall(app)">{{ installingIds.includes(appCardKey(app)) ? '提交中…' : installText(app) }}</button>
            <span v-else-if="isOfficialSourceReadOnly(effectiveSource) && !canPreviewApp(app) && !canDevelopApp(app)" class="official-inline">当前平台官方源</span>
          </footer>
        </article>
      </section>
      <section v-else class="empty"><b>没有匹配的应用</b><p>可更换来源、分类、类型或清空搜索条件后重试。</p></section>

      <footer v-if="dataCount > 0" class="pager" aria-label="分页">
        <label>每页 <select v-model.number="pageSize" @change="loadApps(1)"><option :value="15">15</option><option :value="30">30</option><option :value="50">50</option><option :value="100">100</option></select> 条</label>
        <button :disabled="pageIndex <= 1" @click="loadApps(1)">首页</button><button :disabled="pageIndex <= 1" @click="loadApps(pageIndex - 1)">上一页</button>
        <button v-for="page in visiblePageNumbers" :key="page" :class="{ active: page === pageIndex }" @click="loadApps(page)">{{ page }}</button>
        <button :disabled="pageIndex >= pageCount" @click="loadApps(pageIndex + 1)">下一页</button><button :disabled="pageIndex >= pageCount" @click="loadApps(pageCount)">末页</button>
        <span>共 {{ dataCount }} 条 / {{ pageCount }} 页</span><label>跳至 <input v-model.number="jumpPage" type="number" min="1" :max="pageCount" @keyup.enter="jumpToPage" /> 页</label><button @click="jumpToPage">跳转</button>
      </footer>
    </section>

    <section v-else id="marketplace-panel-offline" class="offline-panel" role="tabpanel" aria-labelledby="marketplace-tab-offline">
      <div class="offline-icon">⇩</div><p>OFFLINE PACKAGE</p><h2>安装应用离线包</h2><span>离线包仍通过统一导入器进入持久化后台任务；可关闭页面后在右上角任务中心查看进度。</span>
      <label class="file-drop" :class="{ ready: offlineFile }"><input type="file" accept=".json,application/json" @change="selectOfflineFile" /><b>{{ offlineFile ? offlineFile.name : '选择应用离线包 JSON' }}</b><small>{{ offlineFile ? formatBytes(offlineFile.size) : '单个文件最大 50 MB' }}</small></label>
      <button class="offline-install" :disabled="!offlineFile || offlineLoading" @click="installOfflinePackage">{{ offlineLoading ? '正在提交…' : '开始后台安装' }}</button>
    </section>

    <dialog ref="sourceDialog" v-if="sourceEditorVisible" class="modal-backdrop" :class="overlayClass" @cancel.prevent="closeSourceEditor" @click.self="closeSourceEditor">
      <section class="modal-shell source-editor" data-drag-name="source" :style="dragStyle('source')">
        <header class="modal-header draggable" @pointerdown="startDrag($event, 'source')"><div><span>FEDERATED SOURCES</span><h2>商城源管理</h2><p>来源修改后立即保存，不再需要“保存全部来源”。</p></div><button aria-label="关闭" @click="closeSourceEditor">×</button></header>
        <div class="modal-scroll">
          <div class="source-list">
            <article v-for="source in sources" :key="source.Id" :class="{ selected: sourceForm.Id === source.Id }">
              <div><b>{{ source.Name }}</b><small>{{ source.ApiBase }} · {{ source.OsClient }}</small><em>{{ source.AccessibleApplicationCount ?? '—' }} 个可访问应用<span v-if="source.PrivateApplicationCount">（含 {{ source.PrivateApplicationCount }} 个私有）</span></em></div>
              <span :class="['auth-chip', source.HasCredential || source.Type === 'current' ? 'on' : '']">{{ source.Type === 'current' ? '当前登录' : source.HasCredential ? '私有已登录' : '仅公开' }}</span>
              <label><input :checked="source.Enabled !== false" type="checkbox" :disabled="isBuiltInSource(source)" @change="toggleSource(source, $event.target.checked)" />启用</label>
              <button @click="editSource(source)">详情 / 登录</button><button v-if="!isBuiltInSource(source)" class="danger" @click="requestRemoveSource(source)">删除</button>
            </article>
          </div>
          <div class="source-form">
            <div class="form-heading"><span>{{ sourceForm.Id && sourceExists(sourceForm.Id) ? '编辑来源' : '添加来源' }}</span><b>先识别系统，再按需登录私有应用</b></div>
            <label><span>ApiBase</span><input v-model="sourceForm.ApiBase" :disabled="sourceForm.Type === 'official' || sourceForm.Type === 'current'" placeholder="https://api.example.com" /></label>
            <label><span>OsClient</span><input v-model="sourceForm.OsClient" :disabled="sourceForm.Type === 'official' || sourceForm.Type === 'current'" placeholder="tenant-key" /></label>
            <label><span>来源类型</span><select v-model="sourceForm.Type" :disabled="isBuiltInType(sourceForm.Type)"><option value="upstream">上游租户</option><option value="partner">合作伙伴</option></select></label>
            <label><span>显示名称</span><input v-model="sourceForm.Name" placeholder="识别后自动填入系统标题" /></label>
            <button class="discover-button" :disabled="sourceWorking" @click="discoverSource">{{ sourceWorking ? '正在识别…' : '识别系统与应用数量' }}</button>
            <section v-if="sourceForm.Discovered" class="discovery-card"><div><b>{{ sourceForm.SystemTitle || sourceForm.Name }}</b><small>{{ sourceForm.SystemShortTitle || sourceForm.OsClient }}</small></div><span>公开 {{ sourceForm.PublicApplicationCount || 0 }}</span><span>可访问 {{ sourceForm.AccessibleApplicationCount || 0 }}</span><span :class="['auth-chip', sourceForm.HasCredential ? 'on' : '']">{{ sourceForm.HasCredential ? '已登录私有源' : '未登录，仅公开应用' }}</span></section>
            <section v-if="sourceForm.Discovered && sourceForm.Type !== 'current'" class="login-panel">
              <div><b>私有应用登录（可选）</b><small>帐号、密码只用于本次登录；远端 Token 以 MCP 长会话签发并加密保存在当前租户。</small></div>
              <label><span>帐号</span><input v-model="sourceLogin.Account" autocomplete="username" /></label><label><span>密码</span><input v-model="sourceLogin.Password" type="password" autocomplete="current-password" /></label>
              <label v-if="sourceForm.RequiresCaptcha" class="captcha-field"><span>验证码</span><input v-model="sourceLogin.CaptchaValue" /><img v-if="sourceLogin.ImageDataUrl" :src="sourceLogin.ImageDataUrl" alt="验证码" @click="loadCaptcha" /><button @click="loadCaptcha">换一张</button></label>
              <div class="login-actions"><button :disabled="sourceWorking" @click="loginSource">{{ sourceForm.HasCredential ? '重新登录' : '登录私有应用源' }}</button><button v-if="sourceForm.HasCredential" class="danger" :disabled="sourceWorking" @click="disconnectSource">退出来源登录</button></div>
            </section>
          </div>
        </div>
        <footer class="modal-footer"><span>来源配置存当前租户；敏感 Token 单独加密，永不写入这份配置。</span><button class="ghost" @click="closeSourceEditor">关闭</button><button class="primary" :disabled="!sourceForm.Discovered || sourceWorking" @click="upsertSource">{{ sourceExists(sourceForm.Id) ? '保存当前来源' : '添加并立即生效' }}</button></footer>
      </section>
    </dialog>

    <dialog ref="detailDialog" v-if="selectedApp" class="modal-backdrop" :class="overlayClass" @cancel.prevent="closeDetail" @click.self="closeDetail">
      <section class="modal-shell app-detail" data-drag-name="detail" :style="dragStyle('detail')">
        <header class="modal-header draggable" @pointerdown="startDrag($event, 'detail')"><div><span>APPLICATION DETAIL</span><h2>{{ appName(detailModel || selectedApp) }}</h2><p>{{ detailModel?.AppId || detailModel?.AppKey || selectedApp.AppId || selectedApp.AppKey }}</p></div><button aria-label="关闭" @click="closeDetail">×</button></header>
        <div v-if="detailLoading" class="detail-loading"><i></i><span>正在读取完整应用信息与历史版本…</span></div>
        <div v-else class="modal-scroll detail-scroll">
          <section class="detail-overview"><div class="detail-preview"><img v-if="previewUrl(detailModel || selectedApp)" :src="previewUrl(detailModel || selectedApp)" :alt="`${appName(detailModel || selectedApp)}预览图`" /><div v-else class="preview-fallback"><span>{{ appInitial(detailModel || selectedApp) }}</span></div></div><div><span :class="['visibility-pill', isPublicApp(detailModel || selectedApp) ? 'public' : 'private']">{{ isPublicApp(detailModel || selectedApp) ? '公开应用' : '私有应用' }}</span><div class="detail-rich" v-html="detailHtml"></div></div></section>
          <dl class="detail-fields"><div v-for="item in detailEntries" :key="item.label"><dt>{{ item.label }}</dt><dd>{{ item.value }}</dd></div></dl>
          <section v-if="detailPackageSummary" class="resource-summary" data-testid="marketplace-package-summary">
            <header><div><span>PACKAGE CONTENTS</span><h3>安装包资源清单</h3></div><b>{{ detailPackageSummary.TotalResources }} 项资源</b></header>
            <div class="resource-metrics"><article v-for="resource in visiblePackageResources(detailPackageSummary)" :key="resource.Key"><span>{{ resource.Label }}</span><b>{{ resource.Count }}</b></article></div>
            <details v-if="detailPackageSummary.Menus?.length || detailPackageSummary.ApiEngines?.length || detailPackageSummary.Tables?.length" class="resource-details"><summary>查看资源名称</summary><div><p v-if="detailPackageSummary.Menus?.length"><b>菜单引擎</b><span>{{ detailPackageSummary.Menus.map(item => item.Name || item.ModuleEngineKey).join('、') }}</span></p><p v-if="detailPackageSummary.ApiEngines?.length"><b>接口引擎</b><span>{{ detailPackageSummary.ApiEngines.map(item => item.ApiEngineKey || item.ApiName).join('、') }}</span></p><p v-if="detailPackageSummary.Tables?.length"><b>表单引擎</b><span>{{ detailPackageSummary.Tables.map(item => item.Name).join('、') }}</span></p></div></details>
          </section>
          <section class="changelog-panel" aria-labelledby="marketplace-changelog-title">
            <header><div><span>WHAT'S NEW</span><h3 id="marketplace-changelog-title">应用更新日志</h3></div><b>{{ changeLogTotal }} 条版本记录</b></header>
            <div v-if="changeLogs.length" class="changelog-list">
              <article v-for="log in changeLogs" :key="log.Id || `${log.Version}-${log.ReleaseTime}`" :data-tone="changeTypeTone(log.ChangeType)">
                <i aria-hidden="true"></i>
                <div class="changelog-card">
                  <header><div><span>{{ changeTypeText(log.ChangeType) }}</span><b>{{ log.Version || '未标注版本' }}</b></div><time>{{ log.ReleaseTime || log.CreateTime || '—' }}</time></header>
                  <h4>{{ log.Title || `${log.Version || '当前版本'} 更新` }}</h4>
                  <p>{{ log.Content || '该版本未填写详细说明。' }}</p>
                </div>
              </article>
            </div>
            <p v-else class="changelog-empty">
              <b>{{ changeLogAvailable ? '当前应用尚未补录独立更新日志' : '当前商城源尚未提供应用更新日志能力' }}</b>
              <span>{{ changeLogAvailable ? '安装或更新前可向发布者确认本版本的功能变化与兼容要求。' : '请先更新该商城源的应用商城应用，再重新打开详情。' }}</span>
            </p>
          </section>
          <section class="versions-panel">
            <header><div><span>DATA VERSIONS</span><h3>选择安装版本</h3></div><b>{{ versionTotalCount }} 个匹配版本</b></header>
            <form class="version-toolbar" @submit.prevent="loadVersionPage(1)"><label><span>搜索版本</span><input v-model.trim="versionKeyword" placeholder="版本号、备注、发布人或动作" /></label><label><span>每页</span><select v-model.number="versionPageSize" @change="loadVersionPage(1)"><option :value="5">5</option><option :value="8">8</option><option :value="12">12</option><option :value="20">20</option></select></label><button type="submit" :disabled="versionLoading">{{ versionLoading ? '查询中…' : '搜索' }}</button><button v-if="versionKeyword" type="button" class="ghost" :disabled="versionLoading" @click="clearVersionSearch">清空</button></form>
            <div v-if="versions.length" class="version-list"><label v-for="version in versions" :key="version.VersionId || 'current'" :class="{ selected: selectedVersionId === (version.VersionId || ''), unavailable: version.Installable === false }"><input v-model="selectedVersionId" type="radio" :value="version.VersionId || ''" :disabled="version.Installable === false" /><div><b>{{ version.AppVersion || version.DataVersion || '未标注版本' }}</b><small>{{ version.IsCurrent ? '当前发布版本' : `数据版本 ${version.DataVersion || '—'}` }} · {{ version.VersionTime || '—' }}</small></div><span>{{ version.IsCurrent ? 'LATEST' : version.Installable === false ? 'NO PACKAGE' : 'HISTORY' }}</span></label></div><p v-else>{{ versionLoading ? '正在查询版本…' : '没有匹配的可安装版本。' }}</p>
            <nav v-if="versionPageCount > 1" class="version-pager" aria-label="历史版本分页"><button type="button" :disabled="versionLoading || versionPageIndex <= 1" @click="loadVersionPage(versionPageIndex - 1)">上一页</button><span>第 {{ versionPageIndex }} / {{ versionPageCount }} 页</span><button type="button" :disabled="versionLoading || versionPageIndex >= versionPageCount" @click="loadVersionPage(versionPageIndex + 1)">下一页</button></nav>
          </section>
          <details class="raw-details"><summary>查看其它完整元数据</summary><pre>{{ detailRawJson }}</pre></details>
        </div>
        <footer class="modal-footer"><button class="ghost" @click="closeDetail">关闭</button><button v-if="canPreviewApp(detailModel || selectedApp)" class="ghost" @click="openAppPreview(detailModel || selectedApp)">预览</button><button v-if="canDevelopApp(detailModel || selectedApp)" class="primary" @click="openAppDevelopment(detailModel || selectedApp)">开发</button><button v-if="viewMode === 'published'" class="primary" @click="openStoreForm('Edit', detailModel || selectedApp); closeDetail()">编辑 / 制作离线包</button><button v-else-if="canInstallApp(detailModel || selectedApp)" class="primary" @click="prepareInstall(detailModel || selectedApp, selectedVersion)">安装所选版本</button><span v-else-if="isOfficialSourceReadOnly(effectiveSource) && !canPreviewApp(detailModel || selectedApp) && !canDevelopApp(detailModel || selectedApp)" class="official-inline">当前系统为平台官方应用源</span></footer>
      </section>
    </dialog>

    <dialog ref="installDialog" v-if="installSetup.visible" class="modal-backdrop" :class="overlayClass" @cancel.prevent="closeInstallSetup" @click.self="closeInstallSetup">
      <section class="modal-shell install-setup" data-drag-name="install" :style="dragStyle('install')" data-testid="marketplace-install-setup">
        <header class="modal-header draggable" @pointerdown="startDrag($event, 'install')"><div><span>INSTALL APPLICATION</span><h2>安装 {{ appName(installSetup.app) }}</h2><p>{{ installSetup.summary?.PackageVersion || installSetup.version?.AppVersion || installSetup.app?.AppVersion || '当前版本' }}</p></div><button aria-label="关闭" @click="closeInstallSetup">×</button></header>
        <div v-if="installSetup.loading" class="detail-loading"><i></i><span>正在校验安装包并读取目标菜单…</span></div>
        <div v-else class="modal-scroll install-setup__body">
          <section class="install-resource-card">
            <header><div><span>本次将写入</span><b>{{ installSetup.summary?.TotalResources || 0 }} 项资源</b></div><em>{{ installSetup.summary?.RootMenuCount || 0 }} 个根菜单</em></header>
            <div class="resource-metrics"><article v-for="resource in visiblePackageResources(installSetup.summary)" :key="resource.Key"><span>{{ resource.Label }}</span><b>{{ resource.Count }}</b></article></div>
          </section>
          <section v-if="installSetup.summary?.RequiresInstallParent" class="install-target-card">
            <header><span>菜单安装位置</span><h3>请选择包内根菜单挂载到哪里</h3><p>包内子菜单层级保持不变；只有根菜单会挂到所选位置。</p></header>
            <div class="target-mode-grid">
              <label :class="{ active: installSetup.targetMode === 'root' }"><input v-model="installSetup.targetMode" type="radio" value="root" /><b>系统根菜单</b><small>安装为左侧一级菜单</small></label>
              <label :class="{ active: installSetup.targetMode === 'existing' }"><input v-model="installSetup.targetMode" type="radio" value="existing" /><b>现有菜单下</b><small>选择当前系统中的父菜单</small></label>
              <label :class="{ active: installSetup.targetMode === 'create' }"><input v-model="installSetup.targetMode" type="radio" value="create" /><b>临时新建目录</b><small>本次安装事务内原子创建</small></label>
            </div>
            <label v-if="installSetup.targetMode === 'existing'" class="target-field"><span>父菜单</span><select v-model="installSetup.existingParentId" data-testid="marketplace-install-parent"><option value="">请选择父菜单</option><option v-for="menu in installMenuOptions" :key="menu.Id" :value="menu.Id">{{ menu.Label }}</option></select></label>
            <div v-if="installSetup.targetMode === 'create'" class="create-target-fields"><label class="target-field"><span>新目录名称</span><input v-model.trim="installSetup.createName" maxlength="80" placeholder="例如：生产管理" data-testid="marketplace-install-create-name" /></label><label class="target-field"><span>新目录创建位置</span><select v-model="installSetup.createUnderId"><option value="">系统根菜单</option><option v-for="menu in installMenuOptions" :key="menu.Id" :value="menu.Id">{{ menu.Label }}</option></select></label></div>
          </section>
          <section v-else class="install-no-menu"><i>✓</i><div><b>该安装包不包含菜单引擎</b><p>无需选择安装位置；表单、接口、数据或在线应用资源仍会按包声明安装。</p></div></section>
          <p class="install-permission-note"><b>权限与即时显示</b><span>安装器会为全部超级管理员自动补齐新菜单权限；任务成功后主框架会重新生成左侧菜单，无需手动刷新浏览器。</span></p>
        </div>
        <footer class="modal-footer"><button class="ghost" :disabled="installSetup.submitting" @click="closeInstallSetup">取消</button><button class="primary" :disabled="installSetup.loading || installSetup.submitting || !canSubmitInstallSetup" data-testid="marketplace-install-confirm" @click="submitInstallSetup">{{ installSetup.submitting ? '正在提交…' : '确认并进入后台安装' }}</button></footer>
      </section>
    </dialog>

    <dialog ref="confirmDialog" v-if="confirmState.visible" class="modal-backdrop confirm-backdrop" :class="overlayClass" @cancel.prevent="resolveConfirm(false)"><section class="modal-shell confirm-dialog"><div class="confirm-icon">!</div><span>PLEASE CONFIRM</span><h2>{{ confirmState.title }}</h2><p>{{ confirmState.message }}</p><footer><button class="ghost" @click="resolveConfirm(false)">取消</button><button class="primary" @click="resolveConfirm(true)">确认</button></footer></section></dialog>
  </main>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { configureV8, dispatch, getContext, subscribeContext } from './microi.js'
import { marketplaceHtmlToText, sanitizeMarketplaceHtml } from './safe-html.js'
import './marketplace.css'
import './marketplace-modal.css'
import './marketplace-compact.css'

const client = configureV8()
const context = reactive(getContext())
const SETTINGS_KEY = 'Marketplace.Sources'
const OFFICIAL_SOURCE_ID = 'official'
const OFFICIAL_SOURCE_API_BASE = 'https://api.itdos.com'
const OFFICIAL_SOURCE_OSCLIENT = 'iTdos'
const OFFICIAL_PUBLIC_REQUEST_TIMEOUT_MS = 25000
const CURRENT_SOURCE_ID = 'current'
const DEFAULT_APPLICATION_TYPE = 'Platform'
const MAX_OFFLINE_BYTES = 50 * 1024 * 1024
const categoryOptions = [['game','游戏'],['business','企业应用'],['office','办公协同'],['education','教育学习'],['tools','效率工具'],['lifestyle','生活服务'],['creative','创意设计'],['data','数据分析'],['marketing','营销运营'],['industry','行业应用'],['platform','平台能力'],['other','其它']].map(([key,label])=>({key,label}))
const categoryMap = Object.fromEntries(categoryOptions.map(item=>[item.key,item.label]))
const applicationTypeOptions = [['Platform','平台应用'],['Regular','常规应用'],['MicroService','微服务'],['UniApp','UniApp'],['Web','Web 应用']].map(([key,label])=>({key,label}))
const visibilityOptions = [{key:'Public',label:'公开应用'},{key:'Private',label:'私有应用'}]

const settingsRowId=ref(''), sources=ref([]), activeSourceId=ref(OFFICIAL_SOURCE_ID), viewMode=ref('marketplace')
const apps=ref([]), installedVersions=ref([]), installedApplications=ref([]), installedVersionsReady=ref(false), dataCount=ref(0), pageIndex=ref(1), pageSize=ref(15), jumpPage=ref(1)
const keyword=ref(''), selectedCategories=ref([]), selectedApplicationTypes=ref([DEFAULT_APPLICATION_TYPE]), selectedVisibilities=ref(['Public','Private'])
const availableCategories=ref([]), availableApplicationTypes=ref([])
const loading=ref(false), batchLoading=ref(false), sourceWorking=ref(false), sourceEditorVisible=ref(false)
const selectedApp=ref(null), detailModel=ref(null), detailLoading=ref(false), versions=ref([]), selectedVersionId=ref('')
const detailPackageSummary=ref(null), installMenuOptions=ref([])
const changeLogs=ref([]), changeLogTotal=ref(0), changeLogAvailable=ref(false)
const versionLoading=ref(false), versionKeyword=ref(''), versionPageIndex=ref(1), versionPageSize=ref(8), versionHistoryCount=ref(0), versionCurrentMatches=ref(true)
const installingIds=ref([]), offlineFile=ref(null), offlineLoading=ref(false)
const previewFailures=reactive({}), notice=reactive({text:'',type:'success'}), sourceForm=reactive(emptySource())
const sourceLogin=reactive({Account:'',Password:'',CaptchaId:'',CaptchaValue:'',ImageDataUrl:''})
const confirmState=reactive({visible:false,title:'',message:''}), installSetup=reactive({visible:false,loading:false,submitting:false,app:null,version:null,source:null,summary:null,targetMode:'root',existingParentId:'',createName:'',createUnderId:''}), dragOffsets=reactive({source:{x:0,y:0},detail:{x:0,y:0},install:{x:0,y:0}})
const sourceDialog=ref(null), detailDialog=ref(null), installDialog=ref(null), confirmDialog=ref(null)
const nativeTopLayerAvailable=ref(typeof HTMLDialogElement!=='undefined'&&typeof HTMLDialogElement.prototype?.showModal==='function')
let confirmResolver=null, unsubscribeContext=null, hostDataListener=null, listRequestSequence=0

const themeMode=computed(()=>context.themeMode||'light')
const overlayClass=computed(()=>context.disableFormMaskBlur?'plain':'blurred')
const currentUserId=computed(()=>String(context.currentUser?.Id||'').trim())
const enabledSources=computed(()=>{const result=[],seen=new Set();for(const source of sources.value.filter(item=>item.Enabled!==false)){const key=`${canonicalBaseSafe(source.ApiBase).toLowerCase()}|${String(source.OsClient||'').toLowerCase()}`;if(seen.has(key)&&source.Type==='current')continue;seen.add(key);result.push(source)}return result})
const activeSource=computed(()=>enabledSources.value.find(item=>item.Id===activeSourceId.value)||enabledSources.value[0]||null)
const effectiveSource=computed(()=>viewMode.value==='published'?sources.value.find(item=>item.Id===CURRENT_SOURCE_ID)||activeSource.value:activeSource.value)
const installedCount=computed(()=>installedVersions.value.length), updateCount=computed(()=>apps.value.filter(item=>item.StoreInstallStatus==='Outdated').length)
const pageCount=computed(()=>Math.max(1,Math.ceil(dataCount.value/pageSize.value)))
const visiblePageNumbers=computed(()=>{const start=Math.max(1,Math.min(pageCount.value-4,pageIndex.value-2)),end=Math.min(pageCount.value,start+4),result=[];for(let p=start;p<=end;p+=1)result.push(p);return result})
const versionPageCount=computed(()=>Math.max(1,Math.ceil(versionHistoryCount.value/versionPageSize.value)))
const versionTotalCount=computed(()=>versionHistoryCount.value+(versionCurrentMatches.value?1:0))
const canInstallFromActiveSource=computed(()=>!!effectiveSource.value&&!sameAsCurrent(effectiveSource.value)&&!isOfficialSourceReadOnly(effectiveSource.value))
const viewTabs=computed(()=>[{key:'marketplace',label:'应用市场',count:null},{key:'installed',label:'已经安装应用',count:installedCount.value},{key:'published',label:'发布 / 制作离线包',count:null},{key:'offline',label:'安装离线包',count:null}])
const categoryFilterOptions=computed(()=>mergeFilterOptions(categoryOptions,availableCategories.value,selectedCategories.value,item=>categoryLabel(item)))
const applicationTypeFilterOptions=computed(()=>mergeFilterOptions(applicationTypeOptions,availableApplicationTypes.value,selectedApplicationTypes.value,item=>String(item||'其它')))
const visibilityFilterValue=computed(()=>selectedVisibilities.value.length===1?selectedVisibilities.value[0]:'')
const selectedVersion=computed(()=>versions.value.find(item=>String(item.VersionId||'')===String(selectedVersionId.value||''))||versions.value[0]||null)
const canSubmitInstallSetup=computed(()=>{if(!installSetup.summary)return false;if(!installSetup.summary.RequiresInstallParent)return true;if(installSetup.targetMode==='root')return true;if(installSetup.targetMode==='existing')return!!installSetup.existingParentId;return installSetup.targetMode==='create'&&!!String(installSetup.createName||'').trim()})
const detailEntries=computed(()=>{const app=detailModel.value||selectedApp.value||{};return [['应用名称',appName(app)],['应用 Key',app.AppId||app.AppKey||'—'],['应用版本',app.AppVersion||app.Version||'—'],['已安装版本',installedVersion(app)||'未安装'],['应用类型',app.ApplicationType||app.AppType||'—'],['应用分类',categoryLabel(app.Category)],['公开范围',isPublicApp(app)?'公开应用':'私有应用'],['发布者类型',app.PublisherType||'—'],['作者',app.AppAuthor||app.OwnerName||app.UserName||'—'],['发布状态',app.Status||(Number(app.IsApprove||0)===1?'已发布':'—')],['构建状态',app.BuildStatus||'—'],['发布时间',app.AppPublishTime||app.CreateTime||'—'],['更新时间',app.AppUpdateTime||app.UpdateTime||'—'],['前端最低版本',app.ClientMinVersion||'未限制'],['后端最低版本',app.ServerMinVersion||'未限制'],['安装次数',String(Number(app.InstallCount||0))],['浏览次数',String(Number(app.ViewCount||0))],['评分',app.AppRate||'—'],['在线预览',runtimePreviewUrl(app)||'—'],['来源',effectiveSource.value?.Name||'—']].map(([label,value])=>({label,value:String(value??'—')}))})
const detailRawJson=computed(()=>{const source={...(detailModel.value||selectedApp.value||{})};for(const key of ['AppPakcet','AiAppZipFiles','AiAppPackageManifest','SelectData','SelectAiApp','PrivateSourcePath'])delete source[key];return JSON.stringify(source,null,2)})
const detailHtml=computed(()=>{const app=detailModel.value||selectedApp.value||{};return sanitizeMarketplaceHtml(app.AppDetail||app.Description||'暂无应用介绍。')})
const anyModalOpen=computed(()=>sourceEditorVisible.value||!!selectedApp.value||installSetup.visible||confirmState.visible)

function emptySource(){return{Id:'',Name:'',ApiBase:'',OsClient:'',Type:'upstream',Enabled:true,Discovered:false,RequiresCaptcha:false,HasCredential:false,PublicApplicationCount:0,PrivateApplicationCount:0,AccessibleApplicationCount:0,CredentialKey:''}}
function newId(){return globalThis.crypto?.randomUUID?.()||`source-${Date.now()}-${Math.random().toString(16).slice(2)}`}
function canonicalBase(value){const parsed=new URL(String(value||'').trim());if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password||parsed.search||parsed.hash)throw new Error('ApiBase 只允许不含帐号、Query 和 Hash 的 http/https 绝对地址。');return`${parsed.protocol}//${parsed.host}`.replace(/\/+$/,'')}
function canonicalBaseSafe(value){try{return canonicalBase(value)}catch(_){return String(value||'').replace(/\/+$/,'')}}
function currentSource(){return{...emptySource(),Id:CURRENT_SOURCE_ID,Name:`${context.systemShortTitle||context.systemTitle||context.osClient||'当前租户'}应用源`,ApiBase:canonicalBaseSafe(context.apiBase||window.location.origin),OsClient:context.osClient,Type:'current',Enabled:true,Discovered:true,HasCredential:true}}
function officialSource(){return{...emptySource(),Id:OFFICIAL_SOURCE_ID,Name:'平台官方应用源',ApiBase:OFFICIAL_SOURCE_API_BASE,OsClient:OFFICIAL_SOURCE_OSCLIENT,Type:'official',Enabled:true}}
function normalizeSources(value){const result=[officialSource(),currentSource()],ids=new Set(result.map(item=>item.Id));for(const item of Array.isArray(value)?value:[]){try{const normalized={...emptySource(),...item,Id:String(item.Id||newId()),ApiBase:canonicalBase(item.ApiBase),OsClient:String(item.OsClient||'').trim(),Enabled:item.Enabled!==false,Type:['partner','upstream'].includes(item.Type)?item.Type:'upstream'};if(!normalized.OsClient||ids.has(normalized.Id))continue;ids.add(normalized.Id);result.push(normalized)}catch(_){}}return result}
function friendlyMarketplaceMessage(value,fallback='操作失败，请稍后重试。'){const raw=String(value?.Msg||value?.message||value||'').trim();if(/NoExistData\[(?:ApiAddress|ApiEngineKey)\][\s\S]*get-microi-store-list/i.test(raw))return'当前租户的应用商城接口尚未完成兼容升级，请更新“应用商城”应用后重试。';if(/NoExistData\[(?:ApiAddress|ApiEngineKey)\]/i.test(raw))return'当前应用商城能力尚未安装完整，请更新“应用商城”应用后重试。';return(raw||fallback).slice(0,500)}
function showMessage(text,type='success'){const message=friendlyMarketplaceMessage(text,type==='error'?'操作失败，请稍后重试。':'操作已完成。');const messageType=['success','warning','error','info'].includes(type)?type:'info';clearTimeout(showMessage.timer);notice.text='';const actions=context.hostCapabilities?.actions,canUseHostTips=Array.isArray(actions)&&actions.includes('showMessage');const sent=canUseHostTips&&dispatch('micro-app:host-action',{action:'showMessage',requestId:`store-message-${Date.now()}-${Math.random().toString(16).slice(2)}`,message,messageType},{force:true});if(sent)return;notice.text=message;notice.type=messageType;showMessage.timer=setTimeout(()=>{notice.text=''},6000)}
function sameAsCurrent(source){return!!source&&String(source.OsClient||'').toLowerCase()===String(context.osClient||'').toLowerCase()&&canonicalBaseSafe(source.ApiBase).toLowerCase()===canonicalBaseSafe(context.apiBase||window.location.origin).toLowerCase()}
function isOfficialSourceReadOnly(source){return!!context.isOfficialPlatform&&source?.Type==='official'}
function sourceCredentialKey(source){return source?.HasCredential?(source.CredentialKey||`Marketplace.SourceToken.${source.Id}`):''}
function isOfficialPublicSource(source){return String(source?.Id||'').toLowerCase()===OFFICIAL_SOURCE_ID&&String(source?.Type||'').toLowerCase()==='official'&&canonicalBaseSafe(source?.ApiBase).toLowerCase()===OFFICIAL_SOURCE_API_BASE.toLowerCase()&&String(source?.OsClient||'').toLowerCase()===OFFICIAL_SOURCE_OSCLIENT.toLowerCase()&&!sourceCredentialKey(source)}
function isBuiltInSource(source){return[OFFICIAL_SOURCE_ID,CURRENT_SOURCE_ID].includes(String(source?.Id||''))}
function isBuiltInType(type){return['official','current'].includes(String(type||''))}
function sourceExists(id){return sources.value.some(item=>item.Id===id)}
function sourceHost(source){try{return new URL(source.ApiBase).host}catch(_){return source.ApiBase}}
function sourceTypeText(source){return source.Type==='official'?'PLATFORM OFFICIAL':source.Type==='current'?'CURRENT TENANT':source.Type==='partner'?'PARTNER':'UPSTREAM'}
function categoryLabel(value){return categoryMap[String(value||'')]||String(value||'其它')}
function facetKey(value){return String(value?.Key??value?.key??value?.Value??value?.value??(value||'')).trim()}
function mergeFilterOptions(base,available,selected,labeler){const result=[...base],seen=new Set(result.map(item=>item.key));for(const raw of [...(Array.isArray(available)?available:[]),...(Array.isArray(selected)?selected:[])]){const key=facetKey(raw);if(!key||seen.has(key))continue;seen.add(key);result.push({key,label:String(raw?.Label??raw?.label??labeler(key))})}return result}
function toggleFilter(target,key,checked){const next=new Set(target.value);if(checked)next.add(key);else next.delete(key);target.value=[...next];loadApps(1)}
function toggleCategory(key,checked){toggleFilter(selectedCategories,key,checked)}
function toggleApplicationType(key,checked){toggleFilter(selectedApplicationTypes,key,checked)}
function toggleVisibility(key,checked){toggleFilter(selectedVisibilities,key,checked)}
function changeTypeText(value){return{Feature:'新增',Improvement:'优化',Fix:'修复',Security:'安全',Breaking:'重要变更'}[String(value||'')]||String(value||'更新')}
function changeTypeTone(value){return{Feature:'feature',Improvement:'improvement',Fix:'fix',Security:'security',Breaking:'breaking'}[String(value||'')]||'default'}
function appName(app){return String(app?.AppName||app?.Name||app?.AppId||app?.AppKey||'未命名应用')}
function appDescription(app){return marketplaceHtmlToText(app?.AppDetail||app?.Description)||'该应用暂未填写介绍。'}
function appInitial(app){return appName(app).trim().slice(0,1).toUpperCase()}
function appCardKey(app){return String(app?.StoreId||app?.Id||app?.AppId||app?.AppKey||appName(app))}
function isPublicApp(app){return app?.Visibility?String(app.Visibility).toLowerCase()!=='private':![0,'0',false,'false'].includes(app?.IsPublic)}
function installedVersion(app){return String(app?.AppVersionInstall||app?.InstalledVersion||findInstalled(app)?.AppVersionInstall||findInstalled(app)?.AppVersion||'')}
function installStateText(app){return app?.StoreInstallStatusText||(installedVersion(app)?'已安装':'未安装')}
function installStateClass(app){return String(app?.StoreInstallStatus||(installedVersion(app)?'Installed':'Uninstalled')).toLowerCase()}
function installText(app){return app?.StoreInstallStatus==='Outdated'?'更新':app?.StoreInstallStatus==='Installed'?'重新安装':app?.StoreInstallStatus==='Abnormal'?'版本异常':'安装'}
function canInstallApp(app){return viewMode.value!=='published'&&canInstallFromActiveSource.value&&app?.StoreInstallStatus!=='Abnormal'}
function isAiApplication(app){return['web','uniapp','microservice'].includes(String(app?.ApplicationType||app?.AppType||'').trim().toLowerCase())}
function resolveRuntimePreviewUrl(value,base){const parsed=parseUploadUrl(value);if(!parsed||/^(?:data:|blob:|javascript:)/i.test(parsed))return'';if(/^https?:\/\//i.test(parsed))return parsed;const origin=canonicalBaseSafe(base);if(!origin)return'';try{const resolved=new URL(parsed.replace(/^\/+/,''),`${origin}/`);return /^https?:$/i.test(resolved.protocol)?resolved.href:''}catch(_){return''}}
function runtimePreviewUrl(app){const installed=installedVersion(app)?findInstalledApplication(app):null;if(installedVersion(app)){const installedValue=parseUploadUrl(installed?.PreviewUrl)||parseUploadUrl(installed?.PublicPublishPath);return resolveRuntimePreviewUrl(installedValue,context.fileServer||context.apiBase||window.location.origin)}const sourceValue=parseUploadUrl(app?.PreviewUrl)||parseUploadUrl(app?.PublicPublishPath);return resolveRuntimePreviewUrl(sourceValue,app?.StoreApiBase||effectiveSource.value?.ApiBase||context.apiBase)}
function canPreviewApp(app){return isAiApplication(app)&&!!runtimePreviewUrl(app)}
function canDevelopApp(app){const source=effectiveSource.value,id=app?.StoreId||app?.Id;return isAiApplication(app)&&!!id&&!!source&&(sameAsCurrent(source)||isOfficialSourceReadOnly(source))}
function openAppPreview(app){const url=runtimePreviewUrl(app);if(!url)return showMessage('该 AI 应用尚未发布可预览的运行版本。','warning');window.open(url,'_blank','noopener,noreferrer')}
function openAppDevelopment(app){const appId=String(app?.StoreId||app?.Id||'').trim();if(!canDevelopApp(app)||!appId)return showMessage('只能开发当前租户拥有的 AI 应用。','warning');const actions=context.hostCapabilities?.actions;if(Array.isArray(actions)&&!actions.includes('navigate'))return showMessage('当前宿主版本暂不支持打开开发工作台。','warning');if(selectedApp.value)closeDetail();const sent=dispatch('micro-app:host-action',{action:'navigate',requestId:`store-develop-${Date.now()}`,path:`/mic-ai-app/${encodeURIComponent(appId)}`},{force:true});if(!sent)showMessage('请在吾码主框架中打开 AI 应用开发工作台。','warning')}
function findInstalled(app){const keys=[app?.StoreId,app?.Id,app?.AppId,app?.AppKey,appName(app)].filter(Boolean).map(item=>String(item).toLowerCase());return installedVersions.value.find(row=>[row.StoreId,row.Id,row.AppId,row.AppName].filter(Boolean).some(value=>keys.includes(String(value).toLowerCase())))||null}
function findInstalledApplication(app){const keys=[app?.StoreId,app?.Id,app?.AppId,app?.AppKey,appName(app)].filter(Boolean).map(item=>String(item).toLowerCase());return installedApplications.value.find(row=>[row.Id,row.AppId,row.AppKey,row.AppName,row.Name].filter(Boolean).some(value=>keys.includes(String(value).toLowerCase())))||null}
function parseUploadUrl(value){if(!value)return'';if(Array.isArray(value)){for(const item of value){const found=parseUploadUrl(item);if(found)return found}return''}if(typeof value==='object'){for(const key of ['Url','url','FileUrl','fileUrl','FilePathName','filePathName','Path','path','Value','value']){const found=parseUploadUrl(value[key]);if(found)return found}return''}const text=String(value).trim();if(!text)return'';if(text.startsWith('[')||text.startsWith('{')){try{return parseUploadUrl(JSON.parse(text))}catch(_){}}return text}
function previewUrl(app){const key=appCardKey(app);if(previewFailures[key])return'';const value=parseUploadUrl(app?.AppPreview)||parseUploadUrl(app?.PreviewImage)||parseUploadUrl(app?.PreviewUrl);if(!value)return'';if(/^(https?:|data:|blob:)/i.test(value))return value;const server=String(app?._FileServer||effectiveSource.value?.FileServer||context.fileServer||effectiveSource.value?.ApiBase||'').replace(/\/+$/,'');return server?`${server}/${value.replace(/^\/+/, '')}`:value}
function markPreviewFailed(app){previewFailures[appCardKey(app)]=true}
function visiblePackageResources(summary){return Array.isArray(summary?.Resources)?summary.Resources.filter(item=>Number(item?.Count||0)>0):[]}
function flattenInstallMenus(rows,depth=0,result=[]){for(const row of Array.isArray(rows)?rows:[]){if(!row?.Id||Number(row.IsDeleted||0)===1)continue;result.push({Id:String(row.Id),Name:String(row.Name||row.Id),ParentId:String(row.ParentId||''),Depth:depth,Label:`${'　'.repeat(Math.min(depth,8))}${depth?'└ ':''}${String(row.Name||row.Id)}`});flattenInstallMenus(row._Child||row.Children||row.children,depth+1,result)}return result}
async function loadInstallMenuOptions(summary){const result=await client.post('/apiengine/platform-sys-menu?Action=GetSysMenuStep',{}, {checkCode:false});if(!result||Number(result.Code)!==1||!Array.isArray(result.Data))throw new Error(result?.Msg||'读取当前系统菜单失败。');const packageMenuIds=new Set((summary?.Menus||[]).map(item=>String(item?.Id||'')).filter(Boolean));installMenuOptions.value=flattenInstallMenus(result.Data).filter(item=>!packageMenuIds.has(item.Id));return installMenuOptions.value}

async function loadSources(){try{const result=await client.post('/api/TenantSystemSettings/List',{}, {checkCode:false});if(result?.Code!==1)throw new Error(result?.Msg||'读取商城源失败。');const row=(Array.isArray(result.Data)?result.Data:[]).find(item=>item.ConfigKey===SETTINGS_KEY);settingsRowId.value=row?.Id||'';let stored=row?.ConfigValue||[];if(typeof stored==='string'){try{stored=JSON.parse(stored||'[]')}catch(_){stored=[]}}sources.value=normalizeSources(stored);if(!enabledSources.value.some(item=>item.Id===activeSourceId.value))activeSourceId.value=enabledSources.value[0]?.Id||''}catch(error){sources.value=normalizeSources([]);showMessage(error?.Msg||error?.message||'商城源加载失败。','error')}}
async function persistSources(message='商城源已立即生效。'){const stored=sources.value.filter(item=>!isBuiltInSource(item)).map(item=>{const{Password,Token,...safe}=item;return{...safe,HasCredential:!!item.HasCredential,CredentialKey:item.CredentialKey||`Marketplace.SourceToken.${item.Id}`}});const result=await client.post('/api/TenantSystemSettings/Save',{Id:settingsRowId.value,ConfigKey:SETTINGS_KEY,Value:JSON.stringify(stored),ValueType:'Json',Category:'应用商城',Description:'联邦应用商城来源列表（不含登录 Token）',IsSecret:false,IsEnabled:true,Sort:300},{checkCode:false});if(result?.Code!==1)throw new Error(result?.Msg||'商城源保存失败。');settingsRowId.value=result.Data?.Id||settingsRowId.value;showMessage(message)}
function installedRecordTimestamp(row){for(const value of [row?.UpdateTime,row?.InstallTime,row?.LastCheckTime,row?.CreateTime]){const text=String(value||'').trim(),dotNet=text.match(/^\/Date\((\d+)/),timestamp=dotNet?Number(dotNet[1]):Date.parse(text);if(Number.isFinite(timestamp))return timestamp}return 0}
function isDeletedInstallRecord(row){return['1','true','yes'].includes(String(row?.IsDeleted||'').trim().toLowerCase())}
function normalizeInstalledVersions(rows){return rows.map((row,index)=>({row,index,timestamp:installedRecordTimestamp(row)})).filter(item=>!isDeletedInstallRecord(item.row)).sort((left,right)=>right.timestamp-left.timestamp||left.index-right.index).map(item=>item.row)}
async function loadInstalled(){installedVersionsReady.value=false;installedVersions.value=[];installedApplications.value=[];try{const versionResult=await client.FormEngine.GetTableData('sys_microistoreversion',{_SelectFields:['Id','StoreId','AppId','AppName','AppVersion','AppVersionInstall','PackageVersion','InstallStatus','IsDeleted','InstallTime','UpdateTime','LastCheckTime','CreateTime'],_OrderBy:'UpdateTime',_OrderByType:'DESC',_PageIndex:1,_PageSize:5000});if(!versionResult||Number(versionResult.Code)!==1||!Array.isArray(versionResult.Data))throw new Error(versionResult?.Msg||'接口未返回有效安装版本列表。');const applicationResult=await client.FormEngine.GetTableData('sys_microistore',{_SelectFields:['Id','AppId','AppKey','AppName','Name','AppVersion','ApplicationType','AppType','PreviewUrl','PublicPublishPath','IsDeleted','UpdateTime','CreateTime'],_OrderBy:'UpdateTime',_OrderByType:'DESC',_PageIndex:1,_PageSize:5000});if(!applicationResult||Number(applicationResult.Code)!==1||!Array.isArray(applicationResult.Data))throw new Error(applicationResult?.Msg||'接口未返回有效已安装应用列表。');installedVersions.value=normalizeInstalledVersions(versionResult.Data);installedApplications.value=normalizeInstalledVersions(applicationResult.Data);installedVersionsReady.value=true;return installedVersions.value}catch(error){const detail=String(error?.Msg||error?.message||'未知错误').trim();throw new Error(`读取本地应用安装状态失败：${detail} 请检查 sys_microistoreversion 与 sys_microistore 后重试。`)}}
function endpointFor(operation){return operation==='Model'?'get-microi-store-model':operation==='Versions'?'get-microi-store-versions':'get-microi-store-list'}
function marketplaceListRouteUnavailable(value){const status=Number(value?.status||value?.StatusCode||value?.response?.status||0),message=String(value?.Msg||value?.message||value?.response?.data?.Msg||value||'');return status===404||(/NoExistData\[(?:ApiAddress|ApiEngineKey)\]/i.test(message)&&/get-microi-store-list/i.test(message))}
function marketplaceBusinessError(result,fallback){const error=new Error(result?.Msg||fallback);error.marketplaceBusinessFailure=true;error.marketplaceResult=result;return error}
function marketplaceBrowserTransportFailure(value){if(value?.marketplaceBusinessFailure===true)return false;const rawStatus=value?.status??value?.StatusCode??value?.response?.status,status=Number(rawStatus||0);if(rawStatus!==undefined&&rawStatus!==null&&status===0)return true;if(status>0)return false;const name=String(value?.name||value?.constructor?.name||''),message=String(value?.message||value?.errMsg||value||'').toLowerCase();return['AbortError','TimeoutError','TypeError'].includes(name)||/(failed to fetch|networkerror|network request failed|load failed|cors|request:fail|timeout|timed out|aborted)/i.test(message)}
async function currentSourceRequest(source,operation,param){const options={checkCode:false,silentError:true},tenant=encodeURIComponent(source.OsClient),formalUrl=`/apiengine/${endpointFor(operation)}?OsClient=${tenant}`;try{const result=await client.post(formalUrl,param||{},options);if(operation!=='List'||Number(result?.Code)===1||!marketplaceListRouteUnavailable(result))return result}catch(error){if(operation!=='List'||!marketplaceListRouteUnavailable(error))throw error}const fallback=await client.post(`/apiengine/get-microi-store?OsClient=${tenant}`,param||{},options);if(Number(fallback?.Code)===1)fallback.DataAppend={...(fallback.DataAppend||{}),MarketplaceListRoute:'/apiengine/get-microi-store',MarketplaceListRouteFallback:true};return fallback}
function operationIsListRoute(route){return['get-microi-store-list','get-microi-store'].includes(route)}
function decorateOfficialPublicResult(result,route,options={}){const append=result.DataAppend||{};result.DataAppend={...append,SourceAuthenticated:false,CredentialKey:'',SourceId:OFFICIAL_SOURCE_ID,MarketplaceBrowserPublicTransport:options.browser===true,MarketplaceProxyFallback:options.proxy===true};if(operationIsListRoute(route))Object.assign(result.DataAppend,{MarketplaceListRoute:append.MarketplaceListRoute||`/apiengine/${route}`,MarketplaceListRouteFallback:append.MarketplaceListRouteFallback===true||options.legacy===true});return result}
async function officialPublicBrowserEndpoint(endpoint,param){
  const url=`${OFFICIAL_SOURCE_API_BASE}/apiengine/${endpoint}?OsClient=${encodeURIComponent(OFFICIAL_SOURCE_OSCLIENT)}`
  let lastError=null
  for(let attempt=1;attempt<=2;attempt+=1){
    try{
      return await client.post(url,param||{},{apiEngine:true,auth:false,tenantContext:false,acceptReturnedToken:false,credentials:'omit',checkCode:false,silentError:true,timeout:OFFICIAL_PUBLIC_REQUEST_TIMEOUT_MS})
    }catch(error){
      lastError=error
      if(attempt>=2||!marketplaceBrowserTransportFailure(error))throw error
      await new Promise(resolve=>window.setTimeout(resolve,attempt*200))
    }
  }
  throw lastError||new Error('平台官方商城公共接口请求失败。')
}
async function officialPublicBrowserRequest(operation,param){const formalEndpoint=endpointFor(operation);let result;try{result=await officialPublicBrowserEndpoint(formalEndpoint,param)}catch(error){if(operation!=='List'||!marketplaceListRouteUnavailable(error))throw error}if(result&&Number(result.Code)===1)return decorateOfficialPublicResult(result,formalEndpoint,{browser:true});if(operation!=='List'||!marketplaceListRouteUnavailable(result))throw marketplaceBusinessError(result,'平台官方商城公共接口未返回成功结果。');const legacyEndpoint='get-microi-store',fallback=await officialPublicBrowserEndpoint(legacyEndpoint,param);if(!fallback||Number(fallback.Code)!==1)throw marketplaceBusinessError(fallback,'平台官方商城兼容接口未返回成功结果。');return decorateOfficialPublicResult(fallback,legacyEndpoint,{browser:true,legacy:true})}
async function officialPublicProxyRequest(operation,param){const result=await client.post('/api/MarketplaceSource/Query',{SourceId:OFFICIAL_SOURCE_ID,ApiBase:OFFICIAL_SOURCE_API_BASE,OsClient:OFFICIAL_SOURCE_OSCLIENT,Operation:operation,Param:param||{}},{checkCode:false,silentError:true});if(!result||Number(result.Code)!==1)throw marketplaceBusinessError(result,'平台官方商城同源代理未返回成功结果。');return decorateOfficialPublicResult(result,endpointFor(operation),{proxy:true})}
async function officialPublicRequest(operation,param){try{return await officialPublicBrowserRequest(operation,param)}catch(error){if(!marketplaceBrowserTransportFailure(error))throw error;return await officialPublicProxyRequest(operation,param)}}
async function discoverOfficialPublicSource(source){const result=await officialPublicRequest('List',{_PageIndex:1,_PageSize:1}),append=result.DataAppend||{},count=Math.max(0,Number(result.DataCount||0));return{Code:1,Msg:'平台官方公共商城源识别成功。',Data:{SourceId:OFFICIAL_SOURCE_ID,ApiBase:OFFICIAL_SOURCE_API_BASE,OsClient:OFFICIAL_SOURCE_OSCLIENT,SystemTitle:'Microi吾码',SystemShortTitle:'吾码',RequiresCaptcha:false,HasCredential:false,CredentialExpired:false,PublicApplicationCount:count,AccessibleApplicationCount:count,PrivateApplicationCount:0,CredentialKey:'',MarketplaceBrowserPublicTransport:append.MarketplaceBrowserPublicTransport===true,MarketplaceProxyFallback:append.MarketplaceProxyFallback===true,Name:source?.Name||'平台官方应用源'}}}
async function sourceRequest(source,operation,param){if(!source)throw new Error('请先选择商城源。');let result;if(sameAsCurrent(source))result=await currentSourceRequest(source,operation,param);else if(isOfficialPublicSource(source))result=await officialPublicRequest(operation,param);else result=await client.post('/api/MarketplaceSource/Query',{SourceId:source.Id,ApiBase:canonicalBase(source.ApiBase),OsClient:source.OsClient,Operation:operation,Param:param||{}},{checkCode:false});if(!result||Number(result.Code)!==1)throw new Error(result?.Msg||'商城源请求失败。');const append=result.DataAppend||{};if(append.CredentialKey)source.CredentialKey=append.CredentialKey;if(append.SourceAuthenticated!==undefined)source.HasCredential=append.SourceAuthenticated===true;if(append.FileServer)source.FileServer=append.FileServer;return result}
async function loadApps(targetPage=1){if(viewMode.value==='offline'||!effectiveSource.value)return;if(!installedVersionsReady.value){try{await loadInstalled()}catch(error){apps.value=[];dataCount.value=0;showMessage(error,'error');return}}const requestId=++listRequestSequence;loading.value=true;pageIndex.value=Math.max(1,Number(targetPage)||1);jumpPage.value=pageIndex.value;try{const scope=viewMode.value==='published'?'Owned':viewMode.value==='installed'?'Installed':'',categoryValues=[...selectedCategories.value],applicationTypeValues=[...selectedApplicationTypes.value];const result=await sourceRequest(effectiveSource.value,'List',{Scope:scope,_PageIndex:pageIndex.value,_PageSize:pageSize.value,_Keyword:keyword.value.trim(),Category:categoryValues.length===1?categoryValues[0]:'',Categories:categoryValues,ApplicationType:applicationTypeValues.length===1?applicationTypeValues[0]:'',ApplicationTypes:applicationTypeValues,Visibility:visibilityFilterValue.value,InstalledVersions:installedVersions.value});if(requestId!==listRequestSequence)return;const append=result.DataAppend||{};availableCategories.value=Array.isArray(append.Categories)?append.Categories:availableCategories.value;availableApplicationTypes.value=Array.isArray(append.ApplicationTypes)?append.ApplicationTypes:availableApplicationTypes.value;let rows=Array.isArray(result.Data)?result.Data:[];dataCount.value=Number(result.DataCount||rows.length);rows=rows.map(app=>({...app,_FileServer:append.FileServer||effectiveSource.value.FileServer||''}));apps.value=rows.map(app=>({...app,StoreId:app.StoreId||app.Id,StoreApiBase:effectiveSource.value.ApiBase,StoreOsClient:effectiveSource.value.OsClient,StoreCredentialKey:sourceCredentialKey(effectiveSource.value)}));if(pageIndex.value>pageCount.value)return loadApps(pageCount.value)}catch(error){if(requestId!==listRequestSequence)return;apps.value=[];dataCount.value=0;showMessage(error,'error')}finally{if(requestId===listRequestSequence)loading.value=false}}
function setViewMode(mode){viewMode.value=mode;if(mode==='published')activeSourceId.value=CURRENT_SOURCE_ID;if(mode!=='offline')loadApps(1)}
function selectSource(id){activeSourceId.value=id;loadApps(1)}
function jumpToPage(){loadApps(Math.min(pageCount.value,Math.max(1,Number(jumpPage.value)||1)))}

async function queueBackground(key,param,title,options){const result=await client.post('/apiengine/platform-background-task',{Action:'RunApiEngine',TargetApiEngineKey:key,Param:param,Title:title,Options:options||{}},{checkCode:false});if(result?.Code!==1)throw new Error(result?.Msg||'后台任务创建失败。');dispatch('background-task:created',result.Data||result,{force:true});return result}
async function queueInstall(app,version=null,target={}){if(!canInstallApp(app))return showMessage('当前来源不能执行该安装操作。','error');const key=appCardKey(app),source=installSetup.source||effectiveSource.value;if(installingIds.value.includes(key)||!source)return;installingIds.value=[...installingIds.value,key];try{const action=app.StoreInstallStatus==='Outdated'?'Update':app.StoreInstallStatus==='Installed'?'Reinstall':'Install',selected=version||{VersionId:'',AppVersion:app.AppVersion},targetFingerprint=[target.InstallParentSysMenuId,target.InstallParentSysMenuName,target.InstallParentCreateUnderSysMenuId].map(item=>String(item||'')).join(':'),operationId=Date.now();await queueBackground('import-microi-store-package',{Form:app,Id:app.Id||app.StoreId,StoreId:app.StoreId||app.Id,StoreVersionId:selected.VersionId||'',AppId:app.AppId||app.AppKey,AppName:appName(app),AppVersion:selected.AppVersion||app.AppVersion,StoreApiBase:source.ApiBase,StoreOsClient:source.OsClient,StoreCredentialKey:sourceCredentialKey(source),InstallAction:action,...target},`${installText(app)}应用：${appName(app)} ${selected.AppVersion||''}`,{IdempotencyKey:`marketplace:${context.osClient}:${source.Id}:${key}:${selected.VersionId||selected.AppVersion||app.AppVersion}:${action}:${targetFingerprint}:${operationId}`,ConcurrencyKey:'import-microi-store-package',MaxAttempts:3,RetryOnFailure:true});showMessage(`“${appName(app)}”已进入后台任务。`)}catch(error){showMessage(error?.Msg||error?.message||'提交安装任务失败。','error');throw error}finally{installingIds.value=installingIds.value.filter(item=>item!==key)}}
async function prepareInstall(app,version=null){if(!canInstallApp(app))return showMessage('当前来源不能执行该安装操作。','error');const source=effectiveSource.value;if(!source)return;Object.assign(installSetup,{visible:true,loading:true,submitting:false,app:{...app},version:version?{...version}:null,source:{...source},summary:null,targetMode:'root',existingParentId:'',createName:'',createUnderId:''});installMenuOptions.value=[];resetDrag('install');try{const selected=version||{},modelResult=await sourceRequest(source,'Model',{Id:app.StoreId||app.Id,VersionId:selected.VersionId||'',IncludePackage:false,IncludePackageSummary:true});const summary=modelResult?.DataAppend?.PackageSummary;if(!summary||Number(summary.SchemaVersion||0)<1)throw new Error('当前商城源尚未提供安装包资源摘要，请先更新该来源的“应用商城”应用。');installSetup.summary=summary;if(summary.RequiresInstallParent)await loadInstallMenuOptions(summary);if(selectedApp.value)closeDetail()}catch(error){showMessage(error?.Msg||error?.message||'读取安装包资源清单失败。','error');closeInstallSetup()}finally{installSetup.loading=false}}
function closeInstallSetup(){if(installSetup.submitting)return;installSetup.visible=false;installMenuOptions.value=[];Object.assign(installSetup,{loading:false,app:null,version:null,source:null,summary:null,targetMode:'root',existingParentId:'',createName:'',createUnderId:''});resetDrag('install')}
async function submitInstallSetup(){if(!canSubmitInstallSetup.value||installSetup.submitting)return;const target={InstallParentSysMenuId:'',InstallParentSysMenuName:'',InstallParentCreateUnderSysMenuId:''};if(installSetup.summary?.RequiresInstallParent){if(installSetup.targetMode==='existing')target.InstallParentSysMenuId=installSetup.existingParentId;else if(installSetup.targetMode==='create'){target.InstallParentSysMenuName=String(installSetup.createName||'').trim();target.InstallParentCreateUnderSysMenuId=installSetup.createUnderId}}installSetup.submitting=true;try{await queueInstall(installSetup.app,installSetup.version,target);installSetup.submitting=false;closeInstallSetup()}catch(_){installSetup.submitting=false}}
async function installAll(){if(!canInstallFromActiveSource.value||batchLoading.value)return;if(!await askConfirm('全部安装 / 更新',`确认从“${effectiveSource.value.Name}”安装未安装的平台应用并更新旧版本吗？已是最新版的应用会跳过。`))return;batchLoading.value=true;try{await queueBackground('bulk-import-microi-store-packages',{StoreApiBase:effectiveSource.value.ApiBase,StoreOsClient:effectiveSource.value.OsClient,StoreCredentialKey:sourceCredentialKey(effectiveSource.value),ApplicationType:'Platform'},`从${effectiveSource.value.Name}全部安装/更新`,{IdempotencyKey:`marketplace-bulk:${context.osClient}:${effectiveSource.value.Id}:${Date.now()}`,ConcurrencyKey:'bulk-import-microi-store-packages',MaxAttempts:3,RetryOnFailure:true});showMessage('全部安装 / 更新已进入后台任务。')}catch(error){showMessage(error?.Msg||error?.message||'批量任务提交失败。','error')}finally{batchLoading.value=false}}
function applyVersionResponse(response){const append=response?.DataAppend||{},rows=Array.isArray(response?.Data)?response.Data:[];if(Number(append.PaginationVersion||0)>=1){versionHistoryCount.value=Number(response.DataCount||0);versionCurrentMatches.value=append.CurrentMatches!==false;versions.value=[...(versionCurrentMatches.value&&append.CurrentVersion?[append.CurrentVersion]:[]),...rows]}else{const all=rows,filtered=versionKeyword.value?all.filter(item=>`${item.AppVersion||''} ${item.DataVersion||''} ${item.Remark||''} ${item.UserName||''} ${item.Action||''}`.toLowerCase().includes(versionKeyword.value.toLowerCase())):all;versionHistoryCount.value=Math.max(0,filtered.filter(item=>!item.IsCurrent).length);versionCurrentMatches.value=filtered.some(item=>item.IsCurrent);const history=filtered.filter(item=>!item.IsCurrent),start=(versionPageIndex.value-1)*versionPageSize.value;versions.value=[...filtered.filter(item=>item.IsCurrent).slice(0,1),...history.slice(start,start+versionPageSize.value)]}const selectable=versions.value.filter(item=>item.Installable!==false);if(!selectable.some(item=>String(item.VersionId||'')===String(selectedVersionId.value||'')))selectedVersionId.value=String(selectable.find(item=>item.IsCurrent)?.VersionId||selectable[0]?.VersionId||'')}
async function loadVersionPage(targetPage=1){if(!selectedApp.value||!effectiveSource.value)return;versionLoading.value=true;versionPageIndex.value=Math.max(1,Number(targetPage)||1);try{const response=await sourceRequest(effectiveSource.value,'Versions',{Id:selectedApp.value.StoreId||selectedApp.value.Id,_PageIndex:versionPageIndex.value,_PageSize:versionPageSize.value,_Keyword:versionKeyword.value});applyVersionResponse(response);if(versionPageIndex.value>versionPageCount.value)return loadVersionPage(versionPageCount.value)}catch(error){versions.value=[];versionHistoryCount.value=0;versionCurrentMatches.value=false;showMessage(error?.Msg||error?.message||'历史版本加载失败。','error')}finally{versionLoading.value=false}}
function clearVersionSearch(){versionKeyword.value='';loadVersionPage(1)}
async function openDetail(app){selectedApp.value=app;detailModel.value=null;detailPackageSummary.value=null;versions.value=[];changeLogs.value=[];changeLogTotal.value=0;changeLogAvailable.value=false;selectedVersionId.value='';versionKeyword.value='';versionPageIndex.value=1;versionHistoryCount.value=0;versionCurrentMatches.value=true;detailLoading.value=true;resetDrag('detail');try{const modelResult=await sourceRequest(effectiveSource.value,'Model',{Id:app.StoreId||app.Id,IncludePackage:false,IncludePackageSummary:true});const append=modelResult.DataAppend||{};detailModel.value={...(modelResult.Data||app),StoreId:app.StoreId||app.Id,StoreInstallStatus:app.StoreInstallStatus,StoreInstallStatusText:app.StoreInstallStatusText,AppVersionInstall:installedVersion(app),_FileServer:append.FileServer||app._FileServer||''};detailPackageSummary.value=append.PackageSummary||null;changeLogs.value=Array.isArray(append.ChangeLogs)?append.ChangeLogs:[];changeLogTotal.value=Number(append.ChangeLogCount||changeLogs.value.length);changeLogAvailable.value=Object.prototype.hasOwnProperty.call(append,'ChangeLogAvailable')?append.ChangeLogAvailable!==false:false;await loadVersionPage(1)}catch(error){showMessage(error?.Msg||error?.message||'应用详情加载失败。','error')}finally{detailLoading.value=false}}
function closeDetail(){selectedApp.value=null;detailModel.value=null;detailPackageSummary.value=null;versions.value=[];changeLogs.value=[];changeLogTotal.value=0;changeLogAvailable.value=false;selectedVersionId.value='';versionKeyword.value='';versionHistoryCount.value=0;resetDrag('detail')}
function openStoreForm(mode,app=null){dispatch('micro-app:host-action',{action:'openForm',requestId:`store-form-${Date.now()}`,tableName:'sys_microistore',formMode:mode,id:app?.StoreId||app?.Id||'',defaultValues:mode==='Add'?{AppVersion:'v1.0.0',ApplicationType:'Regular',Category:'other',IsPublic:1}:{}},{force:true})}

function openSourceEditor(source=null){Object.assign(sourceForm,source?{...emptySource(),...source}:{...emptySource(),Id:newId()});Object.assign(sourceLogin,{Account:'',Password:'',CaptchaId:'',CaptchaValue:'',ImageDataUrl:''});sourceEditorVisible.value=true;resetDrag('source');if(source)discoverSource(false)}
function closeSourceEditor(){sourceEditorVisible.value=false;Object.assign(sourceForm,emptySource());resetDrag('source')}
function editSource(source){openSourceEditor(source)}
async function discoverSource(showSuccess=true){sourceWorking.value=true;try{sourceForm.ApiBase=canonicalBase(sourceForm.ApiBase);sourceForm.OsClient=String(sourceForm.OsClient||'').trim();if(!sourceForm.Id)sourceForm.Id=newId();if(!sourceForm.OsClient)throw new Error('请填写 OsClient。');if(sourceForm.Type==='current'&&sameAsCurrent(sourceForm)){const result=await sourceRequest(currentSource(),'List',{_PageIndex:1,_PageSize:1});Object.assign(sourceForm,{Discovered:true,SystemTitle:context.systemTitle,SystemShortTitle:context.systemShortTitle,Name:sourceForm.Name||currentSource().Name,HasCredential:true,PublicApplicationCount:Number(result.DataAppend?.PublicApplicationCount||result.DataCount||0),PrivateApplicationCount:Number(result.DataAppend?.PrivateApplicationCount||0),AccessibleApplicationCount:Number(result.DataCount||0),CredentialKey:''})}else{const result=isOfficialPublicSource(sourceForm)?await discoverOfficialPublicSource(sourceForm):await client.post('/api/MarketplaceSource/Discover',{SourceId:sourceForm.Id,ApiBase:sourceForm.ApiBase,OsClient:sourceForm.OsClient},{checkCode:false});if(result?.Code!==1)throw new Error(result?.Msg||'商城源识别失败。');Object.assign(sourceForm,result.Data||{},{Discovered:true,Name:sourceForm.Name||result.Data?.SystemTitle||sourceForm.OsClient});if(sourceForm.RequiresCaptcha)await loadCaptcha()}if(showSuccess)showMessage('商城源识别成功。')}catch(error){sourceForm.Discovered=false;showMessage(error?.Msg||error?.message||'商城源识别失败。','error')}finally{sourceWorking.value=false}}
async function loadCaptcha(){try{const result=await client.post('/api/MarketplaceSource/Captcha',{SourceId:sourceForm.Id,ApiBase:sourceForm.ApiBase,OsClient:sourceForm.OsClient},{checkCode:false});if(result?.Code!==1)throw new Error(result?.Msg||'验证码读取失败。');Object.assign(sourceLogin,{CaptchaId:result.Data?.CaptchaId||'',CaptchaValue:'',ImageDataUrl:result.Data?.ImageDataUrl||''})}catch(error){showMessage(error?.Msg||error?.message||'验证码读取失败。','error')}}
async function loginSource(){if(!sourceForm.Discovered)return showMessage('请先识别商城源。','error');sourceWorking.value=true;try{const result=await client.post('/api/MarketplaceSource/Login',{SourceId:sourceForm.Id,ApiBase:sourceForm.ApiBase,OsClient:sourceForm.OsClient,Account:sourceLogin.Account,Password:sourceLogin.Password,CaptchaId:sourceLogin.CaptchaId,CaptchaValue:sourceLogin.CaptchaValue},{checkCode:false});if(result?.Code!==1)throw new Error(result?.Msg||'商城源登录失败。');Object.assign(sourceForm,result.Data||{},{HasCredential:true,Discovered:true});sourceLogin.Password='';sourceLogin.CaptchaValue='';if(sourceExists(sourceForm.Id)&&!isBuiltInType(sourceForm.Type))await updateExistingSourceFromForm(false);showMessage(result.Msg||'私有商城源登录成功。')}catch(error){showMessage(error?.Msg||error?.message||'商城源登录失败。','error');if(sourceForm.RequiresCaptcha)await loadCaptcha()}finally{sourceLogin.Password='';sourceWorking.value=false}}
async function disconnectSource(){if(!await askConfirm('退出来源登录','退出后仍可安装公开应用，但私有应用将不可见，确认继续吗？'))return;sourceWorking.value=true;try{const result=await client.post('/api/MarketplaceSource/Disconnect',{SourceId:sourceForm.Id},{checkCode:false});if(result?.Code!==1)throw new Error(result?.Msg||'退出来源登录失败。');sourceForm.HasCredential=false;sourceForm.PrivateApplicationCount=0;sourceForm.AccessibleApplicationCount=sourceForm.PublicApplicationCount||0;const existing=sources.value.find(item=>item.Id===sourceForm.Id);if(existing)Object.assign(existing,sourceForm);if(!isBuiltInType(sourceForm.Type))await persistSources('来源登录已退出。');else showMessage('来源登录已退出。')}catch(error){showMessage(error?.Msg||error?.message||'退出来源登录失败。','error')}finally{sourceWorking.value=false}}
async function updateExistingSourceFromForm(showSaved=true){const index=sources.value.findIndex(item=>item.Id===sourceForm.Id);if(index<0)return;sources.value[index]={...sources.value[index],...sourceForm,Password:undefined};if(!isBuiltInType(sourceForm.Type))await persistSources(showSaved?'商城源已更新并立即生效。':'私有来源登录状态已保存。')}
async function upsertSource(){if(!sourceForm.Discovered)return showMessage('必须先成功识别商城源。','error');sourceWorking.value=true;try{const next={...emptySource(),...sourceForm,Id:sourceForm.Id||newId(),Name:String(sourceForm.Name||sourceForm.SystemTitle||sourceForm.OsClient).trim(),ApiBase:canonicalBase(sourceForm.ApiBase),OsClient:String(sourceForm.OsClient||'').trim(),Enabled:true},duplicate=sources.value.find(item=>item.Id!==next.Id&&canonicalBaseSafe(item.ApiBase).toLowerCase()===next.ApiBase.toLowerCase()&&String(item.OsClient).toLowerCase()===next.OsClient.toLowerCase());if(duplicate)throw new Error(`该来源已存在：${duplicate.Name}`);const index=sources.value.findIndex(item=>item.Id===next.Id);if(index>=0)sources.value[index]={...sources.value[index],...next};else sources.value.push(next);if(!isBuiltInType(next.Type))await persistSources(index>=0?'商城源已更新并立即生效。':'商城源已添加并立即生效。');activeSourceId.value=next.Id;Object.assign(sourceForm,next);await loadApps(1)}catch(error){showMessage(error?.Msg||error?.message||'商城源保存失败。','error')}finally{sourceWorking.value=false}}
async function toggleSource(source,enabled){source.Enabled=!!enabled;try{await persistSources(enabled?'商城源已启用。':'商城源已停用。')}catch(error){source.Enabled=!enabled;showMessage(error?.message||'商城源状态保存失败。','error')}}
async function requestRemoveSource(source){if(!await askConfirm('删除商城源',`确认删除“${source.Name}”吗？已安装应用不会被删除；该来源保存的登录 Token 也会一并移除。`))return;try{if(source.HasCredential)await client.post('/api/MarketplaceSource/Disconnect',{SourceId:source.Id},{checkCode:false});sources.value=sources.value.filter(item=>item.Id!==source.Id);if(activeSourceId.value===source.Id)activeSourceId.value=OFFICIAL_SOURCE_ID;await persistSources('商城源已删除。');if(sourceForm.Id===source.Id)Object.assign(sourceForm,{...emptySource(),Id:newId()});await loadApps(1)}catch(error){showMessage(error?.Msg||error?.message||'商城源删除失败。','error')}}
async function refreshSourceStats(){await Promise.allSettled(sources.value.map(async source=>{try{if(source.Type==='current'){const result=await sourceRequest(source,'List',{_PageIndex:1,_PageSize:1});Object.assign(source,{AccessibleApplicationCount:Number(result.DataCount||0),PublicApplicationCount:Number(result.DataAppend?.PublicApplicationCount||0),PrivateApplicationCount:Number(result.DataAppend?.PrivateApplicationCount||0),HasCredential:true,Discovered:true})}else{const result=isOfficialPublicSource(source)?await discoverOfficialPublicSource(source):await client.post('/api/MarketplaceSource/Discover',{SourceId:source.Id,ApiBase:source.ApiBase,OsClient:source.OsClient},{checkCode:false});if(result?.Code===1)Object.assign(source,result.Data||{},{Discovered:true,Name:source.Name||result.Data?.SystemTitle})}}catch(_){}}))}

function selectOfflineFile(event){const file=event.target.files?.[0]||null;if(file&&file.size>MAX_OFFLINE_BYTES){offlineFile.value=null;event.target.value='';showMessage('离线包不能超过 50 MB。','error');return}offlineFile.value=file}
function formatBytes(bytes){if(!bytes)return'0 B';const units=['B','KB','MB'],index=Math.min(2,Math.floor(Math.log(bytes)/Math.log(1024)));return`${(bytes/Math.pow(1024,index)).toFixed(index?1:0)} ${units[index]}`}
async function installOfflinePackage(){if(!offlineFile.value||offlineLoading.value)return;offlineLoading.value=true;try{const packageModel=JSON.parse(await offlineFile.value.text());if(!packageModel?.PackageInfo)throw new Error('离线包格式不正确：缺少 PackageInfo。');const packageName=packageModel.PackageInfo.Name||packageModel.PackageInfo.PackageName||offlineFile.value.name;await queueBackground('import-microi-store-package',{Package:packageModel,PackageFileName:offlineFile.value.name},`安装离线包应用：${packageName}`,{IdempotencyKey:`offline:${context.osClient}:${packageName}:${packageModel.PackageInfo.Version||''}:${Date.now()}`,ConcurrencyKey:'import-microi-store-package',MaxAttempts:3,RetryOnFailure:true});showMessage('离线包已进入后台安装任务。');offlineFile.value=null}catch(error){showMessage(error?.Msg||error?.message||'安装离线包失败。','error')}finally{offlineLoading.value=false}}
function askConfirm(title,message){if(confirmResolver)confirmResolver(false);confirmState.title=title;confirmState.message=message;confirmState.visible=true;return new Promise(resolve=>{confirmResolver=resolve})}
function resolveConfirm(value){confirmState.visible=false;const resolver=confirmResolver;confirmResolver=null;resolver?.(!!value)}
function resetDrag(name){dragOffsets[name].x=0;dragOffsets[name].y=0}
function dragStyle(name){return{transform:`translate3d(${dragOffsets[name].x}px, ${dragOffsets[name].y}px, 0)`}}
function clampDrag(name,shell,nextX=dragOffsets[name].x,nextY=dragOffsets[name].y){if(!shell)return;const boundary=shell.closest('dialog.modal-backdrop')?.getBoundingClientRect(),viewport={left:boundary?.left||0,top:boundary?.top||0,right:boundary?.right||window.innerWidth,bottom:boundary?.bottom||window.innerHeight,width:boundary?.width||window.innerWidth},gutter=viewport.width<=760?8:18,current=dragOffsets[name],rect=shell.getBoundingClientRect(),baseLeft=rect.left-current.x,baseRight=rect.right-current.x,baseTop=rect.top-current.y,baseBottom=rect.bottom-current.y,minX=viewport.left+gutter-baseLeft,maxX=viewport.right-gutter-baseRight,minY=viewport.top+gutter-baseTop,maxY=viewport.bottom-gutter-baseBottom;current.x=Math.round(Math.max(Math.min(minX,maxX),Math.min(Math.max(minX,maxX),nextX)));current.y=Math.round(Math.max(Math.min(minY,maxY),Math.min(Math.max(minY,maxY),nextY)))}
function clampOpenDialogs(){document.querySelectorAll('.modal-shell[data-drag-name]').forEach(shell=>clampDrag(shell.dataset.dragName,shell))}
function startDrag(event,name){if(event.button!==0||event.target.closest('button,input,select,a'))return;const shell=event.currentTarget.closest('.modal-shell');if(!shell)return;event.preventDefault();const startX=event.clientX,startY=event.clientY,originX=dragOffsets[name].x,originY=dragOffsets[name].y;const move=current=>clampDrag(name,shell,originX+current.clientX-startX,originY+current.clientY-startY);const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up)};window.addEventListener('pointermove',move);window.addEventListener('pointerup',up,{once:true});window.addEventListener('pointercancel',up,{once:true})}

let modalDocumentScrollState=null
function syncModalDocumentScrollLock(visible){const root=document.documentElement,body=document.body;if(!root||!body)return;if(visible){if(modalDocumentScrollState)return;const scrollbarWidth=Math.max(0,(window.innerWidth||0)-root.clientWidth),bodyPadding=Number.parseFloat(window.getComputedStyle(body).paddingRight)||0;modalDocumentScrollState={rootOverflow:root.style.overflow,rootOverscrollBehavior:root.style.overscrollBehavior,bodyOverflow:body.style.overflow,bodyOverscrollBehavior:body.style.overscrollBehavior,bodyPaddingRight:body.style.paddingRight,scrollX:window.scrollX,scrollY:window.scrollY};root.style.overflow='hidden';root.style.overscrollBehavior='none';body.style.overflow='hidden';body.style.overscrollBehavior='none';if(scrollbarWidth>0)body.style.paddingRight=`${bodyPadding+scrollbarWidth}px`;return}const state=modalDocumentScrollState;if(!state)return;root.style.overflow=state.rootOverflow;root.style.overscrollBehavior=state.rootOverscrollBehavior;body.style.overflow=state.bodyOverflow;body.style.overscrollBehavior=state.bodyOverscrollBehavior;body.style.paddingRight=state.bodyPaddingRight;modalDocumentScrollState=null;if(Math.abs(window.scrollX-state.scrollX)>1||Math.abs(window.scrollY-state.scrollY)>1)window.scrollTo(state.scrollX,state.scrollY)}
function publishHostOverlay(visible){const nativeTopLayer=visible&&nativeTopLayerAvailable.value;dispatch('micro-app:host-action',{action:'setGlobalOverlay',requestId:`store-overlay-${Date.now()}`,visible,blur:!context.disableFormMaskBlur,lockScroll:visible,nativeTopLayer,mask:visible&&!nativeTopLayer,promote:visible&&!nativeTopLayer,silent:true},{force:true})}
async function presentNativeDialog(dialogRef,visible){await nextTick();const dialog=dialogRef.value;if(!visible||!dialog)return;if(!nativeTopLayerAvailable.value){dialog.setAttribute('open','');return}try{if(!dialog.open)dialog.showModal()}catch(_){nativeTopLayerAvailable.value=false;dialog.setAttribute('open','');publishHostOverlay(anyModalOpen.value)}}
watch(sourceEditorVisible,visible=>presentNativeDialog(sourceDialog,visible),{flush:'post'})
watch(selectedApp,value=>presentNativeDialog(detailDialog,!!value),{flush:'post'})
watch(()=>installSetup.visible,visible=>presentNativeDialog(installDialog,visible),{flush:'post'})
watch(()=>confirmState.visible,visible=>presentNativeDialog(confirmDialog,visible),{flush:'post'})
watch(anyModalOpen,visible=>{syncModalDocumentScrollLock(visible);publishHostOverlay(visible)},{flush:'post'})
onMounted(async()=>{window.addEventListener('resize',clampOpenDialogs);unsubscribeContext=subscribeContext(next=>Object.assign(context,next),false);hostDataListener=data=>{if(String(data?.type||'').toLowerCase()==='micro-app:form-saved')loadApps(1)};window.microApp?.addDataListener?.(hostDataListener);await loadSources();await loadApps(1);void refreshSourceStats()})
onBeforeUnmount(()=>{window.removeEventListener('resize',clampOpenDialogs);syncModalDocumentScrollLock(false);unsubscribeContext?.();if(hostDataListener)window.microApp?.removeDataListener?.(hostDataListener);if(confirmResolver)confirmResolver(false);dispatch('micro-app:host-action',{action:'setGlobalOverlay',requestId:`store-overlay-close-${Date.now()}`,visible:false,lockScroll:false,promote:false,silent:true},{force:true})})
</script>
