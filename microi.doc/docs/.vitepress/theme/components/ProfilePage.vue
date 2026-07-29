<template>
  <div class="profile-page">
    <aside class="profile-sidebar">
      <a class="brand" href="/profile.html">
        <img v-if="profileAvatarUrl" class="brand-avatar-img" :src="profileAvatarUrl" :alt="profileName" />
        <span v-else class="brand-mark">{{ profileInitial }}</span>
        <span>
          <strong>{{ profileName }}</strong>
          <small>{{ licenseShortText }}</small>
        </span>
      </a>
      <nav class="side-menu">
        <button
          v-for="item in menus"
          :key="item.key"
          type="button"
          class="side-menu-item"
          :class="{ active: activeMenu === item.key }"
          @click="navigateProfile(item.key)"
        >
          <span class="menu-icon">{{ item.icon }}</span>
          <span>{{ item.name }}</span>
        </button>
      </nav>
      <div class="sidebar-footer">
        <div class="sidebar-token-card">
          <span>{{ t('remainingToken') }}</span>
          <strong>{{ formatTokenNumber(relayToken.RemainingTokens) }}</strong>
          <div class="sidebar-token-track" aria-hidden="true">
            <i :style="{ width: `${tokenUsagePercent}%` }"></i>
          </div>
          <small>{{ t('tokenUsedTotal', { used: formatTokenNumber(relayToken.UsedTokens), total: formatTokenNumber(relayToken.GiftTokens) }) }}</small>
        </div>
      </div>
    </aside>

    <main class="profile-main">
      <header class="profile-header">
        <div>
          <p class="eyebrow">Microi Account</p>
          <h1>{{ pageTitle }}</h1>
          <p class="header-desc">{{ pageDesc }}</p>
        </div>
        <div class="header-actions">
          <a v-if="primaryTenantUrl" class="ghost-action" :href="primaryTenantUrl" target="_blank" rel="noopener">{{ t('enterBackend') }}</a>
          <button class="primary-action" type="button" @click="refreshCenter">{{ t('refresh') }}</button>
        </div>
      </header>

      <div v-if="profileNotice" class="profile-notice" :class="profileNotice.type" role="status">{{ profileNotice.message }}</div>

      <section v-if="!isAuthed" class="state-panel">
        <h2>{{ t('loginRequired') }}</h2>
        <p>{{ t('loginRequiredDesc') }}</p>
        <a class="primary-action inline" href="/login.html?redirect=/profile.html">{{ t('goLogin') }}</a>
      </section>

      <template v-else>
        <section v-if="activeMenu === 'overview'" class="profile-hero">
          <div>
            <p class="eyebrow">Microi Account</p>
            <h2>{{ t('overview') }}</h2>
            <p>{{ t('overviewDesc', { name: profileName }) }}</p>
          </div>
          <article class="license-card">
            <span>{{ t('currentLicense') }}</span>
            <strong>{{ licenseDisplayTitle }}</strong>
            <small>{{ licenseDisplayDesc }}</small>
          </article>
        </section>

        <section v-if="activeMenu === 'overview'" class="overview-grid">
          <article class="stat-card">
            <span>{{ t('tenantCreated') }}</span>
            <strong>{{ tenants.length }}</strong>
            <small>{{ t('freeQuota', { count: tenantDatabaseQuota }) }}</small>
          </article>
          <article class="stat-card">
            <span>{{ t('freeCreate') }}</span>
            <strong>{{ canCreateFreeTenant ? t('available') : t('used') }}</strong>
            <small>{{ t('freeCreateTip') }}</small>
          </article>
          <article class="stat-card">
            <span>{{ t('expansionPrice') }}</span>
            <strong>¥{{ tenantCenter.NextTenantPrice || 9.9 }}</strong>
            <small>{{ t('expansionPriceTip') }}</small>
          </article>
          <article class="stat-card token-stat-card">
            <span>{{ t('relayToken') }}</span>
            <strong>{{ formatTokenNumber(relayToken.RemainingTokens) }}</strong>
            <small>{{ t('tokenUsedTotal', { used: formatTokenNumber(relayToken.UsedTokens), total: formatTokenNumber(relayToken.GiftTokens) }) }}</small>
          </article>
        </section>

        <ProfileAiSummary
          v-if="activeMenu === 'overview'"
          compact
          :api-key="aiApiKey"
          :endpoint="aiApiEndpoint || 'https://api.itdos.com/v1'"
          :total="relayToken.GiftTokens"
          :used="relayToken.UsedTokens"
          :remaining="relayToken.RemainingTokens"
          :locale="locale"
          :labels="aiSummaryLabels"
          @copy="copyAiApiKey"
        />

        <section v-if="activeMenu === 'overview'" class="content-panel tenant-overview-panel">
          <div class="panel-head">
            <div>
              <h2>{{ t('saasTenants') }}</h2>
              <p>{{ t('tenantDesc') }}</p>
            </div>
            <button class="primary-action small" type="button" @click="navigateProfile('create')">{{ t('createTenant') }}</button>
          </div>
          <div v-if="isLoading" class="loading-row">{{ t('loadingTenants') }}</div>
          <TenantList v-else :tenants="tenants" />
          <EmptyTenants v-if="!isLoading && tenants.length === 0" @create="navigateProfile('create')" />
          <div class="billing-strip">
            <div>
              <span>{{ t('freeCreate') }}</span>
              <strong>{{ t('oneTenant') }}</strong>
              <small>{{ t('freeQuotaDesc') }}</small>
            </div>
            <div>
              <span>{{ t('expansionPrice') }}</span>
              <strong>{{ t('expansionAmount', { price: tenantCenter.NextTenantPrice || 9.9 }) }}</strong>
              <small>{{ t('expansionDesc') }}</small>
            </div>
          </div>
        </section>

        <section v-if="activeMenu === 'create'" class="content-grid">
          <form class="content-panel create-panel" @submit.prevent="requestTenantCreation">
            <div class="panel-head">
              <div>
                <h2>{{ canCreateFreeTenant ? t('createFreeTenant') : t('createMoreTenants') }}</h2>
                <p>{{ canCreateFreeTenant ? t('firstTenantFree') : t('moreTenantPaid') }}</p>
              </div>
            </div>
            <aside class="star-policy-notice" role="note">
              <span class="star-policy-notice__icon" aria-hidden="true">★</span>
              <div>
                <strong>{{ t('starPolicyTitle') }}</strong>
                <p>{{ t('starPolicyDescription') }}</p>
              </div>
            </aside>
            <div class="form-row">
              <label>{{ t('tenantKey') }}</label>
              <input v-model.trim="tenantKey" :placeholder="t('tenantKeyPlaceholder')" autocomplete="off" />
              <small>{{ t('tenantKeyTip') }}</small>
            </div>
            <div class="form-row">
              <label>{{ t('systemName') }}</label>
              <input v-model.trim="systemName" :placeholder="t('systemNamePlaceholder')" autocomplete="organization" />
              <small>{{ t('systemNameTip') }}</small>
            </div>
            <p v-if="createError" class="error-box">{{ createError }}</p>
            <button ref="createSubmitButton" class="primary-action submit" type="submit" :disabled="isCreating || isCheckingGiteeStar || !canCreateFreeTenant">
              {{ isCreating ? t('creating') : isCheckingGiteeStar ? t('giteeStarChecking') : canCreateFreeTenant ? t('createFreeTenant') : t('paymentComing') }}
            </button>
          </form>

          <div class="content-panel progress-panel">
            <div class="panel-head">
              <div>
                <h2>{{ t('progress') }}</h2>
                <p>{{ tenantProgress || tenantStepSummary }}</p>
              </div>
            </div>
            <div class="step-list">
              <div v-for="(step, index) in tenantSteps" :key="step.Key" class="step-item" :class="step.Status">
                <span>{{ index + 1 }}</span>
                <div>
                  <strong>{{ step.Title }}</strong>
                  <em class="step-elapsed">{{ stepElapsedText(step) }}</em>
                  <b v-if="step.Key === 'import-template'" class="step-wait-notice">{{ t('templateImportEstimate') }}</b>
                  <small>{{ step.Detail }}</small>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section v-if="activeMenu === 'account'" class="content-panel">
          <h2>{{ t('account') }}</h2>
          <p class="account-intro">{{ t('profileEditDesc') }}</p>
          <div class="account-editor">
            <div class="avatar-editor">
              <img v-if="profileDraftAvatarUrl" :src="profileDraftAvatarUrl" :alt="profileDraftName" />
              <span v-else>{{ profileInitial }}</span>
              <div>
                <strong>{{ t('avatarLabel') }}</strong>
                <small>{{ t('avatarTip') }}</small>
                <div class="avatar-actions">
                  <button class="ghost-action" type="button" @click="showAvatarGenerator = true">{{ t('generateAvatar') }}</button>
                  <button class="ghost-action" type="button" :disabled="isUploadingAvatar" @click="profileFileInput?.click()">{{ isUploadingAvatar ? t('uploadingAvatar') : t('uploadAvatar') }}</button>
                  <input ref="profileFileInput" type="file" accept="image/png,image/jpeg,image/webp" hidden @change="handleAvatarFileChange" />
                </div>
              </div>
            </div>
            <div class="account-form">
              <label>{{ t('accountLabel') }}<input :value="currentUser.Account || '-'" disabled /></label>
              <label>{{ t('nicknameLabel') }}<input v-model.trim="profileDraftName" maxlength="50" :placeholder="t('nicknamePlaceholder')" /></label>
              <label>{{ t('phoneLabel') }}<input :value="currentUser.Phone || '-'" disabled /></label>
            </div>
          </div>
          <div class="account-actions">
            <button class="primary-action" type="button" :disabled="isSavingProfile || isUploadingAvatar" @click="saveProfile">{{ isSavingProfile ? t('savingProfile') : t('saveProfile') }}</button>
            <button class="ghost-action danger" type="button" @click="logout">{{ t('logout') }}</button>
          </div>
        </section>

        <section v-if="activeMenu === 'ai'" class="content-panel">
          <ProfileAiChat
            :api-base="API_BASE"
            :os-client="OS_CLIENT"
            :auth-token="authToken"
            :user-id="String(currentUser?.Id || '')"
            :locale="locale"
            @token-refreshed="handleAiTokenRefreshed"
            @refresh-quota="refreshAiAfterChat"
          />
          <ProfileAiSummary
            :api-key="aiApiKey"
            :endpoint="aiApiEndpoint || 'https://api.itdos.com/v1'"
            :total="relayToken.GiftTokens"
            :used="relayToken.UsedTokens"
            :remaining="relayToken.RemainingTokens"
            :locale="locale"
            :labels="aiSummaryLabels"
            @copy="copyAiApiKey"
          />
          <h3 class="usage-section-title">{{ t('usageRecords') }}</h3>
          <div class="usage-table-wrap">
            <table class="usage-table">
              <thead><tr><th>{{ t('time') }}</th><th>{{ t('model') }}</th><th>{{ t('promptPreview') }}</th><th>{{ t('input') }}</th><th>{{ t('output') }}</th><th>{{ t('deduction') }}</th><th>{{ t('remaining') }}</th><th>{{ t('source') }}</th></tr></thead>
              <tbody>
                <tr v-for="item in relayUsageLogs" :key="item.Id">
                  <td>{{ item.CreateTime }}</td><td>{{ item.AiModel || '-' }}</td><td :title="item.PromptPreview || ''">{{ item.PromptPreview || '-' }}</td><td>{{ item.PromptTokens || 0 }}</td>
                  <td>{{ item.CompletionTokens || 0 }}</td><td>{{ item.TotalTokens || 0 }}</td>
                  <td>{{ formatTokenNumber(item.RemainingTokens) }}</td><td>{{ item.Source || '-' }}</td>
                </tr>
                <tr v-if="relayUsageLogs.length === 0"><td colspan="8">{{ aiUsageLoading ? t('loadingUsage') : t('noUsage') }}</td></tr>
              </tbody>
            </table>
          </div>
          <div class="usage-pagination">
            <span>{{ t('usageTotal', { total: aiUsageTotal }) }}</span>
            <label>
              {{ t('pageSize') }}
              <select v-model.number="aiUsagePageSize" @change="changeAiUsagePageSize">
                <option :value="10">10</option>
                <option :value="20">20</option>
                <option :value="50">50</option>
              </select>
            </label>
            <button type="button" :disabled="aiUsageLoading || aiUsagePageIndex <= 1" @click="goAiUsagePage(aiUsagePageIndex - 1)">{{ t('previousPage') }}</button>
            <strong>{{ aiUsagePageIndex }} / {{ aiUsageTotalPages }}</strong>
            <button type="button" :disabled="aiUsageLoading || aiUsagePageIndex >= aiUsageTotalPages" @click="goAiUsagePage(aiUsagePageIndex + 1)">{{ t('nextPage') }}</button>
          </div>
          <h3 class="usage-section-title recharge-title">{{ t('rechargeRecords') }}</h3>
          <div class="usage-table-wrap">
            <table class="usage-table">
              <thead><tr><th>{{ t('time') }}</th><th>{{ t('rechargeAmount') }}</th><th>{{ t('afterTotal') }}</th><th>{{ t('afterRemaining') }}</th><th>{{ t('rechargeType') }}</th><th>{{ t('status') }}</th><th>{{ t('source') }}</th><th>{{ t('remark') }}</th></tr></thead>
              <tbody>
                <tr v-for="item in rechargeLogs" :key="item.Id">
                  <td>{{ item.CreateTime }}</td><td>{{ formatSignedToken(item.TokenAmount) }}</td><td>{{ formatTokenNumber(item.AfterTotal) }}</td>
                  <td>{{ formatTokenNumber(item.AfterRemaining) }}</td><td>{{ rechargeTypeText(item.RechargeType) }}</td><td>{{ rechargeStatusText(item.Status) }}</td>
                  <td>{{ item.Source || '-' }}</td><td :title="item.Remark || ''">{{ item.Remark || '-' }}</td>
                </tr>
                <tr v-if="rechargeLogs.length === 0"><td colspan="8">{{ rechargeLoading ? t('loadingRecharge') : t('noRecharge') }}</td></tr>
              </tbody>
            </table>
          </div>
          <div class="usage-pagination">
            <span>{{ t('usageTotal', { total: rechargeTotal }) }}</span>
            <label>
              {{ t('pageSize') }}
              <select v-model.number="rechargePageSize" @change="changeRechargePageSize">
                <option :value="10">10</option>
                <option :value="20">20</option>
                <option :value="50">50</option>
              </select>
            </label>
            <button type="button" :disabled="rechargeLoading || rechargePageIndex <= 1" @click="goRechargePage(rechargePageIndex - 1)">{{ t('previousPage') }}</button>
            <strong>{{ rechargePageIndex }} / {{ rechargeTotalPages }}</strong>
            <button type="button" :disabled="rechargeLoading || rechargePageIndex >= rechargeTotalPages" @click="goRechargePage(rechargePageIndex + 1)">{{ t('nextPage') }}</button>
          </div>
        </section>

        <p v-if="profileError" class="page-error">{{ profileError }}</p>
      </template>
    </main>

    <div v-if="showAvatarGenerator" class="avatar-generator-backdrop" @click.self="closeAvatarGenerator" @keydown.esc="closeAvatarGenerator">
      <section class="avatar-generator-dialog" role="dialog" aria-modal="true" aria-labelledby="avatar-generator-title">
        <button class="avatar-generator-close" type="button" :aria-label="t('closeAvatarGenerator')" @click="closeAvatarGenerator">×</button>
        <span class="avatar-generator-mark" aria-hidden="true">AI</span>
        <p class="eyebrow">Microi AI Studio · MiniMax image-01</p>
        <h2 id="avatar-generator-title">{{ t('generateAvatarTitle') }}</h2>
        <p>{{ t('generateAvatarDesc') }}</p>
        <div class="avatar-style-list">
          <button v-for="style in avatarStyles" :key="style.key" type="button" :class="{ active: avatarStyle === style.key }" @click="avatarStyle = style.key">{{ style.label }}</button>
        </div>
        <textarea v-model.trim="avatarPrompt" maxlength="500" rows="3" :placeholder="t('avatarPromptPlaceholder')"></textarea>
        <button class="primary-action avatar-generate-action" type="button" :disabled="isGeneratingAvatar || avatarPrompt.length < 4" @click="generateAvatarCandidates">
          {{ isGeneratingAvatar ? t('generatingAvatar') : t('generateCandidates') }}
        </button>
        <p v-if="avatarGeneratorError" class="avatar-generator-error" role="alert">{{ avatarGeneratorError }}</p>
        <div v-if="avatarCandidates.length" class="avatar-candidate-grid">
          <button v-for="image in avatarCandidates" :key="image" type="button" :class="{ selected: selectedAvatarCandidate === image }" @click="selectedAvatarCandidate = image">
            <img :src="image" :alt="t('avatarCandidate')" />
          </button>
        </div>
        <div v-if="avatarCandidates.length" class="avatar-generator-footer">
          <small>{{ t('avatarGeneratedNotice') }}</small>
          <button class="primary-action" type="button" :disabled="!selectedAvatarCandidate || isUploadingAvatar" @click="useGeneratedAvatar">{{ t('useAvatar') }}</button>
        </div>
      </section>
    </div>

    <div
      v-if="showStarReminder"
      class="star-reminder-backdrop"
      @click.self="closeStarReminder"
      @keydown.esc="closeStarReminder"
    >
      <section
        class="star-reminder-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="star-reminder-title"
        aria-describedby="star-reminder-description"
      >
        <button class="star-reminder-close" type="button" :aria-label="t('starReminderClose')" :disabled="isStartingGiteeOAuth" @click="closeStarReminder">×</button>
        <span class="star-reminder-icon" aria-hidden="true">★</span>
        <p class="eyebrow">Microi Open Source</p>
        <h2 id="star-reminder-title">{{ t('starReminderTitle') }}</h2>
        <p id="star-reminder-description" class="star-reminder-description">{{ t('starReminderDescription') }}</p>
        <a class="star-project-link" href="https://gitee.com/ITdos/microi.net" target="_blank" rel="noopener noreferrer">
          gitee.com/ITdos/microi.net
        </a>
        <p class="star-reminder-thanks">{{ t('starReminderThanks') }}</p>
        <p v-if="giteeStarError" class="star-reminder-status" role="alert">{{ giteeStarError }}</p>
        <div class="star-reminder-actions">
          <a class="primary-action" href="https://gitee.com/ITdos/microi.net" target="_blank" rel="noopener noreferrer">
            {{ t('starReminderOpenGitee') }}
          </a>
          <button ref="starContinueButton" class="ghost-action star-continue-action" type="button" :disabled="isStartingGiteeOAuth" @click="beginGiteeStarOAuth">
            {{ isStartingGiteeOAuth ? t('giteeOAuthStarting') : t('starReminderContinue') }}
          </button>
        </div>
        <button class="star-reminder-cancel" type="button" :disabled="isStartingGiteeOAuth" @click="closeStarReminder">{{ t('starReminderCancel') }}</button>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, defineComponent, h, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import ProfileAiChat from './ProfileAiChat.vue'
