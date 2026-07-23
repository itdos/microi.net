<template>
  <mci-page-shell class="member-page" :style="mciTokenStyle" title="新增成员" subtitle="组织与角色" @back="goBack">
    <mci-skeleton v-if="loading" type="form" :rows="5" />
    <scroll-view v-else class="page-scroll" scroll-y>
      <view class="page-content">
        <view class="form-panel">
          <view class="field-row"><text class="field-label">姓名</text><input v-model="form.name" class="field-input" placeholder="请输入姓名" maxlength="30" /></view>
          <view class="field-row"><text class="field-label">手机号码</text><input v-model="form.phone" class="field-input" type="number" placeholder="请输入成员手机号码" maxlength="11" /></view>
          <view class="field-row"><text class="field-label">初始密码</text><input v-model="form.password" class="field-input" password placeholder="请输入初始密码" maxlength="32" /></view>
          <view class="field-row"><text class="field-label">所属机构</text><text class="field-value">{{ currentUser.DeptName || currentUser.TenantName || '当前组织' }}</text></view>
        </view>

        <view class="section-title"><text>选择角色</text><text>{{ selectedRoles.length }} 项</text></view>
        <view class="role-panel">
          <view v-if="!roles.length" class="empty-role"><text>暂无可选角色</text></view>
          <view v-for="role in roles" :key="role.Id" class="role-row" :class="{ selected: isSelected(role) }" @tap="toggleRole(role)">
            <view class="role-copy"><text class="role-name">{{ role.Name }}</text><text v-if="role.Remark" class="role-note">{{ role.Remark }}</text></view>
            <view class="check-box"><text v-if="isSelected(role)">✓</text></view>
          </view>
        </view>
      </view>
    </scroll-view>
    <view v-if="!loading" class="bottom-bar" slot="fixed"><button class="primary-button" :loading="submitting" :disabled="submitting" @tap="submit">保存成员</button></view>
  </mci-page-shell>
</template>

<script>
import { getUser, post } from '@/utils/request.js'
import { callApiEngine } from '@/platform/business-runtime.js'
import { themeMixin } from '@/utils/theme.js'

export default {
  mixins: [themeMixin],
  data() {
    return { loading: true, submitting: false, currentUser: {}, roles: [], selectedRoleIds: [], form: { name: '', phone: '', password: '123456' } }
  },
  computed: {
    selectedRoles() { return this.roles.filter((role) => this.selectedRoleIds.includes(String(role.Id))) }
  },
  async onLoad() {
    this.currentUser = getUser() || {}
    await this.loadRoles()
  },
  methods: {
    goBack() { uni.navigateBack() },
    async loadRoles() {
      this.loading = true
      try {
        const result = await post('/api/SysRole/GetSysRole', {})
        if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || '角色加载失败')
        this.roles = Array.isArray(result.Data) ? result.Data : []
      } catch (error) {
        this.roles = []
        uni.showToast({ title: error.message || '角色加载失败', icon: 'none' })
      } finally {
        this.loading = false
      }
    },
    isSelected(role) { return this.selectedRoleIds.includes(String(role.Id)) },
    toggleRole(role) {
      const id = String(role.Id)
      const index = this.selectedRoleIds.indexOf(id)
      if (index >= 0) this.selectedRoleIds.splice(index, 1)
      else this.selectedRoleIds.push(id)
    },
    async submit() {
      if (this.submitting) return
      try {
        if (!this.form.name.trim()) throw new Error('请输入成员姓名')
        if (!/^1[3-9]\d{9}$/.test(this.form.phone)) throw new Error('请输入正确的手机号码')
        if (!this.form.password || this.form.password.length < 6) throw new Error('初始密码至少需要 6 位')
        if (!this.selectedRoles.length) throw new Error('请至少选择一个角色')
        this.submitting = true
        const user = this.currentUser
        const result = await callApiEngine('AddMember', {
          Name: this.form.name.trim(),
          phone: this.form.phone,
          DeptName: user.DeptName || '',
          DeptIds: user.DeptIds || '',
          DeptId: user.DeptId || '',
          DeptCode: user.DeptCode || '',
          RoleIds: JSON.stringify(this.selectedRoles.map((role) => ({ Id: role.Id, Name: role.Name, Level: role.Level }))),
          CompanyName: user.CompanyName || '',
          CompanyId: user.CompanyId || '',
          CompanyCode: user.CompanyCode || '',
          TenantName: user.TenantName || '',
          TenantId: user.TenantId || '',
          Pwd: this.form.password
        })
        if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || '成员新增失败')
        uni.showToast({ title: '成员已新增', icon: 'success' })
        uni.$emit('xjy:members:refresh')
        setTimeout(() => uni.navigateBack(), 900)
      } catch (error) {
        uni.showToast({ title: error.message || '成员新增失败', icon: 'none' })
      } finally {
        this.submitting = false
      }
    }
  }
}
</script>

<style scoped>
.page-scroll { height: calc(100vh - 92rpx - var(--mci-safe-top) - 116rpx - var(--mci-safe-bottom)); }
.page-content { padding: 24rpx; }
.form-panel, .role-panel { border: 1rpx solid #e0eaee; border-radius: 8rpx; overflow: hidden; background: #fff; }
.field-row { display: flex; flex-direction: column; min-height: 116rpx; padding: 18rpx 24rpx 14rpx; border-bottom: 1rpx solid #edf3f5; }
.field-row:last-child { border-bottom: none; }
.field-label { color: #607983; font-size: 22rpx; }
.field-input, .field-value { height: 58rpx; margin-top: 5rpx; color: #17313b; font-size: 27rpx; line-height: 58rpx; }
.section-title { display: flex; align-items: center; justify-content: space-between; padding: 26rpx 4rpx 14rpx; color: #526c77; font-size: 23rpx; }
.role-row { display: grid; grid-template-columns: minmax(0, 1fr) 44rpx; align-items: center; min-height: 94rpx; padding: 12rpx 24rpx; border-bottom: 1rpx solid #edf3f5; transition: background-color 150ms ease; }
.role-row:last-child { border-bottom: none; }
.role-row.selected { background: #f0f9fc; }
.role-copy { display: flex; flex-direction: column; min-width: 0; }
.role-name { color: #294752; font-size: 26rpx; font-weight: 600; }
.role-note { margin-top: 4rpx; overflow: hidden; color: #82969e; font-size: 20rpx; text-overflow: ellipsis; white-space: nowrap; }
.check-box { display: flex; align-items: center; justify-content: center; width: 38rpx; height: 38rpx; border: 2rpx solid #b9cbd2; border-radius: 5rpx; color: #fff; font-size: 24rpx; }
.selected .check-box { border-color: #0782c2; background: #0782c2; }
.empty-role { padding: 48rpx; color: #8498a0; font-size: 24rpx; text-align: center; }
.bottom-bar { position: fixed; right: 0; bottom: 0; left: 0; z-index: 18; padding: 16rpx 24rpx calc(16rpx + var(--mci-safe-bottom)); border-top: 1rpx solid #e0eaee; background: rgba(255,255,255,.97); }
.primary-button { height: 82rpx; border-radius: 8rpx; background: #087ebd; color: #fff; font-size: 27rpx; font-weight: 650; line-height: 82rpx; }
.primary-button::after { border: none; }
.primary-button[disabled] { background: #9bbbc9; color: #fff; }
@media (prefers-reduced-motion: reduce) { .role-row { transition: none; } }
</style>
