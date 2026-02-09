<template>
  <view class="container">
    <uni-section title="" type="">
			<view class="example">
				<!-- 基础表单校验 -->
				<uni-forms ref="valiForm" :model="formData" :rules="rules" labelWidth="80px">
					<uni-forms-item label="OsClient" required name="OsClient">
						<uni-easyinput v-model="formData.OsClient" placeholder="请输入OsClient" />
					</uni-forms-item>
					<uni-forms-item label="服务器地址" required name="ApiBase">
						<uni-easyinput v-model="formData.ApiBase" placeholder="请输入服务器地址" type="text" />
					</uni-forms-item>
				</uni-forms>
				<button type="primary" @click="submit('valiForm')">提交</button>
			</view>
		</uni-section>
  </view>
</template>

<script setup>
import { ref, inject, reactive } from 'vue'
const Microi = inject('Microi'); // 使用注入Microi实例
const valiForm = ref(null)
const formData = reactive({
  OsClient: uni.getStorageSync('OsClient') || 'iTdos',
  ApiBase: uni.getStorageSync('ApiBase') || 'https://api-china.itdos.com',
})
const rules = ref({
  OsClient: {
    rules: [{
      required: true,
      errorMessage: '请输入账号'
    }]
  },
  ApiBase: {
    rules: [{
      required: true,
      errorMessage: '请输入密码'
    }]
  }
})
const submit = () => {
  valiForm.value.validate().then(res => {
    uni.setStorageSync('OsClient', formData.OsClient? formData.OsClient : 'iTdos')
    uni.setStorageSync('ApiBase', formData.ApiBase? formData.ApiBase : 'https://api-china.itdos.com')
    Microi.InitApi() // 更新api地址
    Microi.SetToken(''); // 清空token
    Microi.SetCurrentUser(''); // 清空用户信息
    // 关闭所有页面跳转登录页
    uni.reLaunch({
      url: '/pages/mine/login/login'
    })
  }).catch(err => {
    console.log('err', err);
  })
}
</script>

<style scoped>
.example {
  padding: 15px;
  background-color: #fff;
}
</style>