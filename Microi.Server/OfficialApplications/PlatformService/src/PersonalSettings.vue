<template>
  <main class="settings-page" data-mci-ui-root="microi-platform-service" :data-mci-palette="context.themePalette" :data-mci-ui-density="context.uiDensity.scale" :data-mci-corner-style="context.themeTokens.cornerStyle" :data-disable-gradient="context.themeTokens.disableGradient" :data-disable-shadow="context.themeTokens.disableShadow" :style="presentationStyle" :class="{ 'settings-page--password': passwordOnly }" :data-theme="themeMode">
    <div v-if="loading" class="settings-skeleton" aria-label="正在加载个人设置">
      <div class="sk sk-hero"></div><div class="sk sk-nav"></div><div class="sk sk-panel"></div>
    </div>

    <template v-else>
      <header v-if="!passwordOnly" class="profile-hero">
        <div class="hero-grid" aria-hidden="true"></div>
        <div class="avatar avatar--hero">
          <img v-if="heroAvatarUrl && !heroAvatarFailed" :src="heroAvatarUrl" alt="" @error="heroAvatarFailed = true" />
          <span v-else>{{ initials }}</span>
        </div>
        <div class="personal-hero-copy">
          <p class="eyebrow">账户与安全</p>
          <h1>{{ user.Name || user.Account || '个人设置' }}</h1>
          <p>{{ user.Account }} · {{ user.DeptName || '未设置部门' }}</p>
        </div>
        <div class="security-score" :title="securitySummary">
          <strong>{{ securityScore }}</strong><span>安全评分</span>
        </div>
      </header>

      <div v-if="notice.text" class="notice" :class="`notice--${notice.type}`" role="status">
        <span>{{ notice.type === 'success' ? '✓' : notice.type === 'error' ? '!' : 'i' }}</span>{{ notice.text }}
      </div>

      <div class="settings-layout">
        <nav v-if="!passwordOnly" class="settings-nav" aria-label="个人设置分类">
          <button v-for="item in tabs" :key="item.id" :class="{ active: activeTab === item.id }" @click.stop="selectTab(item.id)">
            <span class="nav-icon">{{ item.icon }}</span><span><b>{{ item.label }}</b><small>{{ item.hint }}</small></span>
          </button>
        </nav>

        <section class="settings-panel">
          <template v-if="activeTab === 'profile'">
            <div class="panel-heading"><div><span>个人资料</span><h2>让协作伙伴更容易认出你</h2></div><span class="status-chip">DiyToken 身份</span></div>
            <div class="form-grid">
              <label><span>登录账号</span><input :value="user.Account" disabled /><small>账号由管理员维护</small></label>
              <label><span>显示名称</span><input v-model.trim="profile.Name" maxlength="50" placeholder="请输入显示名称" /></label>
              <label><span>邮箱</span><input v-model.trim="profile.Email" maxlength="100" type="email" placeholder="用于业务联系，不改变登录账号" /></label>
              <label><span>手机号</span><input :value="user.Phone || '未设置'" disabled /><small>手机号属于登录认证因子，请在安全流程中修改</small></label>
              <label><span>性别</span><select v-model="profile.Sex"><option value="">未设置</option><option value="男">男</option><option value="女">女</option><option value="保密">保密</option></select></label>
              <label><span>界面语言</span><select v-model="profile.Lang"><option value="zh-CN">简体中文</option><option value="zh-TW">繁體中文</option><option value="en">English</option></select></label>
              <label><span>所属部门</span><input :value="user.DeptName || '未设置'" disabled /></label>
              <label><span>当前角色</span><input :value="roleNames" disabled /></label>
            </div>
            <div class="avatar-settings">
              <article class="avatar-setting-card">
                <div class="avatar avatar--setting">
                  <img v-if="privateAvatarUrl && !privateAvatarFailed" :src="privateAvatarUrl" alt="私有头像预览" @error="privateAvatarFailed = true" />
                  <span v-else>{{ initials }}</span>
                </div>
                <div><b>私有头像</b><p>来自 sys_user.Avatar，仅登录后通过临时授权地址显示。支持 PNG、JPG、WebP，最大 5 MB。</p></div>
                <span class="privacy-badge">私有</span>
                <div class="avatar-upload-actions">
                  <input ref="privateAvatarInput" class="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" @change="uploadPrivateAvatar" />
                  <button type="button" class="btn btn--ghost" :disabled="busy === 'private-avatar'" @click="openPrivateAvatarPicker">{{ busy === 'private-avatar' ? '上传中…' : '选择图片' }}</button>
                  <button v-if="profile.Avatar" type="button" class="text-button danger-text" @click="clearPrivateAvatar">移除</button>
                </div>
              </article>
              <article class="avatar-setting-card avatar-setting-card--public">
                <div class="avatar avatar--setting">
                  <img v-if="publicAvatarUrl && !publicAvatarFailed" :src="publicAvatarUrl" alt="公开头像预览" @error="publicAvatarFailed = true" />
                  <span v-else>{{ initials }}</span>
                </div>
                <div><b>公开头像</b><p>用于无需私有桶签名的公开身份展示。支持 PNG、JPG、WebP，最大 5 MB。</p></div>
                <div class="avatar-upload-actions">
                  <input ref="publicAvatarInput" class="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" @change="uploadPublicAvatar" />
                  <button type="button" class="btn btn--ghost" :disabled="busy === 'public-avatar'" @click="openPublicAvatarPicker">{{ busy === 'public-avatar' ? '上传中…' : '选择图片' }}</button>
                  <button v-if="profile.PublicAvatar" type="button" class="text-button danger-text" @click="clearPublicAvatar">移除</button>
                </div>
              </article>
            </div>
            <div class="panel-actions"><button class="btn btn--primary" :disabled="busy === 'profile'" @click="saveProfile">{{ busy === 'profile' ? '保存中…' : '保存资料' }}</button></div>
          </template>

          <template v-else-if="activeTab === 'security'">
            <div v-if="!passwordOnly" class="panel-heading"><div><span>安全与登录</span><h2>密码、设备生物识别与严格人脸核验</h2></div><span class="status-chip status-chip--secure">端到端挑战</span></div>
            <div v-if="!passwordOnly" class="security-grid">
              <article class="security-card" :class="{ enabled: capabilities.HasPasskey }">
                <div class="security-card__icon">⌁</div><div><b>Passkey / 设备生物识别</b><p>使用 Windows Hello、Face ID、Touch ID 或安全密钥。平台不保存生物特征。</p></div>
                <span>{{ capabilities.HasPasskey ? '已启用' : '未启用' }}</span>
              </article>
              <article class="security-card" :class="{ enabled: capabilities.HasTotp }">
                <div class="security-card__icon">6</div><div><b>Authenticator 动态口令</b><p>兼容 Microsoft Authenticator、Google Authenticator 等 TOTP 应用，可分别用于免密码登录和二次验证。</p></div>
                <span>{{ capabilities.HasTotp ? '已启用' : '未启用' }}</span>
              </article>
              <article class="security-card" :class="{ enabled: capabilities.HasFace }">
                <div class="security-card__icon">◎</div><div><b>严格人脸核验</b><p>活体检测与模板由独立 Face Gateway 处理，当前系统仅保存不透明主体引用。</p></div>
                <span>{{ capabilities.FaceEnabled ? (capabilities.HasFace ? '已登记' : '可登记') : '未配置' }}</span>
              </article>
            </div>
            <div class="password-card">
              <div class="subheading"><div><b>修改登录密码</b><p>已登记验证因子时，提交前必须完成一次二次身份验证。</p></div><span>一次性票据 · 2 分钟</span></div>
              <div class="form-grid form-grid--password">
                <label><span>当前密码</span><input v-model="password.old" type="password" autocomplete="current-password" placeholder="请输入当前密码" /></label>
                <label><span>新密码</span><input v-model="password.next" type="password" autocomplete="new-password" placeholder="至少 6 位" /></label>
                <label><span>确认新密码</span><input v-model="password.confirm" type="password" autocomplete="new-password" placeholder="再次输入新密码" /></label>
                <label v-if="capabilities.HasStepUpTotp && !capabilities.HasPasskey"><span>Authenticator 动态口令</span><input v-model="password.totpCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6 位动态口令" /></label>
              </div>
              <div class="panel-actions"><button class="btn btn--primary" :disabled="busy === 'password'" @click="changePassword">{{ busy === 'password' ? '安全验证中…' : '验证并修改密码' }}</button></div>
            </div>
          </template>

          <template v-else-if="activeTab === 'authenticators'">
            <div class="panel-heading"><div><span>身份验证器</span><h2>管理通行密钥与 Authenticator</h2></div><button class="btn btn--primary" :disabled="busy === 'register' || !passkeyAvailable" @click="addPasskey">+ 登记 Passkey</button></div>
            <div v-if="!passkeyAvailable" class="empty-state"><b>当前环境不支持 Passkey</b><p>请使用 HTTPS 或本机地址，并确认浏览器支持设备生物识别。</p></div>
            <div v-else-if="!authenticators.length" class="empty-state"><b>尚未登记 Passkey</b><p>登记后可免密码登录，也可授权修改密码和 V8 自定义敏感操作。</p></div>
            <div v-else class="device-list">
              <article v-for="item in authenticators" :key="item.Id" class="device-row">
                <div class="device-icon">⌘</div><div><b>{{ item.DeviceName || '我的 Passkey' }}</b><p>最近使用 {{ item.LastUsedTime || '尚未使用' }} · {{ (item.Transports || []).join(' / ') || '平台验证器' }}</p></div>
                <div class="policy-switches">
                  <label><input type="checkbox" :checked="item.AllowPasswordlessLogin" @change="changeAuthenticatorPolicy(item, 'Passkey', 'AllowPasswordlessLogin', $event.target.checked)" />免密码登录</label>
                  <label><input type="checkbox" :checked="item.AllowStepUp" @change="changeAuthenticatorPolicy(item, 'Passkey', 'AllowStepUp', $event.target.checked)" />二次验证</label>
                </div>
                <button class="icon-btn danger" title="撤销 Passkey" @click="removePasskey(item)">移除</button>
              </article>
            </div>
            <div v-if="capabilities.FaceEnabled" class="face-enroll">
              <div><b>{{ capabilities.HasFace ? '重新登记严格人脸' : '登记严格人脸' }}</b><p>打开由当前租户配置的核验服务，原始人脸图片与模板不会进入平台业务数据库。</p></div>
              <button class="btn btn--ghost" :disabled="busy === 'face'" @click="enrollFace">{{ busy === 'face' ? '核验中…' : '开始登记' }}</button>
            </div>
            <div class="authenticator-section">
              <div class="subheading"><div><b>Authenticator 动态口令</b><p>密钥仅在登记时显示一次。扫码后输入 6 位口令确认，可自由决定是否用于免密码登录和二次验证。</p></div><button v-if="!totpEnrollment" class="btn btn--ghost" :disabled="busy === 'totp-begin'" @click="startTotpEnrollment">{{ totpAuthenticators.length ? '重新登记' : '+ 添加 Authenticator' }}</button></div>
              <div v-if="totpEnrollment" class="totp-enrollment">
                <div class="totp-enrollment__visual">
                  <div class="authenticator-preview">
                    <div class="authenticator-preview__banner"></div>
                    <div class="authenticator-preview__identity">
                      <div class="avatar avatar--authenticator">
                        <img v-if="publicAvatarUrl && !publicAvatarFailed" :src="publicAvatarUrl" alt="" @error="publicAvatarFailed = true" />
                        <span v-else>{{ initials }}</span>
                      </div>
                      <div><b>{{ totpEnrollment.Issuer || systemTitle }}</b><p>{{ user.Account }}</p></div>
                    </div>
                    <span>身份验证器预览</span>
                  </div>
                  <img v-if="totpQrCode" class="totp-qr" :src="totpQrCode" alt="Authenticator 登记二维码" />
                </div>
                <div class="totp-enrollment__form">
                  <label><span>手动密钥</span><code>{{ totpEnrollment.Secret }}</code></label>
                  <label><span>验证器名称</span><input v-model.trim="totpForm.deviceName" maxlength="80" /></label>
                  <label><span>6 位动态口令</span><input v-model="totpForm.code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" /></label>
                  <div class="policy-switches policy-switches--wide">
                    <label><input v-model="totpForm.allowPasswordlessLogin" type="checkbox" />允许代替账号密码登录</label>
                    <label><input v-model="totpForm.allowStepUp" type="checkbox" />允许用于敏感操作二次验证</label>
                  </div>
                  <div class="inline-actions"><button class="btn btn--primary" :disabled="busy === 'totp-complete'" @click="finishTotpEnrollment">确认登记</button><button class="btn btn--ghost" @click="cancelTotpEnrollment">取消</button></div>
                  <p class="totp-format-note">标准 TOTP 二维码只包含签发者、账号和密钥。公开头像与科技 Banner 用于当前系统内的身份预览；Microsoft Authenticator 的品牌卡片需由 Microsoft Entra 组织品牌能力提供。</p>
                </div>
              </div>
              <div v-else-if="totpAuthenticators.length" class="device-list">
                <article v-for="item in totpAuthenticators" :key="item.Id" class="device-row">
                  <div class="device-icon">6</div><div><b>{{ item.DeviceName || 'Authenticator' }}</b><p>{{ item.Issuer }} · 登记于 {{ item.EnrolledTime || '未知' }}</p></div>
                  <div class="policy-switches">
                    <label><input type="checkbox" :checked="item.AllowPasswordlessLogin" @change="changeAuthenticatorPolicy(item, 'Totp', 'AllowPasswordlessLogin', $event.target.checked)" />免密码登录</label>
                    <label><input type="checkbox" :checked="item.AllowStepUp" @change="changeAuthenticatorPolicy(item, 'Totp', 'AllowStepUp', $event.target.checked)" />二次验证</label>
                  </div>
                  <button class="icon-btn danger" @click="removeTotp(item)">移除</button>
                </article>
              </div>
              <div v-else class="empty-state compact"><b>尚未登记 Authenticator</b><p>兼容标准 TOTP 应用，无需绑定微软账号。</p></div>
            </div>
          </template>

          <template v-else-if="activeTab === 'external'">
            <div class="panel-heading"><div><span>外部账号</span><h2>绑定常用平台身份用于免密码登录</h2></div><span class="status-chip status-chip--secure">OAuth 一次性状态</span></div>
            <div v-if="!externalProviders.length" class="empty-state"><b>当前租户尚未提供外部登录方式</b><p>超级管理员可在“系统设置 → 安全与服务接入”中接入 Microi 官方账号、Gitee、微信开放平台或 GitHub。</p></div>
            <div v-else class="external-grid">
              <article v-for="provider in externalProviders" :key="provider.Key" class="external-card" :class="{ connected: bindingByProvider[String(provider.Key).toLowerCase()] }">
                <div class="external-card__icon">{{ externalProviderGlyph(provider.Key) }}</div>
                <div><b>{{ provider.Name }}</b><p>{{ provider.Description }}</p></div>
                <template v-if="bindingByProvider[String(provider.Key).toLowerCase()]">
                  <small>已绑定 {{ bindingByProvider[String(provider.Key).toLowerCase()].DisplayName || bindingByProvider[String(provider.Key).toLowerCase()].AccountName || '外部身份' }}</small>
                  <button class="btn btn--ghost danger-text" @click="unbindExternal(bindingByProvider[String(provider.Key).toLowerCase()])">解除绑定</button>
                </template>
                <template v-else>
                  <small>{{ provider.Configured ? '可安全绑定' : provider.Enabled ? '管理员尚未配置 Secret' : '当前租户未开启' }}</small>
                  <button class="btn btn--primary" :disabled="busy === `external-${provider.Key}` || !provider.Configured" @click="bindExternal(provider)">绑定账号</button>
                </template>
              </article>
            </div>
          </template>

          <template v-else-if="activeTab === 'preferences'">
            <div class="panel-heading"><div><span>偏好与终端</span><h2>跨设备同步主题、菜单、首页与桌面</h2></div><span class="status-chip">sys_user 个人设置</span></div>
            <div class="preference-section">
              <div class="subheading"><div><b>主题与菜单</b><p>保存到当前账号，换一台电脑登录后仍会恢复。</p></div><span>跨设备</span></div>
              <div class="form-grid preference-grid">
                <label><span>主题色</span><div class="color-field"><input v-model="preference.ThemeColor" type="color" /><code>{{ preference.ThemeColor || '跟随系统' }}</code></div></label>
                <label><span>浅色 / 深色</span><select v-model="preference.ThemeMode"><option value="light">浅色</option><option value="dark">深色</option></select></label>
                <label><span>菜单子级展开方式</span><select v-model="preference.MenuChildExpandMode"><option value="System">跟随系统设置</option><option value="Down">向下展开</option><option value="Right">逐级向右展开</option></select></label>
                <label><span>边角风格</span><select v-model="preference.CornerStyle"><option value="System">跟随系统设置</option><option value="round">圆角</option><option value="square">直角</option></select></label>
                <label><span>导航菜单位置</span><select v-model="preference.NavigationLayout"><option value="System">跟随系统设置</option><option value="Side">侧边导航</option><option value="Top">顶部导航</option><option value="TopSide">顶部 + 侧边导航</option></select></label>
                <label><span>桌面模式</span><select v-model="preference.DesktopType"><option value="">使用系统默认</option><option value="macos">macOS 风格</option><option value="windows">Windows 风格</option></select></label>
              </div>
            </div>
            <div class="preference-section">
              <div class="subheading"><div><b>首页与桌面</b><p>只允许站内首页路由和当前租户文件，不能修改组织或权限。</p></div></div>
              <label class="wide-field"><span>登录后首页</span><input v-model.trim="preference.DefaultIndexUrl" placeholder="例如 /dashboard，留空使用系统默认首页" /><small>登录时仍会按当前菜单权限检查并自动回退。</small></label>
              <div class="form-grid preference-grid">
                <label><span>桌面背景</span><div class="file-field"><input :value="preference.DesktopBg" readonly placeholder="使用系统默认背景" /><input ref="desktopBgInput" class="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" @change="uploadDesktopBackground" /><button type="button" class="btn btn--ghost" :disabled="busy === 'desktop-bg'" @click="desktopBgInput?.click()">{{ busy === 'desktop-bg' ? '上传中…' : '选择图片' }}</button></div></label>
                <label><span>桌面任务栏菜单</span><select v-model="preference.DesktopDockMenu" multiple :disabled="!availableMenus.length"><option v-for="menu in availableMenus" :key="menu.Id" :value="menu.Id">{{ menu.Name || menu.Title || menu.Id }}</option></select><small>{{ availableMenus.length ? '可多选当前账号有权访问的菜单' : '当前未返回可选菜单，保存时保留现值' }}</small></label>
              </div>
              <div class="toggle-grid">
                <label><input v-model="preference.OpenTreeMenu" type="checkbox" /><span><b>默认打开菜单</b><small>登录后保持左侧菜单展开</small></span></label>
                <label><input v-model="preference.RandomDesktopBg" type="checkbox" /><span><b>随机壁纸</b><small>按系统壁纸库随机切换</small></span></label>
              </div>
            </div>
            <div class="panel-actions"><button class="btn btn--primary" :disabled="busy === 'preference'" @click="savePreference">{{ busy === 'preference' ? '保存中…' : '保存全部个人偏好' }}</button></div>
            <div class="subheading terminal-title"><div><b>我的在线终端</b><p>会话由 DiyToken + Redis 跨节点统一维护。</p></div><span>{{ terminals.length }} 台</span></div>
            <div v-if="!terminals.length" class="empty-state compact"><b>暂无终端记录</b><p>当前版本未返回可展示的在线终端。</p></div>
            <div v-else class="device-list">
              <article v-for="item in terminals" :key="item.ConnectionId || item.DeviceClientId || item.Did || item.Ip" class="device-row">
                <div class="device-icon">▣</div><div><b>{{ item.DeviceName || item.ClientType || '已登录设备' }}</b><p>{{ item.LastActiveTime || item.UpdateTime || item.CreateTime || '在线' }} · {{ item.IP || item.Ip || 'IP 已保护' }}</p></div>
                <span class="device-state synced">{{ item.IsCurrent ? '当前设备' : '在线' }}</span>
              </article>
            </div>
          </template>
        </section>
      </div>
    </template>

    <div v-if="confirmation.visible" class="confirm-backdrop" @click.self="answerConfirmation(false)">
      <section class="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
        <span class="confirm-dialog__icon">!</span>
        <div><small>SECURITY CONFIRMATION</small><h2 id="confirm-title">{{ confirmation.title }}</h2><p id="confirm-message">{{ confirmation.message }}</p></div>
        <footer><button type="button" class="btn btn--ghost" @click="answerConfirmation(false)">取消</button><button type="button" class="btn btn--danger" @click="answerConfirmation(true)">确认操作</button></footer>
      </section>
    </div>
  </main>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, reactive, ref } from 'vue'
