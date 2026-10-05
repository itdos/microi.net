<template>
  <main class="system-settings" :data-theme="themeMode" :style="settingsViewportStyle">
    <header class="settings-hero">
      <div class="hero-mark"><i /><i /><i /><span>⚙</span></div>
      <div class="hero-copy"><p>MICROI SERVER PRIVATE</p><h1>服务端私有设置</h1><small>这里只维护凭据与后端专用接入参数；功能启用、登录入口显示等公开开关统一在系统设置表维护</small></div>
      <button type="button" class="primary" @click="openEditor()">＋ 新建私有设置</button>
    </header>

    <div v-if="notice.text" class="notice" :class="notice.type">{{ notice.text }}</div>

    <section class="metrics">
      <article><b>{{ rows.length }}</b><span>有效设置</span></article>
      <article><b>{{ enabledCount }}</b><span>启用设置</span></article>
      <article><b>{{ secretCount }}</b><span>认证密文</span></article>
      <article><b>{{ accessCount }}</b><span>安全与服务接入</span></article>
    </section>

    <section class="workspace">
      <aside>
        <button v-for="item in filters" :key="item.key" type="button" :class="{ active: activeFilter === item.key }" @click="activeFilter = item.key">
          <span>{{ item.icon }}</span><div><b>{{ item.name }}</b><small>{{ item.hint }}</small></div>
        </button>
        <div class="boundary-note">
          <b>两条安全边界</b>
          <p><em>sys_config</em> 保存功能启用与入口显示等公开开关；这里的普通私有值与 <em>Secret</em> 均不会下发浏览器。</p>
        </div>
      </aside>

      <div class="settings-list">
        <div class="toolbar">
          <label><span>⌕</span><input v-model.trim="keyword" placeholder="搜索 Key、分类或说明" /></label>
          <button type="button" class="ghost" :disabled="loading" @click="load">{{ loading ? '读取中…' : '刷新' }}</button>
        </div>

        <div class="settings-scroll">
          <div v-if="loading" class="loading-grid"><i v-for="n in 6" :key="n" /></div>
          <div v-else-if="!filteredRows.length" class="empty"><b>这里还没有私有设置</b><p>敏感凭据和仅供后端使用的业务配置可在这里创建；浏览器公开配置请返回系统设置表维护。</p></div>
          <div v-else class="config-grid">
            <article v-for="item in filteredRows" :key="item.Id" class="config-card" :class="{ secret: item.IsSecret, disabled: !item.IsEnabled }">
              <div class="config-icon">{{ item.IsSecret ? '◆' : '◇' }}</div>
              <div class="config-copy"><b>{{ settingTitle(item) }}</b><p>{{ item.ConfigKey }}</p></div>
              <div class="badges"><span>{{ item.ValueType }}</span><span>服务端私有</span><span v-if="item.IsSecret" class="secret-badge">Secret</span><span v-if="!item.IsEnabled">已停用</span></div>
              <div class="config-value">
                <code v-if="item.IsSecret">{{ item.HasSecret ? '••••••••••••••••' : '尚未填写 Secret' }}</code>
                <button
                  v-else-if="isBoolSetting(item)"
                  type="button"
                  class="value-switch"
                  :class="{ on: boolValue(item.ConfigValue) }"
                  role="switch"
                  :aria-checked="String(boolValue(item.ConfigValue))"
                  :aria-label="`切换${settingTitle(item)}`"
                  :disabled="isBoolSaving(item)"
                  @click="toggleBool(item)"
                ><span class="switch-track"><i /></span><b>{{ isBoolSaving(item) ? '保存中…' : (boolValue(item.ConfigValue) ? '已开启' : '已关闭') }}</b></button>
                <code v-else>{{ previewValue(item.ConfigValue) }}</code>
              </div>
              <div class="card-actions">
                <button v-if="item.IsSecret && item.HasSecret" type="button" @click="revealSecret(item)">临时显示</button>
                <button type="button" @click="openEditor(item)">编辑</button>
                <button type="button" class="danger" @click="remove(item)">删除</button>
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>

    <dialog ref="editorDialog" v-if="editorVisible" class="modal-backdrop" :class="overlayClass" @cancel.prevent="closeEditor" @click.self="closeEditor">
      <section class="modal-shell editor" role="document" data-drag-name="editor" :style="dragStyle('editor')">
        <header class="modal-heading draggable" @pointerdown="startDrag($event, 'editor')">
          <div class="modal-title-icon" aria-hidden="true">{{ form.IsSecret ? '◆' : '⚙' }}</div>
          <div class="modal-title-copy"><span>{{ form.Id ? 'EDIT TENANT SETTING' : 'NEW TENANT SETTING' }}</span><h2>{{ editorTitle }}</h2><p>{{ editorSubtitle }}</p></div>
          <button type="button" class="modal-close" aria-label="关闭" @click="closeEditor">×</button>
        </header>
        <div class="modal-scroll editor-grid">
          <label class="full"><span>设置 Key</span><input v-model.trim="form.ConfigKey" :disabled="!!form.Id" maxlength="200" placeholder="例如 Login.Gitee.ClientId" /><small>字母开头，可使用字母、数字、点、冒号、下划线和中划线。</small></label>
          <label><span>分类</span><input v-model.trim="form.Category" maxlength="100" placeholder="安全与服务接入" /></label>
          <label><span>值类型</span><select v-model="form.ValueType" :disabled="form.IsSecret" @change="normalizeValueType"><option>String</option><option>Bool</option><option>Int</option><option>Decimal</option><option>Json</option></select></label>
          <label class="full"><span>{{ form.IsSecret ? (form.HasSecret ? 'Secret 新值（留空保持原值）' : 'Secret 值') : '设置值' }}</span>
            <button v-if="isBoolSetting(form) && !form.IsSecret" type="button" class="bool-editor" :class="{ on: formBoolValue }" role="switch" :aria-checked="String(formBoolValue)" @click="formBoolValue = !formBoolValue"><span class="switch-track"><i /></span><b>{{ formBoolValue ? '已开启' : '已关闭' }}</b><small>点击开关即可修改，无需输入 true / false</small></button>
            <textarea v-else v-model="form.Value" rows="4" :placeholder="form.IsSecret ? '输入后立即转为认证密文，列表不会返回原文' : '输入设置值'" />
          </label>
          <label class="full"><span>说明</span><input v-model.trim="form.Description" maxlength="500" placeholder="说明此设置的用途与影响范围" /></label>
          <div class="switches switches--private full">
            <label><input v-model="form.IsEnabled" type="checkbox" /><span><b>启用</b><small>停用后运行时不读取</small></span></label>
            <label><input v-model="form.IsSecret" type="checkbox" @change="normalizeSecret" /><span><b>Secret</b><small>后端认证加密，列表掩码</small></span></label>
          </div>
        </div>
        <footer class="modal-footer"><button type="button" class="ghost" @click="closeEditor">取消</button><button type="button" class="primary" :disabled="saving" @click="save">{{ saving ? '安全保存中…' : '保存设置' }}</button></footer>
      </section>
    </dialog>

    <dialog ref="deleteDialog" v-if="deleteTarget" class="modal-backdrop confirm-backdrop" :class="overlayClass" @cancel.prevent="cancelRemove" @click.self="cancelRemove">
      <section class="modal-shell confirm-dialog" role="document" data-drag-name="delete" :style="dragStyle('delete')">
        <header class="modal-heading draggable" @pointerdown="startDrag($event, 'delete')">
          <div class="modal-title-icon danger-icon" aria-hidden="true">!</div>
          <div class="modal-title-copy"><span>DELETE TENANT SETTING</span><h2>{{ settingTitle(deleteTarget) }}</h2><p>{{ deleteTarget.ConfigKey }}</p></div>
          <button type="button" class="modal-close" aria-label="关闭" @click="cancelRemove">×</button>
        </header>
        <div class="confirm-message"><b>删除后无法恢复</b><p>运行时将不再读取此项配置；此操作只删除当前租户的数据，不影响其它租户。</p></div>
        <footer class="modal-footer"><button type="button" class="ghost" @click="cancelRemove">取消</button><button type="button" class="danger-primary" :disabled="deleting" @click="confirmRemove">{{ deleting ? '删除中…' : '确认删除' }}</button></footer>
      </section>
    </dialog>

    <dialog ref="totpDialog" v-if="totp.visible" class="modal-backdrop confirm-backdrop" :class="overlayClass" @cancel.prevent="closeTotp" @click.self="closeTotp">
      <section class="modal-shell totp-dialog" role="document" data-drag-name="totp" :style="dragStyle('totp')">
        <header class="modal-heading draggable" @pointerdown="startDrag($event, 'totp')">
          <div class="modal-title-icon" aria-hidden="true">✦</div>
          <div class="modal-title-copy"><span>IDENTITY VERIFICATION</span><h2>验证管理员身份</h2><p>{{ totp.key }}</p></div>
          <button type="button" class="modal-close" aria-label="关闭" @click="closeTotp">×</button>
        </header>
        <form class="totp-form" @submit.prevent="submitTotp"><label><span>Authenticator 动态口令</span><input ref="totpInput" v-model.trim="totp.code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="输入 6 位数字" /></label><p v-if="totp.error">{{ totp.error }}</p></form>
        <footer class="modal-footer"><button type="button" class="ghost" @click="closeTotp">取消</button><button type="button" class="primary" @click="submitTotp">继续验证</button></footer>
      </section>
    </dialog>

    <dialog ref="revealDialog" v-if="revealed.visible" class="modal-backdrop" :class="overlayClass" @cancel.prevent="clearReveal" @click.self="clearReveal">
      <section class="modal-shell secret-reveal" role="document" data-drag-name="reveal" :style="dragStyle('reveal')">
        <header class="modal-heading draggable" @pointerdown="startDrag($event, 'reveal')">
          <div class="modal-title-icon" aria-hidden="true">◆</div>
          <div class="modal-title-copy"><span>SECRET REVEAL · {{ revealed.seconds }}s</span><h2>{{ revealed.title }}</h2><p>{{ revealed.key }}</p></div>
          <button type="button" class="modal-close" aria-label="立即清除" @click="clearReveal">×</button>
        </header>
        <div class="secret-value"><code>{{ revealed.value }}</code><p>该原文不会写入日志，页面将在倒计时结束后自动清除。</p></div>
        <footer class="modal-footer"><button type="button" class="primary" @click="clearReveal">立即清除</button></footer>
      </section>
    </dialog>
  </main>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { configureV8, dispatch, getContext, subscribeContext } from './microi.js'