import ProfileAiSummary from './ProfileAiSummary.vue'
import { getInitialProfileLocale, normalizeProfileLocale, translateProfile } from '../profile-i18n'
import { createOpenClawAuthBridge, isOpenClawBridgeMode } from '../openclaw-auth-bridge'
import { resolveSiteApiBase } from '../utils/site-api-base.js'

const API_BASE = resolveSiteApiBase(import.meta.env.VITE_MICROI_API_BASE)
const OS_CLIENT = 'iTdos'

const activeMenu = ref('overview')
const locale = ref(getInitialProfileLocale())
const t = (key, params = {}) => translateProfile(locale.value, key, params)
const authToken = ref('')
const currentUser = ref(null)
const tenantCenter = ref({})
const tenants = ref([])
const isLoading = ref(false)
const isCreating = ref(false)
const tenantKey = ref('')
const systemName = ref('')
const tenantProgress = ref('')
const createError = ref('')
const profileError = ref('')
const profileNotice = ref(null)
const profileDraftName = ref('')
const profileDraftAvatar = ref('')
const profileDraftPreview = ref('')
const profileFileInput = ref(null)
const isSavingProfile = ref(false)
const isUploadingAvatar = ref(false)
const showAvatarGenerator = ref(false)
const isGeneratingAvatar = ref(false)
const avatarPrompt = ref('')
const avatarStyle = ref('professional')
const avatarCandidates = ref([])
const selectedAvatarCandidate = ref('')
const avatarGeneratorError = ref('')
const showStarReminder = ref(false)
const isStartingGiteeOAuth = ref(false)
const isCheckingGiteeStar = ref(false)
const giteeStarError = ref('')
const createSubmitButton = ref(null)
const starContinueButton = ref(null)
const tenantSteps = ref([])
const tenantProgressTick = ref(Date.now())
const relayToken = ref({
  GiftTokens: 100000,
  UsedTokens: 0,
  RemainingTokens: 100000
})
const aiApiKey = ref('')
const aiApiEndpoint = ref('https://api.itdos.com/v1')
const relayUsageLogs = ref([])
const aiUsagePageIndex = ref(1)
const aiUsagePageSize = ref(20)
const aiUsageTotal = ref(0)
const aiUsageLoading = ref(false)
const aiUsageTotalPages = computed(() => Math.max(1, Math.ceil(aiUsageTotal.value / aiUsagePageSize.value)))
const rechargeLogs = ref([])
const rechargePageIndex = ref(1)
const rechargePageSize = ref(20)
const rechargeTotal = ref(0)
const rechargeLoading = ref(false)
const rechargeTotalPages = computed(() => Math.max(1, Math.ceil(rechargeTotal.value / rechargePageSize.value)))

let tenantProgressTimer = null
let profileNoticeTimer = null
let tenantProgressTraceId = ''
let tenantProgressRestorePending = false
let openClawAuthBridge = null

const GITEE_STAR_DRAFT_KEY = 'microi_gitee_star_tenant_draft'
const GITEE_STAR_DRAFT_TTL_MS = 10 * 60 * 1000
const TENANT_BOOTSTRAP_CREDENTIAL_TTL_MS = 10 * 60 * 1000
const tenantBootstrapCredentials = new Map()
const tenantCredentialDeliveryIds = new Map()

const menus = computed(() => [
  { key: 'overview', name: t('overview'), icon: '⌂' },
  { key: 'create', name: t('createTenant'), icon: '+' },
  { key: 'ai', name: t('aiRelay'), icon: 'AI' },
  { key: 'account', name: t('account'), icon: '◉' }
])

const menuKeys = ['overview', 'create', 'ai', 'account']
const routeAliases = { tenants: 'overview', billing: 'overview' }

const tenantStepMessages = {
  'zh-CN': [
    ['validate', '校验账号与租户Key', '检查登录态、租户Key格式和系统名称。'], ['quota', '检查租户数据库额度', '检查当前账号的已用额度与可创建总额度。'],
    ['columns', '检查主库字段', '补齐官网开通所需的租户归属字段。'], ['database-info', '生成数据库信息', '生成数据库名、专属账号名和访问域名，不返回主库连接串。'],
    ['create-database', '创建租户数据库', '创建独立租户库、随机密码账号，并仅授权当前租户库。'], ['import-template', '下载并导入空库模板', '每次都获取最新 microi_empty_mysql57.sql.zip。'],
    ['create-osclient', '写入SaaS引擎配置', '复制主租户公共配置并写入租户域名、连接串和JWT密钥。'], ['owner', '绑定账号与租户', '记录租户归属，后续个人中心按账号展示。'],
    ['admin', '关联默认管理员', '复用空库模板中的默认 admin 账号，不额外插入管理员数据。'], ['sys-config', '初始化系统设置', '复制主库系统设置并归一化为一条启用配置。'],
    ['reload', '刷新SaaS引擎缓存', '让新租户无需重启即可访问。']
  ],
  'en-US': [
    ['validate', 'Validate account and tenant key', 'Check the session, tenant key format, and system name.'], ['quota', 'Check tenant database quota', 'Check this account\'s used and total tenant database quota.'],
    ['columns', 'Check main database fields', 'Add the ownership fields required by website provisioning.'], ['database-info', 'Generate database information', 'Generate the database name, dedicated account, and domain without exposing the main connection.'],
    ['create-database', 'Create tenant database', 'Create an independent database and a random-password account limited to this tenant database.'], ['import-template', 'Import the empty template', 'Fetch the latest microi_empty_mysql57.sql.zip.'],
    ['create-osclient', 'Write SaaS configuration', 'Copy shared settings and write the domain, connection string, and JWT secret.'], ['owner', 'Bind account and tenant', 'Save tenant ownership for the personal center.'],
    ['admin', 'Bind default administrator', 'Reuse the admin account from the empty template.'], ['sys-config', 'Initialize system settings', 'Copy and normalize the enabled system configuration.'],
    ['reload', 'Refresh SaaS cache', 'Make the new tenant available without restarting.']
  ]
}