import QRCode from 'qrcode'
import { configureV8, dispatch, getContext, subscribeContext } from './microi.js'
import { getUserRoleNames } from './personal-settings-user.js'
import { externalProviderGlyph } from './external-provider-presentation.js'
import {
  beginTotpEnrollment,
  bindExternalIdentity,
  capabilities as loadCapabilities,
  completeTotpEnrollment,
  listExternalBindings,
  listPasskeys,
  listTotpAuthenticators,
  passkeySupported,
  passwordActionHash,
  registerPasskey,
  revokeExternalBinding,
  revokeTotpAuthenticator,
  updateAuthenticatorPolicy,
  utf8Base64,
  verifyFace,
  verifyPasskey,
  verifyTotp
} from './identity-verification.js'

const client = configureV8()
const context = reactive(getContext())
const unsubscribeContext = subscribeContext(next => Object.assign(context, next), false)
onBeforeUnmount(unsubscribeContext)
// 同一页面复用密码和强因子流程；DialogData 仅决定展示模式，不决定用户、租户或授权。
const passwordOnly = context.dialogData?.Action === 'ChangePassword'
const tabs = [
  { id: 'profile', icon: '◈', label: '个人资料', hint: '名称与组织身份' },
  { id: 'security', icon: '⌾', label: '安全与登录', hint: '密码与二次验证' },
  { id: 'authenticators', icon: '⌁', label: '验证器', hint: 'Passkey 与动态口令' },
  { id: 'external', icon: '◇', label: '外部账号', hint: 'Microi、Gitee、微信等绑定' },
  { id: 'preferences', icon: '◇', label: '偏好与终端', hint: '首页和在线设备' }
]
const loading = ref(true)
const busy = ref('')
const user = ref({})
const profile = reactive({ Name: '', Email: '', Sex: '', Lang: 'zh-CN', Avatar: '', PublicAvatar: '' })
const privateAvatarInput = ref(null)
const publicAvatarInput = ref(null)
const desktopBgInput = ref(null)
const privateAvatarUrl = ref('')
const publicAvatarUrl = ref('')
const privateAvatarFailed = ref(false)
const publicAvatarFailed = ref(false)
const heroAvatarFailed = ref(false)
const password = reactive({ old: '', next: '', confirm: '', totpCode: '' })
function clearPasswordInputs() { password.old = ''; password.next = ''; password.confirm = ''; password.totpCode = '' }
onBeforeUnmount(clearPasswordInputs)
const capabilities = ref({})
const authenticators = ref([])
const totpAuthenticators = ref([])
const totpEnrollment = ref(null)
const totpQrCode = ref('')
const totpForm = reactive({ code: '', deviceName: 'Microsoft Authenticator', allowPasswordlessLogin: true, allowStepUp: true })
const externalProviders = ref([])
const externalBindings = ref([])
const terminals = ref([])
const availableMenus = ref([])
const preference = reactive({
  DefaultIndexUrl: '',
  ThemeColor: '#409eff',
  ThemeMode: 'light',
  MenuChildExpandMode: 'System',
  CornerStyle: 'System',
  NavigationLayout: 'System',
  DesktopType: '',
  DesktopBg: '',
  RandomDesktopBg: false,
  OpenTreeMenu: false,
  DesktopDockMenu: []
})
const notice = reactive({ type: 'info', text: '' })
const confirmation = reactive({ visible: false, title: '', message: '', resolve: null })
const requestedSection = String(context.route?.query?.section || '')
const activeTab = ref(tabs.some((item) => item.id === requestedSection) ? requestedSection : 'profile')
// 嵌入态外观由宿主统一控制；编辑偏好不会提前覆盖尚未保存的全局主题。
const themeMode = computed(() => context.themeMode || preference.ThemeMode || 'light')
const themeColor = computed(() => context.themeColor || preference.ThemeColor || '#409eff')
const presentationStyle = computed(() => ({
  ...(context.uiDensity?.variables || {}),
  '--personal-primary': themeColor.value,
  '--personal-on-primary': context.themeOnPrimary,
  '--personal-primary-text': context.themePrimaryText,
  '--personal-surface': context.themeTokens.surface || (themeMode.value === 'dark' ? '#171e2b' : '#ffffff'),
  '--personal-soft': context.themeTokens.surfaceSoft || (themeMode.value === 'dark' ? '#0d121b' : '#f4f7fb'),
  '--personal-text': context.themeTokens.textPrimary || (themeMode.value === 'dark' ? '#edf4ff' : '#182234'),
  '--personal-muted': context.themeTokens.textSecondary || (themeMode.value === 'dark' ? '#aebace' : '#58677b'),
  '--personal-border': context.themeTokens.border || (themeMode.value === 'dark' ? '#354052' : '#dce3ec'),
}))
const systemTitle = computed(() => context.systemTitle || context.systemShortTitle || context.osClient || '当前系统')
const passkeyAvailable = computed(() => !!passkeySupported())
const initials = computed(() => String(user.value.Name || user.value.Account || 'M').trim().slice(0, 2).toUpperCase())
const heroAvatarUrl = computed(() => privateAvatarUrl.value || publicAvatarUrl.value)
const roleNames = computed(() => getUserRoleNames(user.value))
const securityScore = computed(() => Math.min(100, 50 + (capabilities.value.HasPasskey ? 20 : 0) + (capabilities.value.HasTotp ? 15 : 0) + (capabilities.value.HasFace ? 15 : 0)))
const securitySummary = computed(() => `${capabilities.value.HasPasskey ? '已' : '未'}启用 Passkey，${capabilities.value.HasTotp ? '已' : '未'}启用 Authenticator，${capabilities.value.HasFace ? '已' : '未'}登记严格人脸`)
const bindingByProvider = computed(() => Object.fromEntries(externalBindings.value.map((item) => [String(item.Provider || '').toLowerCase(), item])))