import { capabilities, verifyFace, verifyPasskey, verifyTotp } from './identity-verification.js'
import './system-settings-navigation.css'

const client = configureV8()
const context = reactive(getContext())
const themeMode = computed(() => context.themeMode || 'light')
const themeColor = computed(() => context.themeColor || '#409eff')
const overlayClass = computed(() => context.disableFormMaskBlur ? 'plain' : 'blurred')
const settingsViewportStyle = computed(() => {
  const height = Math.max(0, Number(context.hostViewport?.height || 0))
  return {
    '--accent': themeColor.value,
    '--system-settings-host-height': height > 0 ? `${height}px` : '100vh'
  }
})
const rows = ref([])
const loading = ref(true)
const saving = ref(false)
const deleting = ref(false)
const boolSavingIds = ref(new Set())
const keyword = ref('')
const activeFilter = ref(String(context.dialogData?.Section || '').toLowerCase() === 'login' ? 'login' : 'all')
const editorVisible = ref(false)
const deleteTarget = ref(null)
const notice = reactive({ text: '', type: 'success' })
const revealed = reactive({ visible: false, title: '', key: '', value: '', seconds: 0, timer: null })
const totp = reactive({ visible: false, key: '', code: '', error: '' })
const form = reactive(emptyForm())
const editorDialog = ref(null)
const deleteDialog = ref(null)
const totpDialog = ref(null)
const totpInput = ref(null)
const revealDialog = ref(null)
const nativeTopLayerAvailable = ref(typeof HTMLDialogElement !== 'undefined' && typeof HTMLDialogElement.prototype?.showModal === 'function')
const dragOffsets = reactive({ editor: { x: 0, y: 0 }, delete: { x: 0, y: 0 }, totp: { x: 0, y: 0 }, reveal: { x: 0, y: 0 } })
const filters = [
  { key: 'all', icon: '◈', name: '全部设置', hint: '当前租户有效配置' },
  { key: 'login', icon: '⌁', name: '安全与服务接入', hint: '登录、短信、OAuth 与地图' },
  { key: 'secret', icon: '◆', name: 'Secret', hint: '后端认证密文' },
  { key: 'private', icon: '◇', name: '普通私有', hint: '后端专用普通值' }
]
const migratedPublicSettingKeys = new Set([
  'Login.Identity.Enabled',
  'Login.Passkey.Enabled',
  'Login.Authenticator.Enabled',
  'Security.PasswordChange.RequireStepUp',
  'Login.External.Enabled',
  'Login.Face.Enabled',
  'Login.Gitee.Enabled',
  'Login.WeChat.Enabled',
  'Login.GitHub.Enabled',
  'Login.Passkey.Display',
  'Login.Authenticator.Display',
  'Login.Gitee.Display',
  'Login.WeChat.Display',
  'Login.GitHub.Display'
])
let totpResolver = null

