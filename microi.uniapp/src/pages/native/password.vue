<template>
  <mci-page-shell class="password-page" :style="mciTokenStyle" title="修改密码" subtitle="账号安全" @back="goBack">
    <mci-skeleton v-if="initializing" type="form" :rows="4" />
    <scroll-view v-else class="page-scroll" scroll-y>
      <view class="page-content">
        <view class="mode-switch">
          <view v-for="item in modes" :key="item.key" class="mode-item" :class="{ active: mode === item.key }" @tap="mode = item.key">
            <text>{{ item.label }}</text>
          </view>
        </view>

        <view v-if="mode === 'password'" class="form-panel">
          <view class="field-row">
            <text class="field-label">当前密码</text>
            <input v-model="passwordForm.oldPassword" class="field-input" password placeholder="请输入当前密码" maxlength="64" />
          </view>
          <view class="field-row">
            <text class="field-label">新密码</text>
            <input v-model="passwordForm.newPassword" class="field-input" password placeholder="请输入新密码" maxlength="64" />
          </view>
          <view class="field-row">
            <text class="field-label">确认新密码</text>
            <input v-model="passwordForm.confirmPassword" class="field-input" password placeholder="请再次输入新密码" maxlength="64" />
          </view>
        </view>

        <view v-else class="form-panel">
          <view class="field-row">
            <text class="field-label">手机号码</text>
            <input v-model="smsForm.phone" class="field-input" type="number" placeholder="请输入手机号码" maxlength="11" />
          </view>
          <view class="field-row field-row--code">
            <view class="field-main">
              <text class="field-label">短信验证码</text>
              <input v-model="smsForm.code" class="field-input" type="number" placeholder="请输入验证码" maxlength="8" />
            </view>
            <button class="code-button" :disabled="countdown > 0 || sending" @tap="prepareSms">{{ countdown > 0 ? `${countdown}s` : '获取验证码' }}</button>
          </view>
          <view class="field-row">
            <text class="field-label">新密码</text>
            <input v-model="smsForm.password" class="field-input" password placeholder="请输入新密码" maxlength="64" />
          </view>
          <view class="field-row">
            <text class="field-label">确认新密码</text>
            <input v-model="smsForm.confirmPassword" class="field-input" password placeholder="请再次输入新密码" maxlength="64" />
          </view>
        </view>
      </view>
    </scroll-view>

    <view v-if="!initializing" class="bottom-bar" slot="fixed">
      <button class="primary-button" :loading="submitting" :disabled="submitting" @tap="submit">保存密码</button>
    </view>

    <view v-if="captchaVisible" class="mask" @tap="closeCaptcha">
      <view class="captcha-dialog" @tap.stop>
        <view class="dialog-head">
          <text class="dialog-title">安全验证</text>
          <text class="dialog-close" @tap="closeCaptcha">×</text>
        </view>
        <image v-if="captchaImage" class="captcha-image" :src="captchaImage" mode="aspectFit" @tap="loadCaptcha" />
        <view v-else class="captcha-loading" @tap="loadCaptcha"><text>点击刷新验证码</text></view>
        <input v-model="captchaValue" class="captcha-input" placeholder="请输入图形验证码" maxlength="8" />
        <button class="primary-button" :loading="sending" :disabled="sending" @tap="sendSms">验证并发送</button>
      </view>
    </view>
  </mci-page-shell>
</template>

<script>
import appConfig from '@/config.js'
import { getUser, post } from '@/utils/request.js'
import { callApiEngine } from '@/platform/business-runtime.js'
import { themeMixin } from '@/utils/theme.js'

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function utf8Base64(value) {
  const bytes = unescape(encodeURIComponent(String(value || '')))
  let output = ''
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes.charCodeAt(index)
    const b = index + 1 < bytes.length ? bytes.charCodeAt(index + 1) : NaN
    const c = index + 2 < bytes.length ? bytes.charCodeAt(index + 2) : NaN
    output += BASE64_CHARS[a >> 2]
    output += BASE64_CHARS[((a & 3) << 4) | (Number.isNaN(b) ? 0 : b >> 4)]
    output += Number.isNaN(b) ? '=' : BASE64_CHARS[((b & 15) << 2) | (Number.isNaN(c) ? 0 : c >> 6)]
    output += Number.isNaN(c) ? '=' : BASE64_CHARS[c & 63]
  }
  return output
}