function showNotice(text, type = 'success') {
  notice.type = type; notice.text = text
  window.clearTimeout(showNotice.timer)
  showNotice.timer = window.setTimeout(() => { notice.text = '' }, 5000)
}

function selectTab(tabId) {
  activeTab.value = tabId
}

function askConfirmation(title, message) {
  if (confirmation.resolve) confirmation.resolve(false)
  confirmation.visible = true
  confirmation.title = title
  confirmation.message = message
  return new Promise((resolve) => { confirmation.resolve = resolve })
}

function answerConfirmation(value) {
  const resolve = confirmation.resolve
  confirmation.visible = false
  confirmation.resolve = null
  if (resolve) resolve(!!value)
}

async function refreshAvatarUrls() {
  privateAvatarFailed.value = false
  publicAvatarFailed.value = false
  heroAvatarFailed.value = false
  const publicValue = profile.PublicAvatar || user.value.PublicAvatar
  publicAvatarUrl.value = client.assetUrl(publicValue)
  try {
    privateAvatarUrl.value = await client.resolveFileUrl(user.value.Avatar)
  } catch (_) {
    privateAvatarUrl.value = client.assetUrl(user.value.Avatar)
  }
}

function openPublicAvatarPicker() {
  publicAvatarInput.value?.click()
}

