<template>
  <CustomPage title="编辑服务器信息" :is-h5-demo-page="!isDemoH5Page"  page-bg-color="#f8f7f8">
    <view class="fromBg">
      <view class="tn-white_bg tn-radius tn-p tn-shadow ">
        <TnForm ref="formRef" label-width="180"
        :model="formData">
          <TnFormItem label="OsClient" prop="OsClient" class="fromBg-item">
            <TnInput v-model="formData.OsClient" type="text" placeholder="iTdos"
            :custom-style="customInputStyle" height="80" clearable >
            </TnInput>
          </TnFormItem>
          <TnFormItem label="服务器地址" prop="ApiBase" class="fromBg-item">
            <TnInput v-model="formData.ApiBase" type="text" placeholder="https://api-china.itdos.com"
            :custom-style="customInputStyle" height="80" clearable>
            </TnInput>
          </TnFormItem>
        </TnForm>
      </view>
      <view class="tn-mt tn-flex-center tn-mt-xl">
        <TnButton size="lg" width="100%" height="80" @click="submitForm"> 保存 </TnButton>
      </view>
		</view>
  </CustomPage>
</template>

<script lang="ts" setup>
  import CustomPage from '@/components/custom-page/src/custom-page.vue'
	import { useDemoH5Page } from '@/hooks'
  import { ref, reactive, inject } from 'vue'
  import TnForm from '@tuniao/tnui-vue3-uniapp/components/form/src/form.vue'
  import TnFormItem from '@tuniao/tnui-vue3-uniapp/components/form/src/form-item.vue'
  import TnInput from '@tuniao/tnui-vue3-uniapp/components/input/src/input.vue'
  import TnButton from '@tuniao/tnui-vue3-uniapp/components/button/src/button.vue'
  // import { useUser } from '@/stores';
	import microiRequest from '@/config/api';
	import type { CSSProperties } from 'vue'
	const Microi: any = inject('Microi'); // 使用注入Microi实例
  const { isDemoH5Page } = useDemoH5Page()
  const userInfo = uni.getStorageSync('userInfo')
  const formRef = ref<any>(null)
  const formData = reactive({
    OsClient: uni.getStorageSync('OsClient') || 'iTdos',
    ApiBase: uni.getStorageSync('ApiBase') || 'https://api-china.itdos.com',
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
        uni.setStorageSync('OsClient', formData.OsClient? formData.OsClient : 'iTdos')
        uni.setStorageSync('ApiBase', formData.ApiBase? formData.ApiBase : 'https://api-china.itdos.com')
        // 跳转到登录页面
        // 返回上一页
        uni.$emit('refreshData');
        uni.navigateBack()
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