const isAuthed = computed(() => !!authToken.value && !!currentUser.value)
const tokenUsagePercent = computed(() => {
  const total = Math.max(0, Number(relayToken.value.GiftTokens || 0))
  const used = Math.max(0, Number(relayToken.value.UsedTokens || 0))
  return total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
})
const tenantDatabaseQuota = computed(() => Math.max(1, Number(tenantCenter.value.TenantDatabaseQuota ?? tenantCenter.value.FreeQuota ?? 1)))
const tenantUsedQuota = computed(() => Math.max(0, Number(tenantCenter.value.UsedQuota ?? tenants.value.length)))
const canCreateFreeTenant = computed(() => tenantUsedQuota.value < tenantDatabaseQuota.value)
const primaryTenantUrl = computed(() => tenants.value[0]?.Url || '')
const profileName = computed(() => currentUser.value?.Name || currentUser.value?.NickName || currentUser.value?.Account || 'Microi吾码')
const profileInitial = computed(() => String(profileName.value || 'M').trim().slice(0, 1).toUpperCase())
const profileAvatarUrl = computed(() => normalizeAvatarUrl(currentUser.value?.Avatar || currentUser.value?.HeadImgUrl || currentUser.value?.HeadImg || currentUser.value?.AvatarUrl))
const profileDraftAvatarUrl = computed(() => profileDraftPreview.value || normalizeAvatarUrl(profileDraftAvatar.value) || profileAvatarUrl.value)
const avatarStyles = computed(() => locale.value === 'en-US'
  ? [{ key: 'professional', label: 'Professional' }, { key: 'anime', label: 'Anime' }, { key: '3d', label: '3D' }, { key: 'watercolor', label: 'Watercolor' }]
  : [{ key: 'professional', label: '专业肖像' }, { key: 'anime', label: '动漫插画' }, { key: '3d', label: '3D 角色' }, { key: 'watercolor', label: '水彩艺术' }])
const licenseInfo = computed(() => {
  const raw = String(currentUser.value?.LicenseType || tenantCenter.value?.LicenseType || tenantCenter.value?.SysConfig?.LicenseType || '').trim().toLowerCase()
  if (raw === 'personal') {
    return {
      short: t('licensePersonal'),
      title: t('licensePersonalTitle'),
      desc: t('licensePersonalDesc')
    }
  }
  if (raw === 'enterprise') {
    return {
      short: t('licenseEnterprise'),
      title: t('licenseEnterpriseTitle'),
      desc: t('licenseEnterpriseDesc')
    }
  }
  return {
    short: t('licenseOpen'),
    title: t('licenseOpen'),
    desc: t('licenseOpenDesc')
  }
})
const licenseShortText = computed(() => licenseInfo.value.short)
const licenseDisplayTitle = computed(() => licenseInfo.value.title)
const licenseDisplayDesc = computed(() => licenseInfo.value.desc)
const pageTitle = computed(() => {
  const map = {
    overview: t('overview'),
    create: t('createTenant'),
    ai: t('aiRelay'),
    account: t('account')
  }
  return map[activeMenu.value] || t('overview')
})
const pageDesc = computed(() => {
  if (!isAuthed.value) return t('loginPageDesc')
  if (activeMenu.value === 'create') return t('createPageDesc')
  return t('pageDesc', { name: profileName.value })
})
const aiSummaryLabels = computed(() => ({ title: t('aiTitle'), desc: t('aiDesc'), copy: t('copyApiKey'), apiBase: t('apiBase'), apiKey: t('apiKey'), generating: t('generating'), total: t('totalToken'), used: t('usedToken'), remaining: t('remainingToken') }))
const tenantStepSummary = computed(() => {
  const errorStep = tenantSteps.value.find(step => step.Status === 'error')
  if (errorStep) return t('failedStep', { title: errorStep.Title, detail: errorStep.Detail })
  const runningStep = tenantSteps.value.find(step => step.Status === 'running')
  if (runningStep) {
    const index = tenantSteps.value.findIndex(step => step.Key === runningStep.Key) + 1
    return t('runningStep', { index, count: tenantSteps.value.length, title: runningStep.Title, seconds: formatStepElapsed(runningStep) })
  }
  const doneCount = tenantSteps.value.filter(step => step.Status === 'done').length
  if (doneCount === tenantSteps.value.length) return t('allDone')
  return t('preparingSteps', { count: tenantSteps.value.length })
})

const TenantList = defineComponent({
  props: { tenants: { type: Array, default: () => [] } },
  setup(props) {
    return () => h('div', { class: 'tenant-grid' }, props.tenants.map(tenant => h('article', {
      class: 'tenant-card'
    }, [
      h('div', { class: 'tenant-card-top' }, [
        h('div', { class: 'tenant-title-block' }, [
          h('strong', tenant.ClientName || tenant.OsClient || t('unnamedTenant')),
          h('small', tenant.OsClient || '-')
        ]),
        h('span', { class: ['tenant-status', tenant.IsEnable == 1 ? 'enabled' : 'disabled'] }, tenant.IsEnable == 1 ? t('enabled') : t('disabled'))
      ]),
      h('div', { class: 'tenant-domain' }, [
        h('span', t('accessEntry')),
        h('a', { href: tenant.Url, target: '_blank', rel: 'noopener noreferrer' }, tenant.DomainName || tenant.Url || '-')
      ]),
      h('div', { class: 'tenant-password-tip' }, [
        h('span', t('defaultAdmin')),
        h('b', tenant.AdminDefaultPassword ? `admin / ${tenant.AdminDefaultPassword}` : 'admin'),
        h('small', tenant.AdminDefaultPassword ? t('changePassword') : t('initialPasswordHidden'))
      ]),
      h('div', { class: 'tenant-card-actions' }, [
        h('a', {
          class: 'tenant-open',
          href: tenant.Url,
          target: '_blank',
          rel: 'noopener noreferrer'
        }, t('enterBackend')),
        h('button', {
          class: 'tenant-copy',
          type: 'button',
          onClick: () => copyTenantUrl(tenant.Url)
        }, t('copyLink'))
      ])
    ])))
  }
})

const EmptyTenants = defineComponent({
  emits: ['create'],
  setup(_, { emit }) {
    return () => h('div', { class: 'empty-card' }, [
      h('h3', t('noTenants')),
      h('p', t('noTenantsDesc')),
      h('button', { class: 'primary-action small', type: 'button', onClick: () => emit('create') }, t('createFreeTenant'))
    ])
  }
})

async function copyTenantUrl(url) {
  if (!url) return
  const copied = await copyTextValue(url)
  showProfileNotice(copied ? 'success' : 'error', copied ? t('copySuccess') : t('copyFailed'))
}

function normalizeProfileRoute(raw) {
  const key = String(raw || '').replace(/^#\/?/, '').split('?')[0] || 'overview'
  return routeAliases[key] || (menuKeys.includes(key) ? key : 'overview')
}

function normalizeAvatarUrl(value) {
  const url = String(value || '').trim()
  if (!url) return ''
  if (/^(https?:|data:|blob:)/i.test(url)) return url
  if (url.startsWith('//')) return `https:${url}`
  if (url.startsWith('/')) return `${API_BASE}${url}`
  return `${API_BASE}/${url.replace(/^\.?\//, '')}`
}

function syncProfileDraft() {
  profileDraftName.value = String(currentUser.value?.Name || currentUser.value?.NickName || currentUser.value?.Account || '').trim()
  profileDraftAvatar.value = String(currentUser.value?.Avatar || currentUser.value?.HeadImgUrl || currentUser.value?.HeadImg || currentUser.value?.AvatarUrl || '').trim()
  profileDraftPreview.value = ''
}

async function uploadProfileAvatar(file) {
  if (!file || !/^image\/(png|jpe?g|webp)$/i.test(file.type || '')) throw new Error(t('avatarTypeError'))
  if (Number(file.size || 0) > 5 * 1024 * 1024) throw new Error(t('avatarSizeError'))
  isUploadingAvatar.value = true
  try {
    const form = new FormData()
    form.append('file', file, file.name || `avatar-${Date.now()}.jpg`)
    form.append('Path', 'member/avatar')
    form.append('Limit', 'false')
    form.append('Preview', 'true')
    form.append('OsClient', OS_CLIENT)
    const response = await authenticatedFetch(`${API_BASE}/api/HDFS/Upload?OsClient=${OS_CLIENT}`, { method: 'POST', body: form })
    const result = await response.json()
    if (!response.ok || Number(result?.Code) !== 1) throw new Error(result?.Msg || t('avatarUploadFailed'))
    const path = String(result?.Data?.Path || result?.Data?.FilePathName || '').trim()
    if (!path) throw new Error(t('avatarUploadFailed'))
    profileDraftAvatar.value = path
    profileDraftPreview.value = normalizeAvatarUrl(path)
    return path
  } finally {
    isUploadingAvatar.value = false
  }
}

async function handleAvatarFileChange(event) {
  const file = event?.target?.files?.[0]
  if (event?.target) event.target.value = ''
  if (!file) return
  try {
    await uploadProfileAvatar(file)
    showProfileNotice('success', t('avatarUploaded'))
  } catch (error) {
    showProfileNotice('error', error?.message || t('avatarUploadFailed'))
  }
}

function avatarStylePrompt() {
  const map = {
    professional: locale.value === 'en-US' ? 'professional studio portrait, clean background, friendly, premium profile avatar' : '专业影棚肖像，干净背景，亲和自然，高级感头像',
    anime: locale.value === 'en-US' ? 'refined anime illustration, expressive eyes, clean line art, profile avatar' : '精致动漫插画，灵动眼神，干净线稿，头像构图',
    '3d': locale.value === 'en-US' ? 'premium 3D character render, soft lighting, polished profile avatar' : '高级 3D 角色渲染，柔和光照，精致头像',
    watercolor: locale.value === 'en-US' ? 'artistic watercolor portrait, elegant brushwork, clean profile avatar' : '艺术水彩肖像，优雅笔触，干净头像构图'
  }
  return map[avatarStyle.value] || map.professional
}

async function generateAvatarCandidates() {
  const prompt = avatarPrompt.value.trim()
  if (prompt.length < 4 || isGeneratingAvatar.value) return
  isGeneratingAvatar.value = true
  avatarGeneratorError.value = ''
  avatarCandidates.value = []
  selectedAvatarCandidate.value = ''
  try {
    const response = await authenticatedFetch(`${API_BASE}/api/Ai/GenerateProfileAvatar?OsClient=${OS_CLIENT}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Prompt: `${prompt}。${avatarStylePrompt()}。正方形单人头像，不要文字，不要水印。`, Count: 4 })
    })
    const result = await response.json()
    if (!response.ok || Number(result?.Code) !== 1) throw new Error(result?.Msg || t('avatarGenerateFailed'))
    avatarCandidates.value = (Array.isArray(result?.Data?.Images) ? result.Data.Images : [])
      .filter(Boolean).map(value => `data:image/jpeg;base64,${value}`)
    selectedAvatarCandidate.value = avatarCandidates.value[0] || ''
    if (!avatarCandidates.value.length) throw new Error(t('avatarGenerateFailed'))
  } catch (error) {
    avatarGeneratorError.value = error?.message || t('avatarGenerateFailed')
  } finally {
    isGeneratingAvatar.value = false
  }
}

function closeAvatarGenerator() {
  if (isGeneratingAvatar.value || isUploadingAvatar.value) return
  showAvatarGenerator.value = false
  avatarGeneratorError.value = ''
}

async function useGeneratedAvatar() {
  if (!selectedAvatarCandidate.value) return
  try {
    const blob = await (await fetch(selectedAvatarCandidate.value)).blob()
    await uploadProfileAvatar(new File([blob], `microi-ai-avatar-${Date.now()}.jpg`, { type: 'image/jpeg' }))
    showAvatarGenerator.value = false
    await saveProfile()
  } catch (error) {
    avatarGeneratorError.value = error?.message || t('avatarUploadFailed')
  }
}

async function saveProfile() {
  const name = profileDraftName.value.trim()
  if (!name || name.length > 50 || isSavingProfile.value) {
    if (!name || name.length > 50) showProfileNotice('error', t('nicknameInvalid'))
    return
  }
  isSavingProfile.value = true
  try {
    const response = await authenticatedFetch(`${API_BASE}/api/SysUser/UpdateCurrentProfile?OsClient=${OS_CLIENT}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Name: name, Avatar: profileDraftAvatar.value })
    })
    const result = await response.json()
    if (!response.ok || Number(result?.Code) !== 1) throw new Error(result?.Msg || t('profileSaveFailed'))
    currentUser.value = result.Data || { ...currentUser.value, Name: name, Avatar: profileDraftAvatar.value }
    localStorage.setItem('microi_doc_user', JSON.stringify(currentUser.value))
    syncProfileDraft()
    window.dispatchEvent(new CustomEvent('microi-login-success'))
    showProfileNotice('success', t('profileSaved'))
  } catch (error) {
    showProfileNotice('error', error?.message || t('profileSaveFailed'))
  } finally {
    isSavingProfile.value = false
  }
}