function openPrivateAvatarPicker() {
  privateAvatarInput.value?.click()
}

async function uploadPrivateAvatar(event) {
  const file = event?.target?.files?.[0]
  if (!file) return
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    event.target.value = ''
    return showNotice('私有头像仅支持 PNG、JPG 或 WebP 图片。', 'error')
  }
  if (file.size > 5 * 1024 * 1024) {
    event.target.value = ''
    return showNotice('私有头像不能超过 5 MB。', 'error')
  }
  busy.value = 'private-avatar'
  try {
    const result = await client.uploadFile(file, {
      file,
      fileName: file.name,
      path: 'member/avatar',
      limit: false,
      preview: false,
      preferFetch: true,
      resolveUrl: false
    })
    const path = client.extractUploadPath(result?.Data)
    if (!path) throw new Error('上传成功但未返回头像路径。')
    profile.Avatar = path
    privateAvatarFailed.value = false
    heroAvatarFailed.value = false
    try { privateAvatarUrl.value = await client.resolveFileUrl(path) }
    catch (_) { privateAvatarUrl.value = client.assetUrl(path) }
    showNotice('私有头像已上传，点击“保存资料”后生效。', 'info')
  } catch (error) {
    showNotice(error?.Msg || error?.message || '私有头像上传失败。', 'error')
  } finally {
    busy.value = ''
    if (event?.target) event.target.value = ''
  }
}

