
<script setup lang="ts">
	import TnAvatar from '@tuniao/tnui-vue3-uniapp/components/avatar/src/avatar.vue'
	import { inject, reactive, ref } from 'vue'
	import TnForm from '@tuniao/tnui-vue3-uniapp/components/form/src/form.vue'
	import TnFormItem from '@tuniao/tnui-vue3-uniapp/components/form/src/form-item.vue'
	import TnButton from '@tuniao/tnui-vue3-uniapp/components/button/src/button.vue'
	import TnInput from '@tuniao/tnui-vue3-uniapp/components/input/src/input.vue'
	import type { FormRules, TnFormInstance } from '@tuniao/tnui-vue3-uniapp'
	import microiRequest from '@/config/api';
	import { tnNavPage } from '@tuniao/tnui-vue3-uniapp/utils'
	import type { CSSProperties } from 'vue'
	const formRef = ref<TnFormInstance>()
	const Microi: any = inject('Microi'); // 使用注入Microi实例
	
	// 自定义样式
	const customInputStyle: CSSProperties = { 
		background: 'white',
	}
	const CaptchaData = ref<any>()
	const msgTxt = ref<string>('获取验证码')
	// 表单数据
	const formData = reactive({
	  username: '',
		password: '',
		confirmPassword: '',
		Code: '',
		msgCode: '',
	})
	// 获取图形验证码
	const getCaptcha = async () => {
		var result = await Microi.GetCaptcha();
		CaptchaData.value = result
	}
	getCaptcha()
	const validateRePassword = (rule: any, value: any, callback: any) => {
		if (value === '') {
			callback(new Error('请再次输入密码'))
		} else if (value !== formData.password) {
			callback(new Error('两次输入密码不一致!'))
		} else {
			callback()
		}
	}
	// 规则
	const formRules: FormRules = {
	  username: [
	    { required: true, message: '请输入手机号', trigger: ['change', 'blur'] },
	    // {
	    //   pattern: /^[\w-]{4,16}$/,
	    //   message: '请输入手机号',
	    //   trigger: ['change', 'blur'],
	    // },
	  ],
		password: [
		  { required: true, message: '请输入密码', trigger: ['change', 'blur'] },
		  {
		    // pattern: /^\S*(?=\S{6,})(?=\S*\d)(?=\S*[A-Z])(?=\S*[a-z])(?=\S*[!@#$%^&*? ])\S*$/,
		    message: '密码必须包含大小写字母、数字和特殊符号，且不少于6位',
		    trigger: ['change', 'blur'],
		  },
		],
		confirmPassword: [
      {
        validator: validateRePassword,
        required: true,
      },
    ],
		Code: [
			{
        required: true,
        message: '请输入图形验证码',
      },
		],
		msgCode: [
			{
        required: true,
        message: '请输入短信验证码',
      },
		]
	}
	// 获取短信验证码
	const sendCode = async () => {
		if (!formData.username) {
			uni.showToast({
				title: '请输入手机号',
				icon: 'none',
			})
			return
		}
		if (!formData.Code) {
			uni.showToast({
				title: '请输入图形验证码',
				icon: 'none',
			})
			return
		}
		const data = {
			OsClient: Microi.OsClient,
			Phone: formData.username,
			_CaptchaId: CaptchaData.value.captchaid,
			_CaptchaValue: formData.Code
		}
		const res = await microiRequest.sendMsg(data)
		console.log(res)
	}
	/* 提交表单 */
	const submitForm = () => {
	  formRef.value?.validate(async (valid: any) => {
	    if (valid) {
				try {
					const obj = {
						Account: formData.username,
						Pwd: formData.password,
						OsClient: Microi.OsClient
					}
					// const data = await microiRequest.login(obj);
					// if (data.Code == 1) {
					// 	uni.showToast({
					// 	  title: '登陆成功',
					// 		icon: 'none',
					// 	})
					// 	uni.navigateBack({
					// 		delta: 1
					// 	});
					// } else {
					// 	uni.showToast({
					// 	  title: data.Msg,
					// 		icon: 'none',
					// 	})
					// }
				} catch (error) {
					console.error(error);
					// 在这里可以进行错误处理，比如提示用户或进行其他操作
				}
	    } else {
	      uni.showToast({
	        title: '表单校验失败',
	        icon: 'none',
	      })
	    }
	  })
	}
</script>

<template>
	<view class="page tn-gradient-bg__blue-light">
		<view class="flex-container--has-height tn-w-full tn-flex tn-flex-center avatar-img">
			<TnAvatar url="https://resource.tuniaokj.com/images/avatar/test_avatar.jpg" size="160"/>
		</view>
		<view class="fromBg">
			<TnForm ref="formRef" label-width="140"
			:model="formData" :rules="formRules">
				<TnFormItem label="" prop="username" class="fromBg-item">
					<TnInput v-model="formData.username" placeholder="请输入手机号" class="tn-shadow-md"
					 :custom-style="customInputStyle" height="80" :border="false" clearable >
					 <template #prefix>
							<TnIcon name="my-lack-fill" />
						</template>
					</TnInput>
				</TnFormItem>
				<TnFormItem label="" prop="password" class="fromBg-item">
					<TnInput v-model="formData.password" type="password" placeholder="请输入密码" class="tn-shadow-md"
					:custom-style="customInputStyle" height="80" :border="false" clearable>
					<template #prefix>
							<TnIcon name="trusty-fill" />
						</template>
					</TnInput>
				</TnFormItem>
				<TnFormItem label="" prop="confirmPassword" class="fromBg-item">
					<TnInput v-model="formData.confirmPassword" type="password" placeholder="请再次输入密码" class="tn-shadow-md"
					:custom-style="customInputStyle" height="80" :border="false" clearable>
					<template #prefix>
							<TnIcon name="trusty-fill" />
						</template>
					</TnInput>
				</TnFormItem>
				<TnFormItem label="" prop="Code" class="fromBg-item">
					<TnInput v-model="formData.Code" placeholder="请输入图形验证码" :custom-style="customInputStyle">
						<template #prefix>
							<TnIcon name="email-fill" />
						</template>
						<template #suffix>
							<image class="img" @click="getCaptcha()" :src="CaptchaData?.url"></image>
						</template>
					</TnInput>
				</TnFormItem>
				<TnFormItem label="" prop="msgCode" class="fromBg-item">
					<TnInput v-model="formData.msgCode" placeholder="请输入短信验证码" :custom-style="customInputStyle">
						<template #prefix>
							<TnIcon name="email-fill" />
						</template>
						<template #suffix>
							<TnButton @click="sendCode">{{ msgTxt}}</TnButton>
						</template>
					</TnInput>
				</TnFormItem>
			</TnForm>
		</view>
		<view class="tn-mt tn-flex-center btn">
			<TnButton size="lg" width="100%" height="80" shadow shadow-color="tn-gray" @click="submitForm"> 提交 </TnButton>
		</view>
	</view>
</template>

<style lang="scss" scoped>
@import './style/index.scss';
.img{
	width: 150rpx;
	height: 40rpx;
}
</style>