function syncMenuFromHash() {
  if (typeof window === 'undefined') return
  const nextKey = normalizeProfileRoute(window.location.hash)
  activeMenu.value = nextKey
  if (nextKey === 'create') {
    restoreActiveTenantProgress()
  } else if (tenantProgressTimer) {
    stopTenantProgress()
    isCreating.value = false
  }
}

function navigateProfile(key) {
  const nextKey = normalizeProfileRoute(key)
  activeMenu.value = nextKey
  if (typeof window !== 'undefined') {
    const nextHash = `#/${nextKey}`
    if (window.location.hash !== nextHash) {
      window.history.pushState(null, '', nextHash)
    }
  }
  if (nextKey === 'create') {
    restoreActiveTenantProgress()
  } else if (tenantProgressTimer) {
    stopTenantProgress()
    isCreating.value = false
  }
}

function normalizeToken(raw) {
  return (raw || '').replace(/^Bearer\s+/i, '').trim()
}

function apiEngineUrl(key) {
  return `${API_BASE}/apiengine/${key}?OsClient=${OS_CLIENT}`
}

function authHeaders() {
  return authToken.value ? { authorization: `Bearer ${authToken.value}`, Token: authToken.value } : {}
}

function syncAuthTokenFromResponse(response) {
  const nextToken = normalizeToken(response?.headers?.get?.('authorization'))
  if (!nextToken || nextToken === authToken.value) return
  authToken.value = nextToken
  localStorage.setItem('microi_doc_token', nextToken)
  window.dispatchEvent(new CustomEvent('microi-token-refreshed'))
}

async function authenticatedFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), ...authHeaders() }
  })
  syncAuthTokenFromResponse(response)
  return response
}

function handleAiTokenRefreshed(token) {
  const nextToken = normalizeToken(token)
  if (!nextToken || nextToken === authToken.value) return
  authToken.value = nextToken
  localStorage.setItem('microi_doc_token', nextToken)
  window.dispatchEvent(new CustomEvent('microi-token-refreshed'))
}

async function refreshAiAfterChat() {
  await Promise.all([refreshRelayTokenSummary(), refreshAiUsage(aiUsagePageIndex.value)])
}

function formatTokenNumber(value) {
  const num = Number(value || 0)
  return Number.isFinite(num) ? num.toLocaleString(locale.value) : '0'
}

function createTenantSteps() {
  return tenantStepMessages[locale.value].map(([Key, Title, Detail]) => ({ Key, Title, Detail, Status: 'pending' }))
}

tenantSteps.value = createTenantSteps()

function createTraceId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '')
  }
  return `${Date.now()}${Math.floor(Math.random() * 100000)}`
}

function parseStepTimeMs(step, msField, timeField) {
  const ms = Number(step?.[msField] || 0)
  if (ms > 0) return ms
  const raw = step?.[timeField]
  if (!raw) return 0
  const parsed = Date.parse(String(raw).replace(/-/g, '/'))
  return Number.isNaN(parsed) ? 0 : parsed
}

function getStepElapsedMs(step) {
  const tick = tenantProgressTick.value
  if (!step) return 0
  const startMs = step.StartAt || parseStepTimeMs(step, 'StartMs', 'StartTime')
  if (step.Status === 'running' && startMs) {
    return Math.max(0, tick - startMs)
  }
  const endMs = step.EndAt || parseStepTimeMs(step, 'EndMs', 'EndTime')
  if (startMs && endMs) return Math.max(0, endMs - startMs)
  return Math.max(0, Number(step.ElapsedMs || 0))
}

function formatStepElapsed(step) {
  return (Math.round(getStepElapsedMs(step) / 100) / 10).toFixed(1)
}

function stepElapsedText(step) {
  if (!step || step.Status === 'pending') return t('waiting')
  if (step.Status === 'skipped') return t('skipped')
  return t('elapsed', { seconds: formatStepElapsed(step) })
}

function restoreSession() {
  authToken.value = normalizeToken(localStorage.getItem('microi_doc_token'))
  const userRaw = localStorage.getItem('microi_doc_user')
  try {
    currentUser.value = userRaw ? JSON.parse(userRaw) : null
  } catch {
    currentUser.value = null
  }
  syncProfileDraft()
}

function isSessionExpiredResult(result) {
  const code = Number(result?.Code ?? result?.code ?? 0)
  const message = String(result?.Msg || result?.msg || '')
  return code === 1001 || code === 1002 || /登录身份已过期|请重新登录|token.*(expired|invalid)|session.*expired/i.test(message)
}

function clearSession() {
  localStorage.removeItem('microi_doc_user')
  localStorage.removeItem('microi_doc_token')
  localStorage.removeItem('microi_doc_tenant')
  localStorage.removeItem('microi_doc_tenant_url')
  localStorage.removeItem('microi_doc_phone')
  tenantBootstrapCredentials.clear()
  tenantCredentialDeliveryIds.clear()
  authToken.value = ''
  currentUser.value = null
  tenants.value = []
  tenantCenter.value = {}
  window.dispatchEvent(new CustomEvent('microi-auth-expired'))
  openClawAuthBridge?.notify()
}

function handleSessionExpired() {
  clearSession()
  profileError.value = ''
  if (isOpenClawBridgeMode()) return
  const redirect = '/profile.html' + (window.location.hash || '#/overview')
  window.location.replace(`/login.html?redirect=${encodeURIComponent(redirect)}&reason=expired`)
}

function purgeTenantBootstrapCredentials() {
  const now = Date.now()
  const ownerUserId = currentProfileUserId()
  for (const [key, credential] of tenantBootstrapCredentials.entries()) {
    if (!ownerUserId || credential.OwnerUserId !== ownerUserId || credential.ExpiresAt <= now) {
      tenantBootstrapCredentials.delete(key)
    }
  }
}

function rememberTenantBootstrapCredential(osClient, password, taskId) {
  const tenant = String(osClient || '').trim()
  const secret = String(password || '').trim()
  const ownerUserId = currentProfileUserId()
  if (!tenant || !secret || !ownerUserId) return
  purgeTenantBootstrapCredentials()
  tenantBootstrapCredentials.set(`${ownerUserId}:${tenant.toLowerCase()}`, {
    OwnerUserId: ownerUserId,
    TaskId: String(taskId || '').trim(),
    Password: secret,
    ExpiresAt: Date.now() + TENANT_BOOTSTRAP_CREDENTIAL_TTL_MS
  })
}

function mergeTenantBootstrapCredentials(list) {
  purgeTenantBootstrapCredentials()
  const ownerUserId = currentProfileUserId()
  return list.map(tenant => {
    const osClient = String(tenant?.OsClient || '').trim().toLowerCase()
    const credential = osClient ? tenantBootstrapCredentials.get(`${ownerUserId}:${osClient}`) : null
    const password = String(credential?.Password || '').trim()
    return password ? { ...tenant, AdminDefaultPassword: password } : { ...tenant, AdminDefaultPassword: '' }
  })
}

function getTenantCredentialDeliveryId(traceId) {
  const ownerUserId = currentProfileUserId()
  const taskId = String(traceId || '').trim()
  if (!ownerUserId || !taskId) return ''
  const key = `${ownerUserId}:${taskId}`
  if (!tenantCredentialDeliveryIds.has(key)) {
    tenantCredentialDeliveryIds.set(key, createTraceId())
  }
  return tenantCredentialDeliveryIds.get(key)
}

async function acknowledgeTenantBootstrapCredential(traceId, deliveryId) {
  if (!traceId || !deliveryId) return
  try {
    await authenticatedFetch(apiEngineUrl('official_create_tenant_progress'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        TraceId: traceId,
        CredentialDeliveryId: deliveryId,
        AcknowledgeCredential: 1,
        _Lang: locale.value
      })
    })
  } catch {
    // 未确认时服务端凭据仍只保留短 TTL；不影响租户创建结果。
  }
}

async function refreshCenter() {
  if (!isAuthed.value) return
  isLoading.value = true
  profileError.value = ''
  try {
    const resp = await authenticatedFetch(apiEngineUrl('official_tenant_center'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ OsClient: OS_CLIENT })
    })
    const result = await resp.json()
    if (result.Code !== 1) {
      if (isSessionExpiredResult(result)) {
        handleSessionExpired()
        return false
      }
      profileError.value = localizeServerMessage(result.Msg) || t('tenantReadFailed')
      return false
    }
    tenantCenter.value = result.Data || {}
    tenants.value = mergeTenantBootstrapCredentials(Array.isArray(result.Data?.Tenants) ? result.Data.Tenants : [])
    if (tenants.value[0]) {
      localStorage.setItem('microi_doc_tenant', tenants.value[0].OsClient || '')
      localStorage.setItem('microi_doc_tenant_url', tenants.value[0].Url || '')
    }
    await Promise.all([refreshRelayTokenSummary(), refreshAiApiKey(), refreshAiUsage(), refreshRechargeLogs()])
    return true
  } catch {
    profileError.value = t('networkFailed')
    return false
  } finally {
    isLoading.value = false
  }
}

