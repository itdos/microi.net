const API = '/api/IdentityVerification'
const EXTERNAL_API = '/api/ExternalLogin'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function base64Url(buffer) {
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : new Uint8Array(buffer?.buffer || buffer || [])
  let binary = ''
  bytes.forEach((value) => { binary += String.fromCharCode(value) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function decodeBase64Url(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '='))
  return Uint8Array.from(binary, (item) => item.charCodeAt(0)).buffer
}

function prepare(options = {}) {
  const value = { ...options, challenge: decodeBase64Url(options.challenge) }
  if (value.user?.id) value.user = { ...value.user, id: decodeBase64Url(value.user.id) }
  ;['allowCredentials', 'excludeCredentials'].forEach((key) => {
    if (Array.isArray(value[key])) value[key] = value[key].map((item) => ({ ...item, id: decodeBase64Url(item.id) }))
  })
  return value
}

function serialize(credential) {
  const response = credential?.response || {}
  const output = {
    id: credential.id,
    rawId: base64Url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment || null,
    clientExtensionResults: credential.getClientExtensionResults?.() || {},
    response: { clientDataJSON: base64Url(response.clientDataJSON) }
  }
  if (response.attestationObject) output.response.attestationObject = base64Url(response.attestationObject)
  if (response.authenticatorData) output.response.authenticatorData = base64Url(response.authenticatorData)
  if (response.signature) output.response.signature = base64Url(response.signature)
  if (response.userHandle) output.response.userHandle = base64Url(response.userHandle)
  if (response.getTransports) output.response.transports = response.getTransports()
  return output
}

function data(result) {
  if (!result || result.Code !== 1) throw new Error(result?.Msg || '身份验证请求失败。')
  return result.Data || {}
}

export function passkeySupported() {
  return window.isSecureContext && window.PublicKeyCredential && navigator.credentials?.get
}

export async function capabilities(client, osClient) {
  return data(await client.post(`${API}/GetCapabilities`, { OsClient: osClient }))
}

export async function listPasskeys(client) {
  return data(await client.post(`${API}/ListAuthenticators`, {}))
}

export async function listTotpAuthenticators(client) {
  return data(await client.post(`${API}/ListTotpAuthenticators`, {}))
}

function translatePasskeyError(error, publicKey = {}) {
  const rawMessage = String(error?.message || error || '')
  const rpId = String(publicKey?.rpId || publicKey?.rp?.id || '未返回')
  const origin = String(window.location?.origin || '未知')
  const hostname = String(window.location?.hostname || '未知')
  if (/relying party id|registrable domain suffix|\.well-known\/webauthn/i.test(rawMessage)) {
    return new Error(
      `无法使用生物识别：Passkey 域名配置与当前站点不匹配。当前页面域名为“${hostname}”，`
      + `后端下发的 RP ID 为“${rpId}”。请由租户管理员进入“系统设置 → 安全与服务接入”，`
      + `将 Passkey RP ID 设置为当前页面域名或它的可注册父域，把完整 Origin“${origin}”加入 PasskeyOrigins，`
      + '并确认使用 HTTPS；如必须跨站点，还需正确发布 /.well-known/webauthn 关联声明。保存后请重新登记通行密钥。'
    )
  }
  if (error?.name === 'NotAllowedError') return new Error('设备验证已取消、超时，或当前通行密钥不允许此用途。')
  if (error?.name === 'InvalidStateError') return new Error('该通行密钥已登记；如需重建，请先撤销旧通行密钥。')
  if (error?.name === 'SecurityError') {
    return new Error(`浏览器安全策略阻止了 Passkey。请检查 HTTPS、Passkey RP ID 与 PasskeyOrigins；当前站点：${origin}，RP ID：${rpId}。`)
  }
  return error instanceof Error ? error : new Error(rawMessage || '设备验证失败，请重试。')
}

function translateTotpFailure(value) {
  const rawMessage = String(value?.Msg || value?.message || value || '')
  if (!/computed authentication tag|authentication tag did not match|tag mismatch/i.test(rawMessage)) return value
  const message = 'Authenticator 密钥无法解密，通常是历史租户标识大小写不一致，或绑定后 AuthSecret 发生变化。'
    + '请先使用账号密码登录，在“个人中心 → 验证器”移除并重新登记 Authenticator；'
    + '管理员同时检查 SaaS 引擎 sys_osclients.AuthSecret 是否稳定且所有后端节点一致。'
  if (value instanceof Error) return new Error(message)
  return { ...(value || {}), Code: value?.Code ?? 0, Msg: message }
}

async function requestPasskeyCredential(operation, publicKey) {
  try {
    return await navigator.credentials[operation]({ publicKey: prepare(publicKey) })
  } catch (error) {
    throw translatePasskeyError(error, publicKey)
  }
}

export async function beginTotpEnrollment(client) {
  return data(await client.post(`${API}/BeginTotpEnrollment`, {}))
}

export async function completeTotpEnrollment(client, payload) {
  return client.post(`${API}/CompleteTotpEnrollment`, payload || {})
}

export async function updateAuthenticatorPolicy(client, payload) {
  return client.post(`${API}/UpdateAuthenticatorPolicy`, payload || {})
}

export async function revokeTotpAuthenticator(client, id) {
  return client.post(`${API}/RevokeTotpAuthenticator`, { Id: id })
}

export async function registerPasskey(client, name = '我的 Passkey') {
  if (!passkeySupported() || !navigator.credentials.create) throw new Error('当前浏览器不支持 Passkey 或不在安全上下文。')
  const begin = data(await client.post(`${API}/BeginPasskeyRegistration`, { DeviceName: name }))
  const credential = await requestPasskeyCredential('create', begin.PublicKey)
  return client.post(`${API}/CompletePasskeyRegistration`, {
    ChallengeId: begin.ChallengeId,
    Response: serialize(credential),
    DeviceName: name
  })
}

export async function verifyPasskey(client, { osClient, account = '', purpose, actionHash }) {
  if (!passkeySupported()) throw new Error('当前浏览器不支持 Passkey 或不在安全上下文。')
  const begin = data(await client.post(`${API}/BeginPasskeyAuthentication`, {
    OsClient: osClient, Account: account, Purpose: purpose, ActionHash: actionHash
  }))
  const credential = await requestPasskeyCredential('get', begin.PublicKey)
  return client.post(`${API}/CompletePasskeyAuthentication`, {
    OsClient: osClient,
    ChallengeId: begin.ChallengeId,
    Response: serialize(credential),
    _ClientType: 'PC'
  })
}

export async function verifyTotp(client, { osClient, account = '', code, purpose, actionHash = '' }) {
  try {
    return translateTotpFailure(await client.post(`${API}/VerifyTotp`, {
      OsClient: osClient,
      Account: account,
      Code: String(code || '').replace(/\D/g, '').slice(0, 6),
      Purpose: purpose,
      ActionHash: actionHash,
      _ClientType: 'PC'
    }))
  } catch (error) {
    throw translateTotpFailure(error)
  }
}

export async function listExternalBindings(client) {
  return data(await client.post(`${EXTERNAL_API}/ListBindings`, {}))
}

export async function revokeExternalBinding(client, id) {
  return client.post(`${EXTERNAL_API}/RevokeBinding`, { Id: id })
}

function waitForExternalPopup(popup, provider, expectedOrigin) {
  return new Promise((resolve, reject) => {
    let finished = false
    const cleanup = () => {
      window.removeEventListener('message', onMessage)
      clearInterval(closeWatcher)
      clearTimeout(timeout)
    }
    const finish = (callback) => {
      if (finished) return
      finished = true
      cleanup()
      callback()
    }
    const onMessage = (event) => {
      const payload = event.data || {}
      if (event.source !== popup || event.origin !== expectedOrigin || payload.type !== 'microi-external-login') return
      if (String(payload.provider || '').toLowerCase() !== String(provider || '').toLowerCase()) return
      finish(() => payload.success ? resolve(payload) : reject(new Error(payload.message || '外部账号绑定未完成。')))
    }
    window.addEventListener('message', onMessage)
    const closeWatcher = setInterval(() => {
      if (popup.closed) finish(() => reject(new Error('外部授权窗口已关闭。')))
    }, 500)
    const timeout = setTimeout(() => {
      try { popup.close() } catch (_) {}
      finish(() => reject(new Error('外部授权等待超时，请重试。')))
    }, 5 * 60 * 1000)
  })
}

export async function bindExternalIdentity(client, osClient, provider) {
  const providerKey = String(provider || '').trim()
  const popup = window.open('about:blank', `microi-external-bind-${providerKey.toLowerCase()}`, 'popup,width=720,height=760,resizable=yes,scrollbars=yes')
  if (!popup) throw new Error('浏览器阻止了授权窗口，请允许本站弹出窗口后重试。')
  try {
    popup.document.title = '正在创建外部账号绑定会话…'
    const begin = data(await client.post(`${EXTERNAL_API}/Begin`, {
      OsClient: osClient,
      Provider: providerKey,
      Mode: 'Bind',
      ReturnOrigin: window.location.origin
    }))
    const callbackOrigin = new URL(begin.CallbackUrl, window.location.href).origin
    popup.location.replace(begin.AuthorizeUrl)
    return await waitForExternalPopup(popup, providerKey, callbackOrigin)
  } catch (error) {
    try { popup.close() } catch (_) {}
    throw error
  }
}

export async function verifyFace(client, { osClient, account = '', purpose, actionHash = '', mode = 'Verify' }) {
  const popup = window.open('about:blank', 'microi-face-verification', 'popup,width=520,height=760')
  if (!popup) throw new Error('浏览器阻止了人脸验证窗口，请允许弹出窗口后重试。')
  try {
    popup.document.title = '正在创建人脸验证会话…'
    const begin = data(await client.post(`${API}/BeginFaceVerification`, {
      OsClient: osClient, Account: account, Purpose: purpose, ActionHash: actionHash, Mode: mode, ReturnUrl: location.href
    }))
    popup.location.replace(begin.SessionUrl)
    const deadline = Date.now() + Math.min(Number(begin.ExpiresInSeconds || 300), 300) * 1000
    while (Date.now() < deadline) {
      await sleep(1500)
      const result = await client.post(`${API}/CompleteFaceVerification`, {
        OsClient: osClient, ChallengeId: begin.ChallengeId, _ClientType: 'PC'
      })
      if (result?.Code === 1) {
        popup.close()
        return result
      }
      if (result?.Code !== 2) throw new Error(result?.Msg || '人脸核验失败。')
      if (popup.closed) throw new Error('人脸验证窗口已关闭。')
    }
    throw new Error('人脸验证已超时。')
  } finally {
    try { popup.close() } catch (_) {}
  }
}

export async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value || '')))
  return Array.from(new Uint8Array(digest), (item) => item.toString(16).padStart(2, '0')).join('')
}

export async function passwordActionHash(userId, encodedNewPassword) {
  return sha256Hex(`Microi:ChangePassword:v1:${userId || ''}:${encodedNewPassword || ''}`)
}

export function utf8Base64(value) {
  const bytes = new TextEncoder().encode(String(value || ''))
  let binary = ''
  bytes.forEach((item) => { binary += String.fromCharCode(item) })
  return btoa(binary)
}