const enabledCount = computed(() => rows.value.filter((item) => Boolean(item.IsEnabled)).length)
const secretCount = computed(() => rows.value.filter((item) => Boolean(item.IsSecret)).length)
const isSecurityOrServiceAccessKey = (value) => /^(Login\.|Security\.|Sms\.|OAuth\.|Integration\.|Map\.)/i.test(String(value || ''))
const accessCount = computed(() => rows.value.filter((item) => isSecurityOrServiceAccessKey(item.ConfigKey)).length)
const filteredRows = computed(() => {
  const search = keyword.value.toLowerCase()
  return rows.value.filter((item) => {
    if (activeFilter.value === 'login' && !isSecurityOrServiceAccessKey(item.ConfigKey)) return false
    if (activeFilter.value === 'secret' && !item.IsSecret) return false
    if (activeFilter.value === 'private' && item.IsSecret) return false
    return !search || [item.ConfigKey, item.Category, item.Description].some((value) => String(value || '').toLowerCase().includes(search))
  })
})
const formBoolValue = computed({
  get: () => boolValue(form.Value),
  set: (value) => { form.Value = value ? 'true' : 'false' }
})
const editorTitle = computed(() => form.Id ? settingTitle(form) : (form.Description || '新建私有设置'))
const editorSubtitle = computed(() => form.ConfigKey || '设置 Key 将显示在这里')
const anyModalOpen = computed(() => editorVisible.value || Boolean(deleteTarget.value) || totp.visible || revealed.visible)