async function refreshRelayTokenSummary() {
  if (!isAuthed.value) return
  try {
    const resp = await authenticatedFetch(`${API_BASE}/api/Ai/RelayTokenSummary?OsClient=${OS_CLIENT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ OsClient: OS_CLIENT })
    })
    const result = await resp.json()
    if (isSessionExpiredResult(result)) {
      handleSessionExpired()
      return
    }
    if (result.Code === 1 && result.Data) {
      relayToken.value = {
        GiftTokens: Number(result.Data.GiftTokens || 100000),
        UsedTokens: Number(result.Data.UsedTokens || 0),
        RemainingTokens: Number(result.Data.RemainingTokens || 0)
      }
      openClawAuthBridge?.notify()
    }
  } catch {
    // Token 统计不阻塞个人中心主流程。
  }
}

async function refreshAiApiKey() {
  try {
    const resp = await authenticatedFetch(`${API_BASE}/api/Ai/GetUserAiApiKey?OsClient=${OS_CLIENT}`, { method: 'POST' })
    const result = await resp.json()
    if (isSessionExpiredResult(result)) {
      handleSessionExpired()
      return
    }
    if (result.Code === 1 && result.Data) {
      aiApiKey.value = result.Data.AiApiKey || ''
      aiApiEndpoint.value = result.Data.Endpoint || 'https://api.itdos.com/v1'
    } else if (result.Msg) {
      profileError.value = localizeServerMessage(result.Msg)
    }
  } catch (error) {
    profileError.value = error?.message || t('networkFailed')
  }
}

async function refreshAiUsage(pageIndex = aiUsagePageIndex.value) {
  aiUsageLoading.value = true
  try {
    const resp = await authenticatedFetch(apiEngineUrl('official_ai_usage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ PageIndex: pageIndex, PageSize: aiUsagePageSize.value })
    })
    const result = await resp.json()
    if (isSessionExpiredResult(result)) {
      handleSessionExpired()
      return
    }
    if (result.Code === 1 && result.Data) {
      relayToken.value = {
        GiftTokens: Number(result.Data.GiftTokens || 100000),
        UsedTokens: Number(result.Data.UsedTokens || 0),
        RemainingTokens: Number(result.Data.RemainingTokens || 0)
      }
      openClawAuthBridge?.notify()
      relayUsageLogs.value = Array.isArray(result.Data.Logs) ? result.Data.Logs : []
      aiUsagePageIndex.value = Number(result.Data.PageIndex || pageIndex || 1)
      aiUsagePageSize.value = Number(result.Data.PageSize || aiUsagePageSize.value)
      aiUsageTotal.value = Number(result.Data.TotalCount || 0)
    }
  } catch {
    relayUsageLogs.value = []
  } finally {
    aiUsageLoading.value = false
  }
}

function goAiUsagePage(pageIndex) {
  const target = Math.min(Math.max(1, Number(pageIndex || 1)), aiUsageTotalPages.value)
  if (target === aiUsagePageIndex.value && relayUsageLogs.value.length) return
  refreshAiUsage(target)
}

function changeAiUsagePageSize() {
  aiUsagePageIndex.value = 1
  refreshAiUsage(1)
}

async function refreshRechargeLogs(pageIndex = rechargePageIndex.value) {
  rechargeLoading.value = true
  try {
    const resp = await authenticatedFetch(apiEngineUrl('official_ai_usage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ RecordType: 'Recharge', PageIndex: pageIndex, PageSize: rechargePageSize.value })
    })
    const result = await resp.json()
    if (isSessionExpiredResult(result)) {
      handleSessionExpired()
      return
    }
    if (result.Code === 1 && result.Data) {
      rechargeLogs.value = Array.isArray(result.Data.RechargeLogs) ? result.Data.RechargeLogs : []
      rechargePageIndex.value = Number(result.Data.PageIndex || pageIndex || 1)
      rechargePageSize.value = Number(result.Data.PageSize || rechargePageSize.value)
      rechargeTotal.value = Number(result.Data.TotalCount || 0)
    }
  } catch {
    rechargeLogs.value = []
  } finally {
    rechargeLoading.value = false
  }
}

function goRechargePage(pageIndex) {
  const target = Math.min(Math.max(1, Number(pageIndex || 1)), rechargeTotalPages.value)
  if (target === rechargePageIndex.value && rechargeLogs.value.length) return
  refreshRechargeLogs(target)
}

function changeRechargePageSize() {
  rechargePageIndex.value = 1
  refreshRechargeLogs(1)
}

function rechargeTypeText(value) {
  const type = String(value || '').toLowerCase()
  if (type === 'online') return t('onlineRecharge')
  if (type === 'adjustment') return t('tokenAdjustment')
  return t('manualRecharge')
}

function rechargeStatusText(value) {
  const status = String(value || '').toLowerCase()
  if (status === 'success') return t('rechargeSuccess')
  if (status === 'refunded') return t('rechargeRefunded')
  return value || '-'
}

function formatSignedToken(value) {
  const amount = Number(value || 0)
  return `${amount > 0 ? '+' : ''}${formatTokenNumber(amount)}`
}

async function copyAiApiKey() {
  if (!aiApiKey.value) return
  const copied = await copyTextValue(aiApiKey.value)
  showProfileNotice(copied ? 'success' : 'error', copied ? t('copySuccess') : t('copyFailed'))
}

async function copyTextValue(value) {
  if (!value || typeof document === 'undefined') return false
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      return true
    }
  } catch {}
  const input = document.createElement('textarea')
  input.value = value
  input.setAttribute('readonly', '')
  input.style.position = 'fixed'
  input.style.opacity = '0'
  document.body.appendChild(input)
  input.select()
  let copied = false
  try { copied = document.execCommand('copy') } catch {}
  input.remove()
  return copied
}

function showProfileNotice(type, message) {
  profileNotice.value = { type, message }
  if (profileNoticeTimer) clearTimeout(profileNoticeTimer)
  profileNoticeTimer = setTimeout(() => { profileNotice.value = null }, 2600)
}

function localizeServerMessage(message) {
  const text = String(message || '').trim()
  if (/登录身份已过期|token.*(expired|invalid)|session.*expired/i.test(text)) return t('sessionExpired')
  return text
}

function validateTenantCreation() {
  createError.value = ''
  tenantProgress.value = ''
  if (isCreating.value || isCheckingGiteeStar.value || isStartingGiteeOAuth.value || !canCreateFreeTenant.value) return false
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(tenantKey.value)) {
    createError.value = t('invalidTenantKey')
    return false
  }
  if (!systemName.value) {
    createError.value = t('enterSystemName')
    return false
  }
  return true
}

async function requestTenantCreation() {
  if (!validateTenantCreation()) return
  giteeStarError.value = ''
  isCheckingGiteeStar.value = true
  let createImmediately = false
  try {
    const resp = await authenticatedFetch(apiEngineUrl('official_gitee_star_status'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ TenantKey: tenantKey.value, _Lang: locale.value })
    })
    const result = await resp.json()
    if (isSessionExpiredResult(result)) {
      handleSessionExpired()
      return
    }
    if (result.Code !== 1) {
      createError.value = localizeServerMessage(result.Msg) || t('giteeStarStatusFailed')
      return
    }

    const data = result.Data || {}
    const starRequired = data.Required === true || data.Required === 1 || String(data.Required || '') === '1'
    if (!starRequired || isVerifiedGiteeStar(data)) {
      createImmediately = true
    } else {
      showStarReminder.value = true
      await nextTick()
      starContinueButton.value?.focus()
    }
  } catch {
    createError.value = t('giteeStarStatusFailed')
  } finally {
    isCheckingGiteeStar.value = false
  }

  if (createImmediately) await createTenant()
}

async function closeStarReminder() {
  if (isStartingGiteeOAuth.value) return
  showStarReminder.value = false
  giteeStarError.value = ''
  await nextTick()
  createSubmitButton.value?.focus()
}

function currentProfileUserId() {
  return String(currentUser.value?.Id || currentUser.value?.UserId || currentUser.value?.id || '').trim()
}

function saveGiteeStarTenantDraft() {
  const userId = currentProfileUserId()
  if (!userId || typeof window === 'undefined') return false
  window.sessionStorage.setItem(GITEE_STAR_DRAFT_KEY, JSON.stringify({
    UserId: userId,
    TenantKey: tenantKey.value,
    SystemName: systemName.value,
    ExpiresAt: Date.now() + GITEE_STAR_DRAFT_TTL_MS
  }))
  return true
}

function consumeGiteeStarTenantDraft() {
  if (typeof window === 'undefined') return null
  const raw = window.sessionStorage.getItem(GITEE_STAR_DRAFT_KEY)
  if (!raw) return null
  try {
    const draft = JSON.parse(raw)
    const valid = String(draft?.UserId || '') === currentProfileUserId()
      && Number(draft?.ExpiresAt || 0) > Date.now()
      && /^[A-Za-z][A-Za-z0-9_-]*$/.test(String(draft?.TenantKey || ''))
      && !!String(draft?.SystemName || '').trim()
    if (!valid) {
      window.sessionStorage.removeItem(GITEE_STAR_DRAFT_KEY)
      return null
    }
    window.sessionStorage.removeItem(GITEE_STAR_DRAFT_KEY)
    return draft
  } catch {
    window.sessionStorage.removeItem(GITEE_STAR_DRAFT_KEY)
    return null
  }
}

function isTrustedGiteeAuthorizeUrl(value) {
  try {
    const url = new URL(String(value || ''))
    return url.protocol === 'https:' && url.hostname === 'gitee.com' && url.pathname === '/oauth/authorize'
  } catch {
    return false
  }
}

async function beginGiteeStarOAuth() {
  if (isStartingGiteeOAuth.value || isCheckingGiteeStar.value || isCreating.value) return
  if (!validateTenantCreation()) {
    showStarReminder.value = false
    return
  }
  if (!saveGiteeStarTenantDraft()) {
    giteeStarError.value = t('giteeUserMissing')
    return
  }

  isStartingGiteeOAuth.value = true
  giteeStarError.value = ''
  try {
    const resp = await authenticatedFetch(apiEngineUrl('official_gitee_star_oauth_start'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ReturnUrl: `${window.location.origin}/profile.html#/create`,
        TenantKey: tenantKey.value,
        _Lang: locale.value
      })
    })
    const result = await resp.json()
    if (isSessionExpiredResult(result)) {
      handleSessionExpired()
      return
    }
    const authorizeUrl = result.Data?.AuthorizeUrl || result.Data?.AuthorizationUrl || ''
    if (result.Code !== 1 || !isTrustedGiteeAuthorizeUrl(authorizeUrl)) {
      giteeStarError.value = localizeServerMessage(result.Msg) || t('giteeOAuthStartFailed')
      return
    }
    window.location.assign(authorizeUrl)
  } catch {
    giteeStarError.value = t('giteeOAuthNetworkFailed')
  } finally {
    isStartingGiteeOAuth.value = false
  }
}

function isGiteeStarReturn() {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('giteeStar') === 'returned'
}

function readGiteeStarReturnContext() {
  if (typeof window === 'undefined') return { reason: '', account: '' }
  const params = new URLSearchParams(window.location.search)
  return {
    reason: String(params.get('reason') || '').trim(),
    account: String(params.get('giteeAccount') || '').trim()
  }
}

function cleanGiteeStarReturnQuery() {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.delete('giteeStar')
  url.searchParams.delete('giteeStarStatus')
  url.searchParams.delete('reason')
  url.searchParams.delete('giteeAccount')
  const search = url.searchParams.toString()
  window.history.replaceState(null, '', `${url.pathname}${search ? `?${search}` : ''}${url.hash || '#/create'}`)
}

function isVerifiedGiteeStar(data) {
  const value = data?.Verified ?? data?.StarVerified ?? data?.GiteeStarVerified ?? data?.IsVerified
  return value === true || value === 1 || String(value || '') === '1'
}

async function handleGiteeStarReturn() {
  if (isCheckingGiteeStar.value || isCreating.value) return
  const returnContext = readGiteeStarReturnContext()
  cleanGiteeStarReturnQuery()
  navigateProfile('create')
  const draft = consumeGiteeStarTenantDraft()
  if (!draft) {
    createError.value = t('giteeDraftExpired')
    tenantProgress.value = createError.value
    return
  }
  tenantKey.value = draft.TenantKey
  systemName.value = draft.SystemName
  isCheckingGiteeStar.value = true
  createError.value = ''
  tenantProgress.value = t('giteeStarChecking')
  try {
    const resp = await authenticatedFetch(apiEngineUrl('official_gitee_star_status'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ TenantKey: draft.TenantKey, _Lang: locale.value })
    })
    const result = await resp.json()
    if (isSessionExpiredResult(result)) {
      handleSessionExpired()
      return
    }
    const starData = result.Data || {}
    if (result.Code !== 1 || !isVerifiedGiteeStar(starData)) {
      const transientReasons = ['events_request_failed', 'events_response_invalid', 'events_temporarily_unavailable', 'star_page_temporarily_unavailable', 'star_page_response_invalid', 'star_page_limit_reached']
      const fallbackMessage = transientReasons.includes(returnContext.reason)
        ? t('giteeStarStatusFailed')
        : t('giteeStarNotVerified', {
            account: returnContext.account || starData.GiteeLogin || '（未识别）',
            repository: starData.Repository || 'ITdos/microi.net'
          })
      createError.value = localizeServerMessage(result.Msg) || fallbackMessage
      tenantProgress.value = createError.value
      return
    }
    tenantProgress.value = t('giteeStarVerified')
  } catch {
    createError.value = t('giteeStarStatusFailed')
    tenantProgress.value = createError.value
    return
  } finally {
    isCheckingGiteeStar.value = false
  }
  await createTenant()
}