function clearPrivateAvatar() {
  profile.Avatar = ''
  privateAvatarUrl.value = ''
  privateAvatarFailed.value = false
  heroAvatarFailed.value = false
  showNotice('私有头像已移除，点击“保存资料”后生效。', 'info')
}

async function uploadPublicAvatar(event) {
  const file = event?.target?.files?.[0]
  if (!file) return
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    event.target.value = ''
    return showNotice('公开头像仅支持 PNG、JPG 或 WebP 图片。', 'error')
  }
  if (file.size > 5 * 1024 * 1024) {
    event.target.value = ''
    return showNotice('公开头像不能超过 5 MB。', 'error')
  }
  busy.value = 'public-avatar'
  try {
    const result = await client.uploadFile(file, {
      file,
      fileName: file.name,
      path: 'member/public-avatar',
      limit: false,
      preview: true,
      preferFetch: true,
      resolveUrl: false
    })
    const path = client.extractUploadPath(result?.Data)
    if (!path) throw new Error('上传成功但未返回头像路径。')
    profile.PublicAvatar = path
    publicAvatarFailed.value = false
    heroAvatarFailed.value = false
    publicAvatarUrl.value = client.assetUrl(path)
    showNotice('公开头像已上传，点击“保存资料”后生效。', 'info')
  } catch (error) {
    showNotice(error?.Msg || error?.message || '公开头像上传失败。', 'error')
  } finally {
    busy.value = ''
    if (event?.target) event.target.value = ''
  }
}