function emptyForm() {
  return { Id: '', ConfigKey: '', Value: '', ValueType: 'String', Category: '', Description: '', IsPublic: false, IsSecret: false, IsEnabled: true, Sort: 0, HasSecret: false }
}

function settingTitle(item) { return String(item?.Description || item?.Category || '未填写说明') }
function boolValue(value) {
  if (value === true || value === 1) return true
  return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase())
}
function isBoolSetting(item) { return String(item?.ValueType || '').trim().toLowerCase() === 'bool' }
function isBoolSaving(item) { return boolSavingIds.value.has(String(item?.Id || '')) }
function previewValue(value) { const text = String(value ?? ''); return text.length > 160 ? `${text.slice(0, 160)}…` : (text || '（空值）') }

function message(text, type = 'success') {
  notice.text = text; notice.type = type
  clearTimeout(message.timer)
  message.timer = setTimeout(() => { notice.text = '' }, 5000)
}

async function load() {
  loading.value = true
  try {
    const result = await client.post('/api/TenantSystemSettings/List', {})
    if (result?.Code !== 1) throw new Error(result?.Msg || '系统设置加载失败。')
    rows.value = (Array.isArray(result.Data) ? result.Data : [])
      .filter((item) => !migratedPublicSettingKeys.has(String(item?.ConfigKey || '').trim()))
  } catch (error) { message(error?.Msg || error?.message || '系统设置加载失败。', 'error') }
  finally { loading.value = false }
}