async function createTenant() {
  if (!validateTenantCreation()) return
  isCreating.value = true
  const traceId = createTraceId()
  let keepPollingAfterRequestError = false
  startTenantProgress(traceId)
  try {
    const resp = await authenticatedFetch(`${API_BASE}/api/BackgroundTask/RunApiEngine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', osclient: OS_CLIENT },
      body: JSON.stringify({
        OsClient: OS_CLIENT,
        // 先进入兼容提交器，再由其内部调用 StopHttp=1 的 worker。这样当前已部署
        // 后端与未来支持 TrustedServerInvocation 的后端都能安全执行。
        ApiEngineKey: 'official_create_tenant',
        Title: t('createTenant'),
        Param: {
          TenantKey: tenantKey.value,
          SystemName: systemName.value,
          TraceId: traceId,
          TaskId: traceId,
          _Lang: locale.value
        },
        Options: {
          IdempotencyKey: `official-create-tenant:${currentProfileUserId()}:${traceId}`,
          // 同一租户 Key 在所有用户之间串行，避免两个账号同时抢占同名数据库。
          ConcurrencyKey: `official-create-tenant:${tenantKey.value.trim().toLowerCase()}`,
          MaxAttempts: 1,
          RetryOnFailure: false
        }
      })
    })
    const result = await resp.json()
    if (result.Code !== 1) {
      createError.value = result.Msg || t('tenantCreateFailed')
      tenantProgress.value = createError.value
      return
    }
    tenantProgress.value = result.Msg || t('taskSubmitted')
    keepPollingAfterRequestError = true
  } catch {
    keepPollingAfterRequestError = true
    createError.value = ''
    tenantProgress.value = t('connectionInterrupted')
  } finally {
    if (!keepPollingAfterRequestError) {
      stopTenantProgress()
      isCreating.value = false
    }
  }
}

function startTenantProgress(traceId, options = {}) {
  const shouldReset = options.reset !== false
  if (shouldReset) tenantSteps.value = createTenantSteps()
  tenantProgressTraceId = traceId
  tenantProgressTick.value = Date.now()
  if (shouldReset && tenantSteps.value[0]) markTenantStep(tenantSteps.value[0].Key, 'running')
  if (tenantProgressTimer) clearInterval(tenantProgressTimer)
  tenantProgressTimer = setInterval(() => {
    tenantProgressTick.value = Date.now()
    pollTenantProgress(traceId)
  }, 1000)
  pollTenantProgress(traceId)
}

function stopTenantProgress() {
  if (tenantProgressTimer) {
    clearInterval(tenantProgressTimer)
    tenantProgressTimer = null
  }
  tenantProgressTraceId = ''
}

function isActiveTenantProgressStatus(status) {
  const normalized = String(status || '').toLowerCase()
  return normalized === 'running' || normalized === 'queued' || normalized === 'pending'
}

async function restoreActiveTenantProgress() {
  if (!isAuthed.value || activeMenu.value !== 'create' || tenantProgressTimer || tenantProgressRestorePending) return
  tenantProgressRestorePending = true
  try {
    const resp = await authenticatedFetch(apiEngineUrl('official_create_tenant_progress'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ActiveOnly: 1, _Lang: locale.value })
    })
    const result = await resp.json()
    const data = result.Data || {}
    const activeTask = data.ActiveTask || data.Task || {}
    const traceId = data.TraceId || data.TaskId || activeTask.TraceId || activeTask.TaskId
    if (result.Code !== 1 || !traceId || !isActiveTenantProgressStatus(data.Status || activeTask.Status)) return

    if (!tenantKey.value && activeTask.OsClient) tenantKey.value = activeTask.OsClient
    if (!systemName.value && activeTask.SystemName) systemName.value = activeTask.SystemName
    createError.value = ''
    isCreating.value = true
    tenantProgress.value = data.Msg || t('restoredProgress')
    mergeTenantSteps(data.Steps)
    startTenantProgress(traceId, { reset: false })
  } catch {
  } finally {
    tenantProgressRestorePending = false
  }
}

function markTenantStep(key, status, detail) {
  tenantSteps.value = tenantSteps.value.map(step => {
    if (step.Key !== key) return step
    const now = Date.now()
    const next = { ...step, Status: status, Detail: detail || step.Detail }
    if (status === 'running' && !next.StartAt) next.StartAt = now
    if ((status === 'done' || status === 'error' || status === 'skipped') && !next.EndAt) {
      next.EndAt = now
      if (next.StartAt) next.ElapsedMs = now - next.StartAt
    }
    return next
  })
}

async function pollTenantProgress(traceId) {
  if (!traceId || traceId !== tenantProgressTraceId) return
  try {
    const credentialDeliveryId = getTenantCredentialDeliveryId(traceId)
    const resp = await authenticatedFetch(apiEngineUrl('official_create_tenant_progress'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ TraceId: traceId, CredentialDeliveryId: credentialDeliveryId, _Lang: locale.value })
    })
    const result = await resp.json()
    const data = result.Data || {}
    mergeTenantSteps(data.Steps)
    if (data.Status === 'success') {
      const payload = data.Data || {}
      const url = payload.Url || (payload.DomainName ? `https://${payload.DomainName}` : `https://${payload.OsClient || tenantKey.value}.microi.net`)
      rememberTenantBootstrapCredential(payload.OsClient || tenantKey.value, payload.AdminDefaultPassword, traceId)
      if (payload.AdminDefaultPassword) {
        void acknowledgeTenantBootstrapCredential(traceId, credentialDeliveryId)
      }
      localStorage.setItem('microi_doc_tenant', payload.OsClient || tenantKey.value)
      localStorage.setItem('microi_doc_tenant_url', url)
      tenantProgress.value = t('tenantCreatedAt', { url })
      tenantKey.value = ''
      systemName.value = ''
      await refreshCenter()
      navigateProfile('overview')
      stopTenantProgress()
      isCreating.value = false
      return
    }
    if (data.Status === 'error' && data.Msg) {
      tenantProgress.value = data.Msg
      createError.value = data.Msg
      stopTenantProgress()
      isCreating.value = false
    }
  } catch {
  }
}

function mergeTenantSteps(serverSteps) {
  if (!Array.isArray(serverSteps) || serverSteps.length === 0) return
  tenantSteps.value = tenantSteps.value.map((localStep, index) => {
    const serverStep = serverSteps.find(item => item.Key === localStep.Key) || serverSteps[index]
    if (!serverStep) return localStep
    return {
      ...localStep,
      Title: serverStep.Title || localStep.Title,
      Detail: serverStep.Detail || localStep.Detail,
      Status: serverStep.Status || localStep.Status,
      StartTime: serverStep.StartTime || localStep.StartTime,
      EndTime: serverStep.EndTime || localStep.EndTime,
      StartMs: serverStep.StartMs || localStep.StartMs || 0,
      EndMs: serverStep.EndMs || localStep.EndMs || 0,
      StartAt: localStep.StartAt || serverStep.StartMs || 0,
      EndAt: localStep.EndAt || serverStep.EndMs || 0,
      ElapsedMs: serverStep.ElapsedMs || localStep.ElapsedMs || 0,
      ElapsedSeconds: serverStep.ElapsedSeconds || localStep.ElapsedSeconds || 0
    }
  })
}

function logout(goLogin = true) {
  clearSession()
  if (goLogin) window.location.href = '/'
}

function onLoginSuccess() {
  restoreSession()
  refreshCenter()
}

function onTenantUpdated() {
  refreshCenter()
}

function onProfileLocaleChange(event) {
  locale.value = normalizeProfileLocale(event?.detail)
}

function redirectToLoginIfNeeded() {
  if (isAuthed.value) return false
  if (isOpenClawBridgeMode()) {
    openClawAuthBridge?.notify()
    return true
  }
  if (typeof window !== 'undefined') {
    const profileRedirect = `${window.location.pathname}${window.location.search}${window.location.hash || '#/overview'}`
    window.location.href = `/login.html?redirect=${encodeURIComponent(profileRedirect)}`
  }
  return true
}

watch(locale, (value) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem('microi_profile_locale', value)
  document.documentElement.lang = value
  const translated = createTenantSteps()
  tenantSteps.value = tenantSteps.value.map((step, index) => ({
    ...(translated.find(item => item.Key === step.Key) || translated[index] || step),
    ...step,
    Title: translated.find(item => item.Key === step.Key)?.Title || step.Title,
    Detail: translated.find(item => item.Key === step.Key)?.Detail || step.Detail
  }))
}, { immediate: true })

onMounted(async () => {
  restoreSession()
  openClawAuthBridge = createOpenClawAuthBridge(() => ({
    token: authToken.value,
    user: currentUser.value,
    quota: relayToken.value,
    apiBase: API_BASE,
    osClient: OS_CLIENT
  }))
  openClawAuthBridge.notify()
  syncMenuFromHash()
  if (redirectToLoginIfNeeded()) return
  window.addEventListener('microi-login-success', onLoginSuccess)
  window.addEventListener('microi-tenant-updated', onTenantUpdated)
  window.addEventListener('microi-profile-locale-change', onProfileLocaleChange)
  window.addEventListener('hashchange', syncMenuFromHash)
  window.addEventListener('popstate', syncMenuFromHash)
  const returnedFromGitee = isGiteeStarReturn()
  const valid = await refreshCenter()
  if (valid && returnedFromGitee) {
    await handleGiteeStarReturn()
  } else if (valid && activeMenu.value === 'create') {
    restoreActiveTenantProgress()
  }
})

onUnmounted(() => {
  openClawAuthBridge?.destroy()
  openClawAuthBridge = null
  stopTenantProgress()
  if (profileNoticeTimer) clearTimeout(profileNoticeTimer)
  window.removeEventListener('microi-login-success', onLoginSuccess)
  window.removeEventListener('microi-tenant-updated', onTenantUpdated)
  window.removeEventListener('microi-profile-locale-change', onProfileLocaleChange)
  window.removeEventListener('hashchange', syncMenuFromHash)
  window.removeEventListener('popstate', syncMenuFromHash)
})
</script>

<style scoped>
.profile-page {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 248px 1fr;
  background:
    radial-gradient(circle at 78% 8%, rgba(255, 90, 46, 0.08), transparent 30%),
    linear-gradient(180deg, #f7f9fc 0%, #eef3f8 100%);
  color: #1f2937;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans CJK SC', sans-serif;
}

.profile-sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 22px 18px;
  background: linear-gradient(180deg, #111827 0%, #1f2937 100%);
  color: #fff;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #fff;
  text-decoration: none;
  margin-bottom: 28px;
}

.brand-mark {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #ff4d2d, #ff8a3d);
  font-weight: 800;
}

.brand-avatar-img {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  object-fit: cover;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.12);
}

.brand strong,
.brand small {
  display: block;
}

.brand small {
  margin-top: 2px;
  color: rgba(255,255,255,0.58);
  font-size: 12px;
}

.side-menu {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.side-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: rgba(255,255,255,0.72);
  cursor: pointer;
  font-size: 14px;
  text-align: left;
}

.side-menu-item.active,
.side-menu-item:hover {
  background: rgba(255,255,255,0.11);
  color: #fff;
}

.menu-icon {
  width: 24px;
  text-align: center;
}

.sidebar-footer {
  margin-top: auto;
}

.sidebar-token-card {
  display: grid;
  gap: 7px;
  padding: 12px;
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 10px;
  background: rgba(255,255,255,.06);
}

.sidebar-token-card span,
.sidebar-token-card small {
  color: rgba(255,255,255,.62);
  font-size: 11px;
}

.sidebar-token-card strong {
  color: #fff;
  font-size: 18px;
  letter-spacing: -.02em;
}

.sidebar-token-track {
  height: 4px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255,255,255,.12);
}

.sidebar-token-track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #4f8cff, #62d4ff);
}

.profile-main {
  padding: 28px;
  min-width: 0;
}

.profile-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 22px;
}

.eyebrow {
  margin: 0 0 6px;
  color: #ff5a2e;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0;
}

.profile-header h1 {
  margin: 0;
  font-size: 28px;
}

.header-desc {
  margin: 8px 0 0;
  color: #64748b;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.profile-notice {
  position: fixed;
  top: 22px;
  right: 24px;
  z-index: 1000;
  padding: 11px 16px;
  border-radius: 10px;
  background: #ecfdf5;
  color: #047857;
  box-shadow: 0 14px 40px rgba(15,23,42,.16);
  font-weight: 700;
}

.profile-notice.error { background: #fef2f2; color: #b91c1c; }

.star-policy-notice {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin: -2px 0 18px;
  padding: 14px 16px;
  border: 1px solid rgba(255, 90, 46, 0.18);
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(255, 247, 237, 0.96), rgba(255, 255, 255, 0.92));
}

.star-policy-notice__icon {
  flex: 0 0 34px;
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: linear-gradient(135deg, #ff4d2d, #ff9f43);
  color: #fff;
  box-shadow: 0 8px 18px rgba(255, 90, 46, 0.2);
  font-size: 17px;
}

.star-policy-notice strong {
  display: block;
  margin: 1px 0 4px;
  color: #9a3412;
  font-size: 14px;
}

.star-policy-notice p {
  margin: 0;
  color: #7c4a32;
  font-size: 13px;
  line-height: 1.65;
}

.star-reminder-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.58);
}

.star-reminder-dialog {
  position: relative;
  width: min(100%, 520px);
  padding: 32px;
  border: 1px solid rgba(255, 90, 46, 0.18);
  border-radius: 20px;
  background:
    radial-gradient(circle at 86% 8%, rgba(255, 138, 61, 0.15), transparent 34%),
    #fff;
  color: #1f2937;
  text-align: center;
  box-shadow: 0 28px 80px rgba(15, 23, 42, 0.28);
  outline: none;
}

.star-reminder-close {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 10px;
  background: rgba(148, 163, 184, 0.12);
  color: #64748b;
  cursor: pointer;
  font-size: 22px;
  line-height: 1;
}

.star-reminder-icon {
  width: 54px;
  height: 54px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
  border-radius: 16px;
  background: linear-gradient(135deg, #ff4d2d, #ff9f43);
  color: #fff;
  box-shadow: 0 14px 30px rgba(255, 90, 46, 0.26);
  font-size: 28px;
}

.star-reminder-dialog h2 {
  margin: 0;
  color: #111827;
  font-size: 24px;
  line-height: 1.3;
}

.star-reminder-description,
.star-reminder-thanks {
  color: #64748b;
  line-height: 1.75;
}

.star-reminder-description {
  margin: 14px 0 12px;
}

.star-project-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  padding: 0 14px;
  border: 1px solid rgba(255, 90, 46, 0.2);
  border-radius: 10px;
  background: #fff7ed;
  color: #e64a19;
  font-weight: 700;
  text-decoration: none;
}

.star-reminder-thanks {
  margin: 12px 0 20px;
  color: #475569;
  font-weight: 600;
}

.star-reminder-status {
  margin: -8px 0 16px;
  padding: 10px 12px;
  border-radius: 10px;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 13px;
  line-height: 1.55;
  text-align: left;
}

.star-reminder-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.star-continue-action {
  min-height: 38px;
}

.star-continue-action:disabled,
.star-reminder-close:disabled,
.star-reminder-cancel:disabled {
  cursor: wait;
  opacity: 0.58;
}

.star-reminder-cancel {
  min-height: 36px;
  margin-top: 10px;
  padding: 0 14px;
  border: 0;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  font-weight: 600;
}

.star-reminder-close:hover,
.star-reminder-cancel:hover {
  color: #ff5a2e;
}