function clearPublicAvatar() {
  profile.PublicAvatar = ''
  publicAvatarUrl.value = ''
  publicAvatarFailed.value = false
  heroAvatarFailed.value = false
  showNotice('公开头像已移除，点击“保存资料”后生效。', 'info')
}

function parseMenuIds(value) {
  if (Array.isArray(value)) return value.map((item) => String(item?.Id || item || '').trim()).filter(Boolean)
  if (!value) return []
  try { return parseMenuIds(JSON.parse(value)) }
  catch (_) { return String(value).split(',').map((item) => item.trim()).filter(Boolean) }
}

function asEnabled(value) {
  return value === true || value === 1 || String(value || '').toLowerCase() === 'true' || String(value || '') === '1'
}

async function uploadDesktopBackground(event) {
  const file = event?.target?.files?.[0]
  if (!file) return
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    event.target.value = ''
    return showNotice('桌面背景仅支持 PNG、JPG 或 WebP 图片。', 'error')
  }
  if (file.size > 10 * 1024 * 1024) {
    event.target.value = ''
    return showNotice('桌面背景不能超过 10 MB。', 'error')
  }
  busy.value = 'desktop-bg'
  try {
    const result = await client.uploadFile(file, {
      file,
      fileName: file.name,
      path: 'member/desktop-bg',
      limit: false,
      preview: false,
      preferFetch: true,
      resolveUrl: false
    })
    const path = client.extractUploadPath(result?.Data)
    if (!path) throw new Error('上传成功但未返回桌面背景路径。')
    preference.DesktopBg = path
    showNotice('桌面背景已上传，保存偏好后生效。', 'info')
  } catch (error) {
    showNotice(error?.Msg || error?.message || '桌面背景上传失败。', 'error')
  } finally {
    busy.value = ''
    if (event?.target) event.target.value = ''
  }
}

async function load() {
  loading.value = true
  try {
    const [userResult, capabilityResult, keyResult, totpResult, externalResult, terminalResult, menuResult] = await Promise.all([
      client.post('/api/SysUser/RefreshLoginUser', {}).catch(() => client.post('/api/SysUser/GetCurrentUser', {})),
      loadCapabilities(client, context.osClient),
      listPasskeys(client).catch(() => []),
      listTotpAuthenticators(client).catch(() => []),
      listExternalBindings(client).catch(() => ({ Providers: [], Bindings: [] })),
      client.post('/apiengine/platform-online-terminal', { Action: 'Mine' }).catch(() => ({ Data: { Terminals: [] } })),
      client.post('/api/SysMenu/GetSysMenuStep', {}).catch(() => ({ Data: [] }))
    ])
    if (userResult?.Code !== 1) throw new Error(userResult?.Msg || '当前用户加载失败。')
    user.value = userResult.Data || {}
    profile.Name = user.value.Name || ''
    profile.Email = user.value.Email || ''
    profile.Sex = user.value.Sex || ''
    profile.Lang = user.value.Lang || 'zh-CN'
    profile.Avatar = client.extractUploadPath(user.value.Avatar)
    profile.PublicAvatar = client.extractUploadPath(user.value.PublicAvatar)
    await refreshAvatarUrls()
    preference.DefaultIndexUrl = user.value.DefaultIndexUrl || ''
    preference.ThemeColor = user.value.ThemeColor || context.themeColor || '#409eff'
    preference.CornerStyle = ['round', 'square'].includes(user.value.CornerStyle) ? user.value.CornerStyle : 'System'
    preference.NavigationLayout = ['Side', 'Top', 'TopSide'].includes(user.value.NavigationLayout) ? user.value.NavigationLayout : 'System'
    preference.ThemeMode = ['light', 'dark'].includes(String(user.value.ThemeMode || '').toLowerCase())
      ? String(user.value.ThemeMode).toLowerCase()
      : (context.themeMode || 'light')
    preference.MenuChildExpandMode = ['Down', 'Right'].includes(user.value.MenuChildExpandMode)
      ? user.value.MenuChildExpandMode
      : 'System'
    preference.DesktopType = ['macos', 'windows'].includes(String(user.value.DesktopType || '').toLowerCase())
      ? String(user.value.DesktopType).toLowerCase()
      : ''
    preference.DesktopBg = client.extractUploadPath(user.value.DesktopBg)
    preference.RandomDesktopBg = asEnabled(user.value.RandomDesktopBg)
    preference.OpenTreeMenu = asEnabled(user.value.OpenTreeMenu)
    preference.DesktopDockMenu = parseMenuIds(user.value.DesktopDockMenu)
    capabilities.value = capabilityResult || {}
    authenticators.value = Array.isArray(keyResult) ? keyResult : []
    totpAuthenticators.value = Array.isArray(totpResult) ? totpResult : []
    externalProviders.value = Array.isArray(externalResult?.Providers) ? externalResult.Providers : []
    externalBindings.value = Array.isArray(externalResult?.Bindings) ? externalResult.Bindings : []
    const terminalData = terminalResult?.Data
    terminals.value = Array.isArray(terminalData)
      ? terminalData
      : (Array.isArray(terminalData?.Terminals) ? terminalData.Terminals : [])
    const menuData = menuResult?.Data
    availableMenus.value = (Array.isArray(menuData) ? menuData : (menuData?.List || menuData?.Data || []))
      .filter((item) => item?.Id && Number(item.Display ?? 1) !== 0)
    if (passwordOnly || context.route?.query?.action === 'password') activeTab.value = 'security'
  } catch (error) {
    showNotice(error?.Msg || error?.message || '个人设置加载失败。', 'error')
  } finally { loading.value = false }
}