export default {
  mixins: [themeMixin],
  data() {
    return {
      initializing: true,
      submitting: false,
      sending: false,
      mode: 'password',
      modes: [{ key: 'password', label: '当前密码修改' }, { key: 'sms', label: '短信验证修改' }],
      currentUser: {},
      passwordForm: { oldPassword: '', newPassword: '', confirmPassword: '' },
      smsForm: { phone: '', code: '', password: '', confirmPassword: '' },
      captchaVisible: false,
      captchaImage: '',
      captchaId: '',
      captchaValue: '',
      countdown: 0,
      timer: null
    }
  },
  onLoad() {
    this.currentUser = getUser() || {}
    const phone = this.currentUser.Phone || (/^1[3-9]\d{9}$/.test(String(this.currentUser.Account || '')) ? this.currentUser.Account : '')
    this.smsForm.phone = phone
    setTimeout(() => { this.initializing = false }, 80)
  },
  onUnload() { if (this.timer) clearInterval(this.timer) },
  methods: {
    goBack() { uni.navigateBack() },
    validatePassword(password, confirmPassword) {
      if (!password || password.length < 6) throw new Error('新密码至少需要 6 位')
      if (password !== confirmPassword) throw new Error('两次输入的新密码不一致')
    },
    async submit() {
      if (this.submitting) return
      try {
        if (this.mode === 'password') {
          if (!this.passwordForm.oldPassword) throw new Error('请输入当前密码')
          this.validatePassword(this.passwordForm.newPassword, this.passwordForm.confirmPassword)
          this.submitting = true
          const result = await post('/api/SysUser/uptsysuser', {
            Id: this.currentUser.Id,
            Pwd: utf8Base64(this.passwordForm.oldPassword),
            NewPwd: utf8Base64(this.passwordForm.newPassword)
          })
          if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || '密码修改失败')
        } else {
          if (!/^1[3-9]\d{9}$/.test(this.smsForm.phone)) throw new Error('请输入正确的手机号码')
          if (!this.smsForm.code) throw new Error('请输入短信验证码')
          this.validatePassword(this.smsForm.password, this.smsForm.confirmPassword)
          this.submitting = true
          const result = await callApiEngine('getMsgCode', { account: this.smsForm.phone, code: this.smsForm.code, psw: this.smsForm.password })
          if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || '密码修改失败')
        }
        uni.showToast({ title: '密码已修改', icon: 'success' })
        setTimeout(() => uni.navigateBack(), 900)
      } catch (error) {
        uni.showToast({ title: error.message || '密码修改失败', icon: 'none' })
      } finally {
        this.submitting = false
      }
    },
    async prepareSms() {
      if (!/^1[3-9]\d{9}$/.test(this.smsForm.phone)) {
        uni.showToast({ title: '请输入正确的手机号码', icon: 'none' })
        return
      }
      this.captchaVisible = true
      this.captchaValue = ''
      await this.loadCaptcha()
    },
    async loadCaptcha() {
      this.captchaImage = ''
      try {
        const response = await uni.request({
          url: `${appConfig.apiBase}/api/Captcha/GetCaptcha`,
          method: 'GET',
          data: { OsClient: appConfig.osClient },
          header: { osclient: appConfig.osClient },
          responseType: 'arraybuffer'
        })
        const id = response && response.header && (response.header.captchaid || response.header.CaptchaId || response.header.Captchaid)
        if (!id || !response.data) throw new Error('验证码加载失败')
        this.captchaId = id
        this.captchaImage = `data:image/png;base64,${uni.arrayBufferToBase64(response.data)}`
      } catch (error) {
        uni.showToast({ title: '验证码加载失败', icon: 'none' })
      }
    },
    closeCaptcha() { if (!this.sending) this.captchaVisible = false },
    async sendSms() {
      if (!this.captchaValue.trim()) {
        uni.showToast({ title: '请输入图形验证码', icon: 'none' })
        return
      }
      this.sending = true
      try {
        const result = await callApiEngine('send_sms', {
          Phone: this.smsForm.phone,
          _CaptchaId: this.captchaId,
          _CaptchaValue: this.captchaValue.trim()
        })
        if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || '短信发送失败')
        this.captchaVisible = false
        this.startCountdown()
        uni.showToast({ title: '验证码已发送', icon: 'success' })
      } catch (error) {
        uni.showToast({ title: error.message || '短信发送失败', icon: 'none' })
        await this.loadCaptcha()
      } finally {
        this.sending = false
      }
    },
    startCountdown() {
      if (this.timer) clearInterval(this.timer)
      this.countdown = 60
      this.timer = setInterval(() => {
        this.countdown -= 1
        if (this.countdown <= 0) { clearInterval(this.timer); this.timer = null }
      }, 1000)
    }
  }
}
</script>