.primary-action,
.ghost-action,
.link-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  padding: 0 16px;
  border-radius: 10px;
  border: 0;
  cursor: pointer;
  font-weight: 700;
  text-decoration: none;
}

.primary-action {
  background: linear-gradient(135deg, #ff4d2d, #ff8a3d);
  color: #fff;
  box-shadow: 0 10px 24px rgba(255, 90, 46, 0.22);
}

.primary-action:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.primary-action.small,
.ghost-action,
.link-action {
  min-height: 34px;
  font-size: 13px;
}

.ghost-action {
  border: 1px solid #d9e1ec;
  background: #fff;
  color: #334155;
}

.ghost-action.danger {
  color: #ef4444;
}

.link-action {
  background: #fff4ed;
  color: #ff5a2e;
}

.profile-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 18px;
  align-items: stretch;
  margin-bottom: 18px;
}

.profile-hero > div,
.license-card {
  border: 1px solid #e6edf5;
  border-radius: 18px;
  background:
    radial-gradient(circle at 86% 10%, rgba(255, 90, 46, 0.11), transparent 32%),
    linear-gradient(135deg, #fff, #f8fbff);
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.06);
}

.profile-hero > div {
  padding: 24px;
}

.profile-hero h2 {
  margin: 0;
  font-size: 34px;
  line-height: 1.18;
}

.profile-hero p:not(.eyebrow) {
  margin: 10px 0 0;
  color: #64748b;
  line-height: 1.7;
}

.license-card {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 22px;
}

.license-card span {
  color: #64748b;
}

.license-card strong {
  margin: 10px 0 8px;
  color: #111827;
  font-size: 24px;
}

.license-card small {
  color: #64748b;
  line-height: 1.7;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 18px;
}

.stat-card,
.content-panel,
.state-panel {
  border: 1px solid #e6edf5;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.045);
}

.stat-card {
  padding: 18px;
}

.token-stat-card {
  background:
    radial-gradient(circle at 86% 12%, rgba(255, 90, 46, 0.16), transparent 36%),
    linear-gradient(135deg, #fff, #f7fbff);
}

.stat-card span,
.stat-card small {
  display: block;
  color: #64748b;
}

.stat-card strong {
  display: block;
  margin: 10px 0 6px;
  font-size: 26px;
}

.content-panel,
.state-panel {
  padding: 22px;
}

.content-grid {
  display: grid;
  grid-template-columns: minmax(360px, 520px) 1fr;
  gap: 18px;
  align-items: stretch;
  min-height: calc(100vh - 190px);
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 18px;
}

.panel-head h2,
.state-panel h2,
.content-panel h2 {
  margin: 0 0 6px;
  font-size: 18px;
}

.panel-head p,
.state-panel p {
  margin: 0;
  color: #64748b;
  line-height: 1.6;
}

.tenant-overview-panel {
  overflow: hidden;
}

.tenant-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.tenant-card {
  position: relative;
  display: flex;
  min-height: 220px;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 16px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.94), rgba(248, 250, 252, 0.96)),
    radial-gradient(circle at top right, rgba(255, 122, 69, 0.1), transparent 34%);
  color: inherit;
  text-decoration: none;
  min-width: 0;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.06);
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
  overflow: hidden;
}

.tenant-card::before {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: 3px;
  background: linear-gradient(90deg, #ff4d2d, #ff9f43, #38bdf8);
}

.tenant-card:hover {
  transform: translateY(-2px);
  border-color: rgba(255, 122, 69, 0.42);
  box-shadow: 0 24px 54px rgba(15, 23, 42, 0.1);
}

.tenant-card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.tenant-title-block {
  min-width: 0;
}

.tenant-title-block strong {
  display: block;
  overflow: hidden;
  font-size: 16px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tenant-title-block small {
  display: block;
  margin-top: 4px;
  color: #94a3b8;
  font-size: 13px;
  font-weight: 700;
}

.tenant-domain {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border: 1px solid #e8eef6;
  border-radius: 12px;
  background: rgba(248, 250, 252, 0.78);
}

.tenant-domain span,
.tenant-password-tip span,
.tenant-password-tip small {
  color: #64748b;
}

.tenant-domain a {
  min-width: 0;
  overflow: hidden;
  color: #2563eb;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-decoration: none;
}

.tenant-password-tip {
  display: grid;
  grid-template-columns: 68px minmax(0, 1fr);
  gap: 6px 10px;
  padding: 12px;
  border: 1px solid rgba(251, 146, 60, 0.22);
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(255, 247, 237, 0.95), rgba(255, 237, 213, 0.55));
  font-size: 12px;
}

.tenant-password-tip b {
  color: #c2410c;
}

.tenant-password-tip small {
  grid-column: 2;
  line-height: 1.5;
}

.tenant-card-actions {
  display: grid;
  grid-template-columns: 1fr 104px;
  gap: 10px;
  margin-top: auto;
}

.tenant-open,
.tenant-copy {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
}

.tenant-open {
  background: linear-gradient(135deg, #ff4d2d, #ff8a3d);
  color: #fff;
  box-shadow: 0 12px 24px rgba(255, 90, 46, 0.18);
}

.tenant-copy {
  border: 1px solid #d9e1ec;
  background: #fff;
  color: #475569;
  cursor: pointer;
}

.tenant-status {
  flex-shrink: 0;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
}

.tenant-status.enabled {
  background: #dcfce7;
  color: #15803d;
}

.tenant-status.disabled {
  background: #fee2e2;
  color: #b91c1c;
}

.profile-page :deep(.tenant-grid) {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.profile-page :deep(.tenant-card) {
  position: relative;
  display: flex;
  min-height: 220px;
  min-width: 0;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  overflow: hidden;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 16px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.94), rgba(248, 250, 252, 0.96)),
    radial-gradient(circle at top right, rgba(255, 122, 69, 0.1), transparent 34%);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.06);
}