async function saveProfile() {
  if (!profile.Name) return showNotice('显示名称不能为空。', 'error')
  busy.value = 'profile'
  try {
    const result = await client.post('/api/SysUser/UpdateCurrentProfile', {
      Name: profile.Name,
      Email: profile.Email,
      Sex: profile.Sex,
      Lang: profile.Lang,
      Avatar: client.extractUploadPath(profile.Avatar),
      PublicAvatar: client.extractUploadPath(profile.PublicAvatar)
    })
    if (result?.Code !== 1) throw new Error(result?.Msg || '保存失败。')
    user.value = {
      ...user.value,
      ...(result.Data || {}),
      Name: profile.Name,
      Email: profile.Email,
      Sex: profile.Sex,
      Lang: profile.Lang,
      Avatar: profile.Avatar,
      PublicAvatar: profile.PublicAvatar
    }
    profile.Avatar = client.extractUploadPath(user.value.Avatar)
    profile.PublicAvatar = client.extractUploadPath(user.value.PublicAvatar)
    await refreshAvatarUrls()
    showNotice('个人资料已保存。')
  } catch (error) { showNotice(error?.Msg || error?.message || '保存失败。', 'error') }
  finally { busy.value = '' }
}

async function changePassword() {
  if (busy.value === 'password') return
  if (!password.old || !password.next) return showNotice('请完整填写当前密码和新密码。', 'error')
  if (password.next.length < 6) return showNotice('新密码长度不能少于 6 位。', 'error')
  if (password.next !== password.confirm) return showNotice('两次输入的新密码不一致。', 'error')
  busy.value = 'password'
  try {
    const encodedOld = utf8Base64(password.old)
    const encodedNew = utf8Base64(password.next)
    let ticket = ''
    if (capabilities.value.Enabled && capabilities.value.PasswordChangeStepUp
      && (capabilities.value.HasStepUpPasskey || capabilities.value.HasStepUpTotp || capabilities.value.HasFace)) {
      const actionHash = await passwordActionHash(user.value.Id, encodedNew)
      let verifyResult
      if (capabilities.value.HasStepUpPasskey) {
        verifyResult = await verifyPasskey(client, { osClient: context.osClient, account: user.value.Account, purpose: 'ChangePassword', actionHash })
      } else if (capabilities.value.HasStepUpTotp) {
        if (String(password.totpCode || '').replace(/\D/g, '').length !== 6) throw new Error('请输入 Authenticator 中的 6 位动态口令。')
        verifyResult = await verifyTotp(client, { osClient: context.osClient, account: user.value.Account, code: password.totpCode, purpose: 'ChangePassword', actionHash })
      } else {
        verifyResult = await verifyFace(client, { osClient: context.osClient, account: user.value.Account, purpose: 'ChangePassword', actionHash })
      }
      if (verifyResult?.Code !== 1) throw new Error(verifyResult?.Msg || '二次身份验证失败。')
      ticket = verifyResult.Data?.Ticket || ''
    }
    const result = await client.post('/api/SysUser/UptSysUser', {
      Id: user.value.Id,
      Pwd: encodedOld,
      NewPwd: encodedNew,
      _IdentityVerificationTicket: ticket
    })
    if (result?.Code !== 1) throw new Error(result?.Msg || '密码修改失败。')
    clearPasswordInputs()
    showNotice('密码修改成功。为保护账号，建议检查在线终端。')
  } catch (error) { showNotice(error?.Msg || error?.message || '密码修改失败。', 'error') }
  finally { busy.value = '' }
}

async function addPasskey() {
  busy.value = 'register'
  try {
    const result = await registerPasskey(client, `${navigator.platform || '当前设备'} Passkey`)
    if (result?.Code !== 1) throw new Error(result?.Msg || 'Passkey 登记失败。')
    authenticators.value = await listPasskeys(client)
    capabilities.value = await loadCapabilities(client, context.osClient)
    showNotice('Passkey 已安全登记。')
  } catch (error) { showNotice(error?.Msg || error?.message || 'Passkey 登记失败。', 'error') }
  finally { busy.value = '' }
}

async function removePasskey(item) {
  if (!(await askConfirmation('撤销 Passkey', `确认撤销“${item.DeviceName || '该 Passkey'}”？撤销后将不能用于登录和敏感操作。`))) return
  try {
    const result = await client.post('/api/IdentityVerification/RevokeAuthenticator', { Id: item.Id })
    if (result?.Code !== 1) throw new Error(result?.Msg || '撤销失败。')
    authenticators.value = authenticators.value.filter((value) => value.Id !== item.Id)
    capabilities.value = await loadCapabilities(client, context.osClient)
    showNotice('Passkey 已撤销。')
  } catch (error) { showNotice(error?.Msg || error?.message || '撤销失败。', 'error') }
}