<style scoped>
.page-scroll { height: calc(100vh - 92rpx - var(--mci-safe-top) - 116rpx - var(--mci-safe-bottom)); }
.page-content { padding: 24rpx; }
.mode-switch { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 6rpx; border: 1rpx solid #dce8ed; border-radius: 8rpx; background: #edf4f6; }
.mode-item { display: flex; align-items: center; justify-content: center; height: 68rpx; border-radius: 6rpx; color: #687e88; font-size: 24rpx; transition: background-color 160ms ease, color 160ms ease, box-shadow 160ms ease; }
.mode-item.active { background: #fff; color: #087ebd; font-weight: 650; box-shadow: 0 4rpx 12rpx rgba(19, 73, 95, .09); }
.form-panel { margin-top: 20rpx; padding: 0 24rpx; border: 1rpx solid #e0eaee; border-radius: 8rpx; background: #fff; }
.field-row { display: flex; flex-direction: column; min-height: 122rpx; padding: 20rpx 0 16rpx; border-bottom: 1rpx solid #edf3f5; }
.field-row:last-child { border-bottom: none; }
.field-label { color: #526c77; font-size: 22rpx; }
.field-input { box-sizing: border-box; width: 100%; height: 58rpx; margin-top: 6rpx; color: #17313b; font-size: 27rpx; }
.field-row--code { display: grid; grid-template-columns: minmax(0, 1fr) 190rpx; gap: 18rpx; align-items: end; }
.field-main { min-width: 0; }
.code-button { width: 190rpx; height: 64rpx; margin: 0 0 6rpx; border: 1rpx solid #b8d8e5; border-radius: 7rpx; background: #eef8fb; color: #087ebd; font-size: 22rpx; line-height: 62rpx; }
.code-button::after, .primary-button::after { border: none; }
.bottom-bar { position: fixed; right: 0; bottom: 0; left: 0; z-index: 18; padding: 16rpx 24rpx calc(16rpx + var(--mci-safe-bottom)); border-top: 1rpx solid #e0eaee; background: rgba(255,255,255,.97); }
.primary-button { height: 82rpx; border-radius: 8rpx; background: #087ebd; color: #fff; font-size: 27rpx; font-weight: 650; line-height: 82rpx; }
.primary-button[disabled] { background: #9bbbc9; color: #fff; }
.mask { position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; padding: 32rpx; background: rgba(8, 29, 38, .48); }
.captcha-dialog { box-sizing: border-box; width: 100%; max-width: 620rpx; padding: 28rpx; border-radius: 8rpx; background: #fff; animation: dialogIn 180ms ease-out both; }
.dialog-head { display: flex; align-items: center; justify-content: space-between; }
.dialog-title { color: #17313b; font-size: 30rpx; font-weight: 700; }
.dialog-close { padding: 4rpx 8rpx; color: #76909a; font-size: 40rpx; }
.captcha-image, .captcha-loading { display: flex; align-items: center; justify-content: center; width: 300rpx; height: 112rpx; margin: 30rpx auto 18rpx; border: 1rpx solid #dce8ed; border-radius: 6rpx; background: #f4f8fa; color: #7b9099; font-size: 22rpx; }
.captcha-input { box-sizing: border-box; width: 100%; height: 78rpx; margin-bottom: 22rpx; padding: 0 20rpx; border: 1rpx solid #cfdfe5; border-radius: 7rpx; background: #fbfdfe; font-size: 26rpx; }
@keyframes dialogIn { from { opacity: 0; transform: translateY(20rpx) scale(.98); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .mode-item, .captcha-dialog { animation: none; transition: none; } }
</style>
