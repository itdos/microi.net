<template>
  <CustomPage title="修改密码" :is-h5-demo-page="isDemoH5Page"  page-bg-color="#f8f7f8">
    <view class="fromBg">
      <view class="tn-white_bg tn-radius tn-p tn-shadow ">
        <TnForm ref="formRef" label-width="180"
        :model="formData" :rules="formRules">
          <TnFormItem label="旧密码" prop="oldPassword" class="fromBg-item">
            <TnInput v-model="formData.oldPassword" type="password" placeholder="请输入旧密码"
            :custom-style="customInputStyle" height="80" clearable >
            </TnInput>
          </TnFormItem>
          <TnFormItem label="新密码" prop="newPassword" class="fromBg-item">
            <TnInput v-model="formData.newPassword" type="password" placeholder="请输入新密码"
            :custom-style="customInputStyle" height="80" clearable>
            </TnInput>
          </TnFormItem>
          <TnFormItem label="确认新密码" prop="confirmNewPassword" class="fromBg-item">
            <TnInput v-model="formData.confirmNewPassword" type="password" placeholder="请输入新密码"
            :custom-style="customInputStyle" height="80" clearable>
            </TnInput>
          </TnFormItem>
        </TnForm>
      </view>
      <view class="tn-mt tn-flex-center tn-mt-xl">
        <TnButton size="lg" width="100%" height="80" @click="submitForm"> 提交 </TnButton>
      </view>
		</view>
  </CustomPage>
</template>

<script lang="ts" setup>
  import CustomPage from '@/components/custom-page/src/custom-page.vue'
	import { useDemoH5Page } from '@/hooks'
  import { ref, reactive } from 'vue'
  import TnForm from '@tuniao/tnui-vue3-uniapp/components/form/src/form.vue'
  import TnFormItem from '@tuniao/tnui-vue3-uniapp/components/form/src/form-item.vue'
  import TnInput from '@tuniao/tnui-vue3-uniapp/components/input/src/input.vue'
  import TnButton from '@tuniao/tnui-vue3-uniapp/components/button/src/button.vue'
  // import { useUser } from '@/stores';
	import microiRequest from '@/config/api';
	import type { CSSProperties } from 'vue'
  const { isDemoH5Page } = useDemoH5Page()
  const userInfo = uni.getStorageSync('userInfo')
  const formRef = ref<any>(null)
  const formData = reactive({
    oldPassword: '',
    newPassword: '',
    confirmNewPassword: ''
  })
  const validateRePassword = (rule: any, value: any, callback: any) => {
  if (value === '') {
    callback(new Error('请再次输入密码'))
  } else if (value !== formData.newPassword) {
    callback(new Error('两次输入密码不一致!'))
  } else {
    callback()
  }
}
  const formRules = reactive({
    oldPassword: [
      {
        required: true,
        message: '请输入旧密码',
      },
    ],
    newPassword: [
      {
        required: true,
        message: '请输入新密码',
      },
    ],
    confirmNewPassword: [
      {
        validator: validateRePassword,
        required: true,
      },
    ],
  })
  // 自定义样式
	const customInputStyle: CSSProperties = { 
		background: 'white',
	}
  // 点击提交啦
  const submitForm = () => {
    formRef.value?.validate(async (valid: boolean) => {
      if (valid) {
        console.log('submit!')
        const obj = {
          id: userInfo?.Id,
          Pwd: Base64.encode(formData.oldPassword),
          NewPwd: Base64.encode(formData.newPassword)
        }
        const res = await microiRequest.uptsysuser(obj)
        if (res.Code == 1) {
          uni.showToast({
            title: '修改成功',
            icon: 'none',
          })
          uni.navigateBack({
            delta: 1
          });
        } else {
          uni.showToast({
						  title: '修改失败',
							icon: 'none',
						})
        }
      } else {
        console.log('error submit!!')
        return false
      }
    })
  }
</script>

<style lang="scss" scoped>
.fromBg {
  height: 90vh;
}
</style>