async function changeAuthenticatorPolicy(item, type, field, checked) {
  const previous = !!item[field]
  item[field] = checked
  try {
    const result = await updateAuthenticatorPolicy(client, {
      Id: item.Id,
      Type: type,
      AllowPasswordlessLogin: field === 'AllowPasswordlessLogin' ? checked : !!item.AllowPasswordlessLogin,
      AllowStepUp: field === 'AllowStepUp' ? checked : !!item.AllowStepUp
    })
    if (result?.Code !== 1) throw new Error(result?.Msg || '用途更新失败。')
    capabilities.value = await loadCapabilities(client, context.osClient)
    showNotice('身份验证器用途已更新。')
  } catch (error) {
    item[field] = previous
    showNotice(error?.Msg || error?.message || '用途更新失败。', 'error')
  }
}

async function startTotpEnrollment() {
  busy.value = 'totp-begin'
  try {
    totpEnrollment.value = await beginTotpEnrollment(client)
    totpQrCode.value = await QRCode.toDataURL(totpEnrollment.value.OtpAuthUri, {
      width: 220,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#132238', light: '#ffffff' }
    })
    totpForm.code = ''
  } catch (error) { showNotice(error?.Msg || error?.message || 'Authenticator 登记会话创建失败。', 'error') }
  finally { busy.value = '' }
}

function cancelTotpEnrollment() {
  totpEnrollment.value = null
  totpQrCode.value = ''
  totpForm.code = ''
}

async function finishTotpEnrollment() {
  if (String(totpForm.code || '').replace(/\D/g, '').length !== 6) return showNotice('请输入 6 位动态口令。', 'error')
  busy.value = 'totp-complete'
  try {
    const result = await completeTotpEnrollment(client, {
      ChallengeId: totpEnrollment.value?.ChallengeId,
      Code: totpForm.code,
      DeviceName: totpForm.deviceName,
      AllowPasswordlessLogin: totpForm.allowPasswordlessLogin,
      AllowStepUp: totpForm.allowStepUp
    })
    if (result?.Code !== 1) throw new Error(result?.Msg || 'Authenticator 登记失败。')
    totpAuthenticators.value = await listTotpAuthenticators(client)
    capabilities.value = await loadCapabilities(client, context.osClient)
    cancelTotpEnrollment()
    showNotice('Authenticator 已登记，可按所选用途使用。')
  } catch (error) { showNotice(error?.Msg || error?.message || 'Authenticator 登记失败。', 'error') }
  finally { busy.value = '' }
}

async function removeTotp(item) {
  if (!(await askConfirmation('移除 Authenticator', `确认移除“${item.DeviceName || 'Authenticator'}”？`))) return
  try {
    const result = await revokeTotpAuthenticator(client, item.Id)
    if (result?.Code !== 1) throw new Error(result?.Msg || '移除失败。')
    totpAuthenticators.value = totpAuthenticators.value.filter((value) => value.Id !== item.Id)
    capabilities.value = await loadCapabilities(client, context.osClient)
    showNotice('Authenticator 已移除。')
  } catch (error) { showNotice(error?.Msg || error?.message || '移除失败。', 'error') }
}

async function bindExternal(provider) {
  busy.value = `external-${provider.Key}`
  try {
    await bindExternalIdentity(client, context.osClient, provider.Key)
    const result = await listExternalBindings(client)
    externalProviders.value = result.Providers || []
    externalBindings.value = result.Bindings || []
    showNotice(`${provider.Name}绑定成功。`)
  } catch (error) { showNotice(error?.Msg || error?.message || '外部账号绑定失败。', 'error') }
  finally { busy.value = '' }
}

async function unbindExternal(binding) {
  if (!(await askConfirmation('解除外部账号', '确认解除该外部账号绑定？解除后将不能再用它登录。'))) return
  try {
    const result = await revokeExternalBinding(client, binding.Id)
    if (result?.Code !== 1) throw new Error(result?.Msg || '解除绑定失败。')
    externalBindings.value = externalBindings.value.filter((item) => item.Id !== binding.Id)
    showNotice('外部账号绑定已解除。')
  } catch (error) { showNotice(error?.Msg || error?.message || '解除绑定失败。', 'error') }
}

async function enrollFace() {
  busy.value = 'face'
  try {
    const result = await verifyFace(client, { osClient: context.osClient, account: user.value.Account, purpose: 'EnrollFace', mode: 'Enroll', actionHash: 'enroll-face-profile' })
    if (result?.Code !== 1) throw new Error(result?.Msg || '人脸登记失败。')
    capabilities.value = await loadCapabilities(client, context.osClient)
    showNotice('严格人脸验证已登记。')
  } catch (error) { showNotice(error?.Msg || error?.message || '人脸登记失败。', 'error') }
  finally { busy.value = '' }
}

async function savePreference() {
  busy.value = 'preference'
  try {
    const result = await client.ApiEngine.Run('platform-user-update-preferences', {
      DefaultIndexUrl: preference.DefaultIndexUrl,
      ThemeColor: preference.ThemeColor,
      ThemeMode: preference.ThemeMode,
      MenuChildExpandMode: preference.MenuChildExpandMode,
      CornerStyle: preference.CornerStyle,
      NavigationLayout: preference.NavigationLayout,
      DesktopType: preference.DesktopType,
      DesktopBg: preference.DesktopBg,
      RandomDesktopBg: preference.RandomDesktopBg,
      OpenTreeMenu: preference.OpenTreeMenu,
      DesktopDockMenu: availableMenus.value.length ? preference.DesktopDockMenu : undefined
    })
    if (result?.Code !== 1) throw new Error(result?.Msg || '保存失败。')
    user.value = { ...user.value, ...(result.Data || {}) }
    dispatch('micro-app:host-action', {
      action: 'refreshCurrentUser',
      requestId: `personal-preferences-${Date.now()}`,
      silent: true
    }, { force: true })
    showNotice('个人偏好已保存，并会在其它设备登录时恢复。')
  } catch (error) { showNotice(error?.Msg || error?.message || '保存失败。', 'error') }
  finally { busy.value = '' }
}

onMounted(load)
</script>

<style scoped src="./personal-settings.css"></style>