function openEditor(item) {
  Object.assign(form, emptyForm(), item || {})
  form.IsEnabled = Boolean(item ? item.IsEnabled : true)
  form.IsSecret = Boolean(item?.IsSecret)
  form.Value = item?.IsSecret ? '' : (item?.ConfigValue ?? '')
  if (isBoolSetting(form)) form.Value = boolValue(form.Value) ? 'true' : 'false'
  resetDrag('editor')
  editorVisible.value = true
}

function closeEditor() { editorVisible.value = false; Object.assign(form, emptyForm()); resetDrag('editor') }
function normalizeSecret() { if (form.IsSecret) { form.IsPublic = false; form.ValueType = 'String' } }
function normalizeValueType() { if (isBoolSetting(form)) form.Value = boolValue(form.Value) ? 'true' : 'false' }

function savePayload(item, value) {
  return {
    Id: item.Id || '', ConfigKey: item.ConfigKey || '', Value: value ?? '', ValueType: item.ValueType || 'String',
    Category: item.Category || '', Description: item.Description || '', IsPublic: false, IsSecret: Boolean(item.IsSecret),
    IsEnabled: Boolean(item.IsEnabled), Sort: Number(item.Sort || 0), HasSecret: Boolean(item.HasSecret)
  }
}

async function save() {
  if (!form.ConfigKey) return message('请填写设置 Key。', 'error')
  if (migratedPublicSettingKeys.has(String(form.ConfigKey).trim())) {
    return message('此公开开关已迁移到“系统设置 → 登录界面与入口”，请勿作为服务端私有设置保存。', 'error')
  }
  saving.value = true
  try {
    if (isBoolSetting(form) && !form.IsSecret) form.Value = formBoolValue.value ? 'true' : 'false'
    const result = await client.post('/api/TenantSystemSettings/Save', savePayload(form, form.Value))
    if (result?.Code !== 1) throw new Error(result?.Msg || '保存失败。')
    closeEditor(); await load(); message('租户系统设置已安全保存。')
  } catch (error) { message(error?.Msg || error?.message || '保存失败。', 'error') }
  finally { saving.value = false }
}

async function toggleBool(item) {
  const id = String(item?.Id || '')
  if (!id || isBoolSaving(item)) return
  const next = !boolValue(item.ConfigValue)
  boolSavingIds.value = new Set([...boolSavingIds.value, id])
  try {
    const result = await client.post('/api/TenantSystemSettings/Save', savePayload({ ...item, ValueType: 'Bool', IsSecret: false }, next ? 'true' : 'false'))
    if (result?.Code !== 1) throw new Error(result?.Msg || '开关保存失败。')
    item.ConfigValue = next ? 'true' : 'false'
    message(`${settingTitle(item)}已${next ? '开启' : '关闭'}。`)
  } catch (error) { message(error?.Msg || error?.message || '开关保存失败。', 'error') }
  finally {
    const pending = new Set(boolSavingIds.value); pending.delete(id); boolSavingIds.value = pending
  }
}

function remove(item) { deleteTarget.value = item; resetDrag('delete') }
function cancelRemove() { if (deleting.value) return; deleteTarget.value = null; resetDrag('delete') }
async function confirmRemove() {
  const item = deleteTarget.value
  if (!item || deleting.value) return
  deleting.value = true
  try {
    const result = await client.post('/api/TenantSystemSettings/Delete', { Id: item.Id })
    if (result?.Code !== 1) throw new Error(result?.Msg || '删除失败。')
    rows.value = rows.value.filter((row) => row.Id !== item.Id)
    deleteTarget.value = null; message('设置已删除。')
  } catch (error) { message(error?.Msg || error?.message || '删除失败。', 'error') }
  finally { deleting.value = false }
}