.profile-page :deep(.tenant-card)::before {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: 3px;
  background: linear-gradient(90deg, #ff4d2d, #ff9f43, #38bdf8);
}

.profile-page :deep(.tenant-card-top),
.profile-page :deep(.tenant-card-actions),
.profile-page :deep(.tenant-domain),
.profile-page :deep(.tenant-password-tip) {
  min-width: 0;
}

.profile-page :deep(.tenant-card-top) {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.profile-page :deep(.tenant-title-block) {
  min-width: 0;
}

.profile-page :deep(.tenant-title-block strong) {
  display: block;
  overflow: hidden;
  font-size: 16px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-page :deep(.tenant-title-block small) {
  display: block;
  margin-top: 4px;
  color: #94a3b8;
  font-size: 13px;
  font-weight: 700;
}

.profile-page :deep(.tenant-domain),
.profile-page :deep(.tenant-password-tip) {
  padding: 12px;
  border-radius: 12px;
}

.profile-page :deep(.tenant-domain) {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border: 1px solid #e8eef6;
  background: rgba(248, 250, 252, 0.78);
}

.profile-page :deep(.tenant-domain a) {
  min-width: 0;
  overflow: hidden;
  color: #2563eb;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-decoration: none;
}

.profile-page :deep(.tenant-password-tip) {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 6px 10px;
  border: 1px solid rgba(251, 146, 60, 0.22);
  background: linear-gradient(135deg, rgba(255, 247, 237, 0.95), rgba(255, 237, 213, 0.55));
  font-size: 12px;
}

.profile-page :deep(.tenant-password-tip b) {
  color: #c2410c;
}

.profile-page :deep(.tenant-password-tip small) {
  grid-column: 2;
  color: #64748b;
  line-height: 1.5;
}

.profile-page :deep(.tenant-card-actions) {
  display: grid;
  grid-template-columns: 1fr 104px;
  gap: 10px;
  margin-top: auto;
}

.profile-page :deep(.tenant-open),
.profile-page :deep(.tenant-copy) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
}

.profile-page :deep(.tenant-open) {
  background: linear-gradient(135deg, #ff4d2d, #ff8a3d);
  color: #fff;
  box-shadow: 0 12px 24px rgba(255, 90, 46, 0.18);
}

.profile-page :deep(.tenant-copy) {
  border: 1px solid #d9e1ec;
  background: #fff;
  color: #475569;
  cursor: pointer;
}

.profile-page :deep(.tenant-status) {
  flex-shrink: 0;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
}

.profile-page :deep(.tenant-status.enabled) {
  background: #dcfce7;
  color: #15803d;
}

.profile-page :deep(.tenant-status.disabled) {
  background: #fee2e2;
  color: #b91c1c;
}

.billing-strip {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 18px;
}

.billing-strip > div {
  padding: 16px;
  border: 1px solid #e8eef6;
  border-radius: 14px;
  background: linear-gradient(135deg, #f8fafc, #fff);
}

.billing-strip span,
.billing-strip small {
  display: block;
  color: #64748b;
}

.billing-strip strong {
  display: block;
  margin: 6px 0;
  color: #111827;
  font-size: 20px;
}

.empty-card,
.loading-row {
  padding: 28px;
  border: 1px dashed #cbd5e1;
  border-radius: 12px;
  background: #f8fafc;
  text-align: center;
}

.empty-card h3 {
  margin: 0 0 8px;
}

.empty-card p {
  margin: 0 0 14px;
  color: #64748b;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.form-row label {
  font-weight: 800;
}

.form-row input {
  height: 42px;
  padding: 0 12px;
  border: 1px solid #d9e1ec;
  border-radius: 10px;
  outline: none;
}

.form-row input:focus {
  border-color: #ff7a45;
  box-shadow: 0 0 0 3px rgba(255, 122, 69, 0.12);
}

.form-row small {
  color: #64748b;
}

.primary-action.submit {
  width: 100%;
}

.error-box,
.page-error {
  padding: 12px;
  border-radius: 10px;
  background: #fef2f2;
  color: #dc2626;
  font-size: 13px;
}

.step-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-height: 0;
  overflow: visible;
}

.progress-panel {
  display: flex;
  flex-direction: column;
}

.step-item {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 10px;
  padding: 11px;
  border: 1px solid #edf2f7;
  border-radius: 10px;
  background: #f8fafc;
}

.step-item span {
  width: 24px;
  height: 24px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #e2e8f0;
  color: #475569;
  font-size: 12px;
  font-weight: 800;
}

.step-item strong,
.step-item em,
.step-item small {
  display: block;
}

.step-wait-notice {
  display: inline-flex;
  width: fit-content;
  margin-top: 6px;
  padding: 5px 10px;
  border: 1px solid #fb923c;
  border-radius: 999px;
  background: #ffedd5;
  color: #c2410c;
  box-shadow: 0 4px 14px rgba(234, 88, 12, 0.18);
  font-size: 12px;
  font-weight: 800;
  line-height: 1.35;
}

.step-item.running .step-wait-notice {
  animation: waitNoticePulse 1.35s ease-in-out infinite;
}

@keyframes waitNoticePulse {
  0%, 100% { transform: scale(1); box-shadow: 0 4px 14px rgba(234, 88, 12, 0.18); }
  50% { transform: scale(1.025); box-shadow: 0 6px 20px rgba(234, 88, 12, 0.34); }
}

.step-item em {
  margin-top: 3px;
  color: #f97316;
  font-size: 12px;
  font-style: normal;
  font-weight: 700;
}

.step-item small {
  margin-top: 3px;
  color: #64748b;
  line-height: 1.45;
}

.step-item.running {
  border-color: rgba(255, 122, 69, 0.4);
  background: #fff7ed;
}

.step-item.running span {
  background: #ffedd5;
  color: #ea580c;
}

.step-item.done {
  border-color: rgba(34, 197, 94, 0.36);
  background: #f0fdf4;
}

.step-item.done span {
  background: #dcfce7;
  color: #15803d;
}

.step-item.error {
  border-color: rgba(239, 68, 68, 0.38);
  background: #fef2f2;
}

.step-item.error span {
  background: #fee2e2;
  color: #dc2626;
}

.step-item.skipped {
  opacity: 0.56;
}

.price-card {
  padding: 16px;
  border: 1px solid #e8eef6;
  border-radius: 12px;
  margin-top: 12px;
}

.price-card span,
.price-card p {
  color: #64748b;
}

.price-card strong {
  display: block;
  margin: 6px 0;
  font-size: 22px;
}

.account-grid {
  display: grid;
  grid-template-columns: 90px 1fr;
  gap: 12px;
  margin: 16px 0 20px;
}

.account-grid label {
  color: #64748b;
}

.account-intro { margin: 6px 0 18px; color: #64748b; }
.account-editor { display: grid; grid-template-columns: minmax(280px,.8fr) minmax(320px,1.2fr); gap: 28px; padding: 24px; border: 1px solid #e8eef6; border-radius: 18px; background: #f8fafc; }
.avatar-editor { display: flex; align-items: center; gap: 18px; }
.avatar-editor > img, .avatar-editor > span { width: 104px; height: 104px; flex: 0 0 104px; border: 3px solid #fff; border-radius: 50%; object-fit: cover; box-shadow: 0 10px 30px rgba(15,23,42,.16); }
.avatar-editor > span { display: grid; place-items: center; background: linear-gradient(135deg,#fb923c,#f97316); color: #fff; font-size: 34px; font-weight: 800; }
.avatar-editor strong, .avatar-editor small { display: block; }
.avatar-editor small { margin-top: 5px; color: #64748b; line-height: 1.5; }
.avatar-actions, .account-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 13px; }
.account-form { display: grid; gap: 14px; }
.account-form label { display: grid; gap: 7px; color: #475569; font-size: 12px; font-weight: 700; }
.account-form input { min-height: 42px; box-sizing: border-box; padding: 0 13px; border: 1px solid #dbe2ea; border-radius: 10px; outline: none; background: #fff; color: #0f172a; font: inherit; }
.account-form input:focus { border-color: #fb923c; box-shadow: 0 0 0 3px rgba(251,146,60,.13); }
.account-form input:disabled { background: #eef2f7; color: #64748b; cursor: not-allowed; }
.avatar-generator-backdrop { position: fixed; z-index: 1002; inset: 0; display: grid; place-items: center; padding: 24px; background: rgba(2,6,23,.7); backdrop-filter: blur(12px); }
.avatar-generator-dialog { position: relative; width: min(720px,100%); max-height: calc(100vh - 48px); overflow-y: auto; box-sizing: border-box; padding: 30px; border: 1px solid rgba(251,146,60,.24); border-radius: 24px; background: #fff; box-shadow: 0 30px 90px rgba(0,0,0,.35); }
.avatar-generator-dialog h2 { margin: 8px 0; font-size: 26px; }
.avatar-generator-dialog > p:not(.eyebrow) { margin: 0 0 16px; color: #64748b; }
.avatar-generator-close { position: absolute; top: 16px; right: 16px; width: 36px; height: 36px; border: 0; border-radius: 10px; background: #f1f5f9; color: #64748b; cursor: pointer; font-size: 22px; }
.avatar-generator-mark { width: 52px; height: 52px; display: grid; place-items: center; border-radius: 16px; background: linear-gradient(135deg,#fb923c,#f97316); color: #fff; font-weight: 900; box-shadow: 0 12px 28px rgba(249,115,22,.28); }
.avatar-style-list { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.avatar-style-list button { min-height: 34px; padding: 0 13px; border: 1px solid #dbe2ea; border-radius: 999px; background: #fff; color: #475569; cursor: pointer; }
.avatar-style-list button.active { border-color: #fb923c; background: #fff7ed; color: #c2410c; }
.avatar-generator-dialog textarea { width: 100%; min-height: 84px; box-sizing: border-box; resize: vertical; padding: 12px 14px; border: 1px solid #dbe2ea; border-radius: 12px; outline: none; background: #f8fafc; color: #0f172a; font: inherit; line-height: 1.6; }
.avatar-generate-action { width: 100%; margin-top: 12px; }
.avatar-generator-error { padding: 10px 12px; border-radius: 10px; background: #fef2f2; color: #b91c1c !important; }
.avatar-candidate-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-top: 18px; }
.avatar-candidate-grid button { aspect-ratio: 1; overflow: hidden; padding: 3px; border: 2px solid transparent; border-radius: 16px; background: #eef2f7; cursor: pointer; }
.avatar-candidate-grid button.selected { border-color: #f97316; box-shadow: 0 0 0 3px rgba(249,115,22,.16); }
.avatar-candidate-grid img { width: 100%; height: 100%; border-radius: 12px; object-fit: cover; }
.avatar-generator-footer { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-top: 18px; }
.avatar-generator-footer small { color: #64748b; line-height: 1.5; }

.dark .profile-page {
  background: #0b1120;
  color: #e5e7eb;
}

.dark .profile-sidebar {
  background: linear-gradient(180deg, #030712 0%, #111827 100%);
  border-right: 1px solid rgba(148, 163, 184, 0.16);
}

.dark .profile-main {
  background: #0b1120;
}

.dark .profile-header h1,
.dark .profile-hero h2,
.dark .license-card strong,
.dark .billing-strip strong,
.dark .panel-head h2,
.dark .state-panel h2,
.dark .content-panel h2,
.dark .stat-card strong,
.dark .tenant-card strong,
.dark .price-card strong,
.dark .account-grid span,
.dark .form-row label,
.dark .step-item strong {
  color: #f8fafc;
}

.dark .header-desc,
.dark .profile-hero p:not(.eyebrow),
.dark .license-card span,
.dark .license-card small,
.dark .billing-strip span,
.dark .billing-strip small,
.dark .panel-head p,
.dark .state-panel p,
.dark .stat-card span,
.dark .stat-card small,
.dark .tenant-card small,
.dark .tenant-card em,
.dark .empty-card p,
.dark .form-row small,
.dark .account-grid label,
.dark .step-item small,
.dark .price-card span,
.dark .price-card p,
.dark .loading-row {
  color: #94a3b8;
}

.dark .stat-card,
.dark .profile-hero > div,
.dark .license-card,
.dark .billing-strip > div,
.dark .content-panel,
.dark .state-panel,
.dark .tenant-card,
.dark .empty-card,
.dark .loading-row,
.dark .price-card {
  background: #111827;
  border-color: rgba(148, 163, 184, 0.18);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.28);
}
.dark .account-editor { border-color: rgba(148,163,184,.18); background: #0f172a; }
.dark .account-form label, .dark .avatar-editor small, .dark .account-intro { color: #94a3b8; }
.dark .account-form input { border-color: rgba(148,163,184,.24); background: #111827; color: #f8fafc; }
.dark .account-form input:disabled { background: #0b1220; color: #64748b; }
.dark .avatar-generator-dialog { border-color: rgba(251,146,60,.24); background: #111827; color: #e5e7eb; }
.dark .avatar-generator-dialog > p:not(.eyebrow), .dark .avatar-generator-footer small { color: #94a3b8; }
.dark .avatar-generator-close, .dark .avatar-style-list button, .dark .avatar-generator-dialog textarea { border-color: rgba(148,163,184,.22); background: #0f172a; color: #e5e7eb; }
.dark .avatar-style-list button.active { border-color: #fb923c; background: rgba(249,115,22,.12); color: #fdba74; }

.dark .tenant-card {
  background:
    linear-gradient(180deg, #111827, #0f172a),
    radial-gradient(circle at top right, rgba(251, 146, 60, 0.14), transparent 34%);
}

.dark .profile-page :deep(.tenant-card) {
  border-color: rgba(148, 163, 184, 0.18);
  background:
    linear-gradient(180deg, #111827, #0f172a),
    radial-gradient(circle at top right, rgba(251, 146, 60, 0.14), transparent 34%);
}

.dark .profile-page :deep(.tenant-domain) {
  background: rgba(15, 23, 42, 0.72);
  border-color: rgba(148, 163, 184, 0.16);
}

.dark .profile-page :deep(.tenant-password-tip) {
  background: rgba(251, 146, 60, 0.1);
  border-color: rgba(251, 146, 60, 0.22);
}

.dark .profile-page :deep(.tenant-copy) {
  background: #0f172a;
  border-color: rgba(148, 163, 184, 0.22);
  color: #cbd5e1;
}

.dark .ghost-action {
  background: #0f172a;
  border-color: rgba(148, 163, 184, 0.22);
  color: #e2e8f0;
}

:global(.dark) .star-reminder-dialog {
  border-color: rgba(251, 146, 60, 0.24);
  background:
    radial-gradient(circle at 86% 8%, rgba(251, 146, 60, 0.14), transparent 34%),
    #111827;
  color: #e5e7eb;
}

:global(.dark) .star-policy-notice {
  border-color: rgba(251, 146, 60, 0.24);
  background: linear-gradient(135deg, rgba(124, 45, 18, 0.24), rgba(17, 24, 39, 0.72));
}

:global(.dark) .star-policy-notice strong {
  color: #fdba74;
}

:global(.dark) .star-policy-notice p {
  color: #cbd5e1;
}

:global(.dark) .star-reminder-dialog h2 {
  color: #f8fafc;
}

:global(.dark) .star-reminder-description,
:global(.dark) .star-reminder-thanks {
  color: #cbd5e1;
}

:global(.dark) .star-reminder-status {
  background: rgba(239, 68, 68, 0.12);
  color: #fca5a5;
}

:global(.dark) .star-project-link {
  border-color: rgba(251, 146, 60, 0.25);
  background: rgba(251, 146, 60, 0.1);
  color: #fb923c;
}

:global(.dark) .star-reminder-close {
  background: rgba(148, 163, 184, 0.12);
  color: #cbd5e1;
}

:global(.dark) .star-reminder-cancel {
  color: #94a3b8;
}

.dark .link-action {
  background: rgba(255, 90, 46, 0.12);
  color: #fb923c;
}

.dark .tenant-domain {
  background: rgba(15, 23, 42, 0.72);
  border-color: rgba(148, 163, 184, 0.16);
}

.dark .tenant-password-tip {
  background: rgba(251, 146, 60, 0.1);
  border-color: rgba(251, 146, 60, 0.22);
}

.dark .tenant-copy {
  background: #0f172a;
  border-color: rgba(148, 163, 184, 0.22);
  color: #cbd5e1;
}

.dark .form-row input {
  background: #0f172a;
  border-color: rgba(148, 163, 184, 0.22);
  color: #f8fafc;
}

.dark .step-item {
  background: #0f172a;
  border-color: rgba(148, 163, 184, 0.14);
}

.dark .step-item span {
  background: #1f2937;
  color: #cbd5e1;
}

.dark .step-item em {
  color: #fdba74;
}

.ai-key-box {
  display: grid;
  grid-template-columns: 100px minmax(0, 1fr);
  gap: 10px;
  margin: 18px 0;
  align-items: center;
}

.ai-key-box code {
  overflow-wrap: anywhere;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f8fafc;
}

.ai-usage-grid { margin: 16px 0; }
.usage-section-title { margin: 20px 0 10px; font-size: 16px; color: #1f2937; }
.recharge-title { margin-top: 30px; }
.usage-table-wrap { overflow: auto; }
.usage-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.usage-table th, .usage-table td { padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: left; white-space: nowrap; }
.usage-pagination { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 10px; margin-top: 14px; color: #64748b; font-size: 13px; }
.usage-pagination label { display: inline-flex; align-items: center; gap: 6px; }
.usage-pagination select, .usage-pagination button { min-height: 32px; border: 1px solid #dbe2ea; border-radius: 8px; background: #fff; color: #334155; padding: 0 10px; }
.usage-pagination button { cursor: pointer; }
.usage-pagination button:disabled { cursor: not-allowed; opacity: .45; }
.usage-pagination strong { min-width: 58px; color: #334155; text-align: center; }
.dark .ai-key-box code, .dark .usage-table { color: #e2e8f0; background: #0f172a; border-color: rgba(148,163,184,.22); }
.dark .usage-table th, .dark .usage-table td { border-color: rgba(148,163,184,.18); }
.dark .usage-pagination { color: #94a3b8; }
.dark .usage-pagination select, .dark .usage-pagination button { border-color: rgba(148,163,184,.25); background: #111827; color: #e2e8f0; }
.dark .usage-pagination strong { color: #e2e8f0; }
.dark .usage-section-title { color: #e2e8f0; }

.dark .step-item.running {
  background: rgba(251, 146, 60, 0.12);
  border-color: rgba(251, 146, 60, 0.38);
}

.dark .step-item.done {
  background: rgba(34, 197, 94, 0.1);
  border-color: rgba(34, 197, 94, 0.34);
}

.dark .step-item.error,
.dark .error-box,
.dark .page-error {
  background: rgba(239, 68, 68, 0.12);
  border-color: rgba(239, 68, 68, 0.34);
}

@media (max-width: 960px) {
  .profile-page {
    grid-template-columns: 1fr;
  }

  .profile-sidebar {
    position: relative;
    height: auto;
  }

  .side-menu {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
  }

  .overview-grid,
  .profile-hero,
  .content-grid,
  .billing-strip,
  .profile-page :deep(.tenant-grid) {
    grid-template-columns: 1fr;
  }

  .profile-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .account-editor { grid-template-columns: 1fr; padding: 18px; }
  .avatar-candidate-grid { grid-template-columns: repeat(2,1fr); }
  .avatar-generator-dialog { padding: 24px 18px; }
  .avatar-generator-footer { align-items: stretch; flex-direction: column; }

  .star-reminder-backdrop {
    padding: 16px;
  }

  .star-reminder-dialog {
    padding: 28px 20px 22px;
  }

  .star-reminder-actions {
    grid-template-columns: 1fr;
  }
}
</style>