function requestTotp(item) {
  if (totpResolver) totpResolver(null)
  totp.key = item?.ConfigKey || ''; totp.code = ''; totp.error = ''; totp.visible = true; resetDrag('totp')
  return new Promise((resolve) => { totpResolver = resolve })
}
function submitTotp() {
  if (!/^\d{6}$/.test(totp.code)) { totp.error = '请输入 Authenticator 中的 6 位数字。'; return }
  const resolver = totpResolver; const code = totp.code
  totpResolver = null; totp.visible = false; totp.code = ''; totp.error = ''; resolver?.(code)
}
function closeTotp() {
  const resolver = totpResolver
  totpResolver = null; totp.visible = false; totp.key = ''; totp.code = ''; totp.error = ''; resetDrag('totp'); resolver?.(null)
}

async function revealSecret(item) {
  try {
    const challenge = await client.post('/api/TenantSystemSettings/GetRevealChallenge', { Id: item.Id })
    if (challenge?.Code !== 1) throw new Error(challenge?.Msg || '显示挑战创建失败。')
    const caps = await capabilities(client, context.osClient)
    let verification
    if (caps.HasStepUpPasskey) {
      verification = await verifyPasskey(client, { osClient: context.osClient, purpose: challenge.Data.Purpose, actionHash: challenge.Data.ActionHash })
    } else if (caps.HasStepUpTotp) {
      const code = await requestTotp(item)
      if (!code) return
      verification = await verifyTotp(client, { osClient: context.osClient, code, purpose: challenge.Data.Purpose, actionHash: challenge.Data.ActionHash })
    } else if (caps.HasFace) {
      verification = await verifyFace(client, { osClient: context.osClient, purpose: challenge.Data.Purpose, actionHash: challenge.Data.ActionHash })
    } else {
      throw new Error('请先在个人中心登记允许“二次验证”的 Passkey、Authenticator 或严格人脸。')
    }
    if (verification?.Code !== 1) throw new Error(verification?.Msg || '二次身份验证失败。')
    const result = await client.post('/api/TenantSystemSettings/Reveal', { Id: item.Id, Ticket: verification.Data?.Ticket })
    if (result?.Code !== 1) throw new Error(result?.Msg || 'Secret 显示失败。')
    showReveal(item, result.Data.Value, result.Data.ClearAfterSeconds || 30)
  } catch (error) { message(error?.Msg || error?.message || 'Secret 显示失败。', 'error') }
}

function showReveal(item, value, seconds) {
  clearReveal(); revealed.visible = true; revealed.title = settingTitle(item); revealed.key = item.ConfigKey; revealed.value = value; revealed.seconds = seconds; resetDrag('reveal')
  revealed.timer = setInterval(() => {
    revealed.seconds -= 1
    if (revealed.seconds <= 0) clearReveal()
  }, 1000)
}
function clearReveal() {
  clearInterval(revealed.timer); revealed.timer = null; revealed.visible = false; revealed.title = ''; revealed.key = ''; revealed.value = ''; revealed.seconds = 0; resetDrag('reveal')
}

function resetDrag(name) { if (dragOffsets[name]) { dragOffsets[name].x = 0; dragOffsets[name].y = 0 } }
function dragStyle(name) { const offset = dragOffsets[name] || { x: 0, y: 0 }; return { transform: `translate3d(${offset.x}px, ${offset.y}px, 0)` } }
function clampDrag(name, shell, nextX = dragOffsets[name]?.x || 0, nextY = dragOffsets[name]?.y || 0) {
  if (!shell || !dragOffsets[name]) return
  const boundary = shell.closest('dialog.modal-backdrop')?.getBoundingClientRect()
  const viewport = { left: boundary?.left || 0, top: boundary?.top || 0, right: boundary?.right || window.innerWidth, bottom: boundary?.bottom || window.innerHeight, width: boundary?.width || window.innerWidth }
  const gutter = viewport.width <= 760 ? 8 : 18; const current = dragOffsets[name]; const rect = shell.getBoundingClientRect()
  const baseLeft = rect.left - current.x; const baseRight = rect.right - current.x; const baseTop = rect.top - current.y; const baseBottom = rect.bottom - current.y
  const minX = viewport.left + gutter - baseLeft; const maxX = viewport.right - gutter - baseRight; const minY = viewport.top + gutter - baseTop; const maxY = viewport.bottom - gutter - baseBottom
  current.x = Math.round(Math.max(Math.min(minX, maxX), Math.min(Math.max(minX, maxX), nextX)))
  current.y = Math.round(Math.max(Math.min(minY, maxY), Math.min(Math.max(minY, maxY), nextY)))
}
function clampOpenDialogs() { document.querySelectorAll('.modal-shell[data-drag-name]').forEach((shell) => clampDrag(shell.dataset.dragName, shell)) }
function startDrag(event, name) {
  if (event.button !== 0 || event.target.closest('button,input,select,textarea,a')) return
  const shell = event.currentTarget.closest('.modal-shell'); if (!shell) return
  event.preventDefault()
  const startX = event.clientX; const startY = event.clientY; const originX = dragOffsets[name].x; const originY = dragOffsets[name].y
  const move = (current) => clampDrag(name, shell, originX + current.clientX - startX, originY + current.clientY - startY)
  const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up) }
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up, { once: true }); window.addEventListener('pointercancel', up, { once: true })
}

let modalDocumentScrollState = null
function syncModalDocumentScrollLock(visible) {
  const root = document.documentElement; const body = document.body
  if (!root || !body) return
  if (visible) {
    if (modalDocumentScrollState) return
    modalDocumentScrollState = { rootOverflow: root.style.overflow, bodyOverflow: body.style.overflow }
    root.style.overflow = 'hidden'; body.style.overflow = 'hidden'; return
  }
  if (!modalDocumentScrollState) return
  root.style.overflow = modalDocumentScrollState.rootOverflow; body.style.overflow = modalDocumentScrollState.bodyOverflow; modalDocumentScrollState = null
}
function publishHostOverlay(visible) {
  dispatch('micro-app:host-action', { action: 'setGlobalOverlay', requestId: `settings-overlay-${Date.now()}`, visible, blur: !context.disableFormMaskBlur, lockScroll: visible, nativeTopLayer: visible && nativeTopLayerAvailable.value, mask: false, promote: false, silent: true }, { force: true })
}
async function presentNativeDialog(dialogRef, visible, focusRef = null) {
  await nextTick()
  const dialog = dialogRef.value
  if (!visible || !dialog) return
  if (!nativeTopLayerAvailable.value) dialog.setAttribute('open', '')
  else {
    try { if (!dialog.open) dialog.showModal() }
    catch (_) { nativeTopLayerAvailable.value = false; dialog.setAttribute('open', '') }
  }
  if (focusRef) await nextTick(() => focusRef.value?.focus?.())
}

watch(editorVisible, (visible) => presentNativeDialog(editorDialog, visible), { flush: 'post' })
watch(deleteTarget, (value) => presentNativeDialog(deleteDialog, Boolean(value)), { flush: 'post' })
watch(() => totp.visible, (visible) => presentNativeDialog(totpDialog, visible, totpInput), { flush: 'post' })
watch(() => revealed.visible, (visible) => presentNativeDialog(revealDialog, visible), { flush: 'post' })
watch(anyModalOpen, (visible) => { syncModalDocumentScrollLock(visible); publishHostOverlay(visible) }, { flush: 'post' })

let unsubscribeContext = () => {}
onMounted(() => {
  window.addEventListener('resize', clampOpenDialogs)
  unsubscribeContext = subscribeContext((nextContext) => Object.assign(context, nextContext))
  load()
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', clampOpenDialogs)
  unsubscribeContext(); clearReveal(); closeTotp(); syncModalDocumentScrollLock(false)
  dispatch('micro-app:host-action', { action: 'setGlobalOverlay', requestId: `settings-overlay-close-${Date.now()}`, visible: false, lockScroll: false, promote: false, silent: true }, { force: true })
})
</script>

<style scoped src="./system-settings.css"></style>
