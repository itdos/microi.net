<script setup lang="ts">
	import TnAvatar from '@tuniao/tnui-vue3-uniapp/components/avatar/src/avatar.vue'
	import { inject, reactive, ref } from 'vue'
	import TnForm from '@tuniao/tnui-vue3-uniapp/components/form/src/form.vue'
	import TnFormItem from '@tuniao/tnui-vue3-uniapp/components/form/src/form-item.vue'
	import TnButton from '@tuniao/tnui-vue3-uniapp/components/button/src/button.vue'
	import TnInput from '@tuniao/tnui-vue3-uniapp/components/input/src/input.vue'
	import TnCheckbox from '@tuniao/tnui-vue3-uniapp/components/checkbox/src/checkbox.vue'
	import TnFooter from '@tuniao/tnui-vue3-uniapp/components/footer/src/footer.vue'
	import type { FormRules, TnFormInstance } from '@tuniao/tnui-vue3-uniapp'
	import microiRequest from '@/config/api';
	import { tnNavPage } from '@tuniao/tnui-vue3-uniapp/utils'
	// import { useUser } from '@/stores';
	import { GetServerPath } from '@/utils'
	import type { CSSProperties } from 'vue'
	import { onLoad, onShow } from '@dcloudio/uni-app'
import { set } from '@tuniao/tnui-vue3-uniapp/libs/lodash'
	const Microi: any = inject('Microi'); // 使用注入Microi实例
	const formRef = ref<TnFormInstance>()

	// const userStore = useUser()
	// 自定义样式
	const customInputStyle : CSSProperties = {
		background: 'white',
	}
	const agent = ref<boolean>(false) // 记住密码
	const AutoLogin = ref<boolean>(false) // 自动登录
	// 表单数据
	const formData = reactive({
		username: '',
		password: '',
		_CaptchaValue : '',
		_CaptchaId : '',
		_CaptchaSrc : '',
	})
	const sysConfigData = ref<any>({}) // 系统配置
	
	// 获取系统配置
	const GetSysConfig = async () => {
		const data = {
			OsClient: Microi.OsClient,
			_SearchEqual: {
				IsEnable: 1
			},
		}
		const res = await microiRequest.GetSysConfig(data)
		if (res.Code == 1) {
			sysConfigData.value = res.Data
		}
		if(res.Data.EnableCaptcha){
			GetCaptcha();
		}
		// console.log(res)
	}

	// 规则
	const formRules : FormRules = {
		username: [
			{ required: true, message: '请输入用户名', trigger: ['change', 'blur'] },
			{
				pattern: /^[\w-]{4,16}$/,
				message: '请输入4-16位英文、数字、下划线、横线',
				trigger: ['change', 'blur'],
			},
		],
		password: [
			{ required: true, message: '请输入密码', trigger: ['change', 'blur'] },
			{
				// pattern: /^\S*(?=\S{6,})(?=\S*\d)(?=\S*[A-Z])(?=\S*[a-z])(?=\S*[!@#$%^&*? ])\S*$/,
				message: '密码必须包含大小写字母、数字和特殊符号，且不少于6位',
				trigger: ['change', 'blur'],
			},
		],
	}
	// 如果有登录信息，则自动填充用户名和密码
	if (uni.getStorageSync('loginInfo')) {
		formData.username = uni.getStorageSync('loginInfo').username
		formData.password = uni.getStorageSync('loginInfo').password
		agent.value = true
	}
	// 如果有自动登录，则自动勾选
	if (uni.getStorageSync('AutoLogin')) {
		AutoLogin.value = JSON.parse(uni.getStorageSync('AutoLogin'))
	}
	/* 提交表单 */
	const submitForm = () => {
		formRef.value?.validate(async (valid : any) => {
			if (valid) {
				// 如果记住密码
				if (agent.value) {
					uni.setStorageSync('loginInfo', formData)
				} else {
					uni.removeStorageSync('loginInfo')
				}
				// 如果自动登录
				if (AutoLogin.value) {
					uni.setStorageSync('AutoLogin', JSON.stringify(AutoLogin.value))
				} else {
					uni.removeStorageSync('AutoLogin')
				}
				try {
					const obj = {
						Account: formData.username,
						Pwd: formData.password,
						OsClient: Microi.OsClient,
						_CaptchaId : formData._CaptchaId,
						_CaptchaValue : formData._CaptchaValue
					}
					const data = await microiRequest.login(obj);
					if (data.Code == 1) {
						uni.showToast({
							title: '登陆成功',
							icon: 'none',
						})
						// userStore.setUserInfo(data.Data)
						uni.setStorageSync('userInfo', data.Data)
						uni.reLaunch({
							url: '/pages/index/index'
						})
					} else {
						GetCaptcha();
						uni.showToast({
							title: data.Msg,
							icon: 'none',
						})
					}
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
	// 跳转去注册账号
	const goToRegister = () => {
		tnNavPage('/pages/login/register', 'navigateTo')
	}
	// 点击自动登录
	const changeAutoLogin = () => {
		if (AutoLogin.value) {
			agent.value = true
		}
	}
	const GetCaptcha = async () => {
		var result = await Microi.GetCaptcha();
		formData._CaptchaSrc = result.CaptchaSrc;
		formData._CaptchaId = result.CaptchaId;
	}
	// 如果未添加服务器配置，跳转到服务器配置页面
	if (uni.getStorageSync('OsClient') && uni.getStorageSync('ApiBase')) {
	} else {
		tnNavPage('/pages-user/server/index', 'navigateTo')
	}
	const isReload = ref(false)

	onShow(() => {
		// 修改服务器配置返回后刷新页面
		uni.$on('refreshData',() => {
			isReload.value = true
		})
		if (isReload.value) {
			isReload.value = false
			Microi.InitApi() // 更新api地址
			Microi.Init() // 初始化
		}
		console.log('Microi.Init',Microi)
		console.log('onShow',uni.getStorageSync('OsClient'))
		setTimeout(() => {
			GetSysConfig()
		}, 1000)
	})
</script>

<template>
	<view class="page tn-gradient-bg__blue-light"
		:style="GetServerPath(sysConfigData.AppLoginBgImg)?`background-image: url(${GetServerPath(sysConfigData.AppLoginBgImg)});background-size: cover;`: 'background: var(--tn-color-blue-light)'">
		<view class="flex-container--has-height tn-w-full tn-flex tn-flex-center avatar-img">
			<TnAvatar :url="GetServerPath(sysConfigData.SysLogo)" size="160" />
		</view>
		<view class="fromBg">
			<TnForm ref="formRef" label-width="140" :model="formData" :rules="formRules">
				<TnFormItem label="" prop="username" class="fromBg-item">
					<TnInput v-model="formData.username" placeholder="请输入用户名" class="tn-shadow-md"
						:custom-style="customInputStyle" height="80" :border="false" clearable>
						<template #prefix>
							<TnIcon name="my" />
						</template>
					</TnInput>
				</TnFormItem>
				<TnFormItem label="" prop="password" class="fromBg-item">
					<TnInput v-model="formData.password" type="password" placeholder="请输入密码" class="tn-shadow-md"
						:custom-style="customInputStyle" height="80" :border="false" clearable>
						<template #prefix>
							<TnIcon name="password" />
						</template>
					</TnInput>
				</TnFormItem>
				<TnFormItem v-if="sysConfigData.EnableCaptcha && formData._CaptchaSrc" label="" prop="_CaptchaValue" class="fromBg-item">
					<TnInput v-model="formData._CaptchaValue" placeholder="请输入图形验证码" class="tn-shadow-md"
						:custom-style="customInputStyle" height="80" :border="false" clearable>
						<template #prefix>
							<TnIcon name="safe" />
						</template>
						<template #suffix>
						    <image class="img" style="width: 120px;height: 40px;" @click="GetCaptcha()" :src="formData._CaptchaSrc"></image>
						</template>
					</TnInput>
				</TnFormItem>
			</TnForm>
			<view class="tn-mt tn-flex justify-between">
				<!-- <TnCheckbox v-model="agent">
					记住密码
				</TnCheckbox> -->
				<!-- <TnCheckbox v-model="AutoLogin" @change="changeAutoLogin">
						自动登录
				</TnCheckbox> -->
			</view>
		</view>
		<view class="tn-mt tn-flex-center btn">
			<TnButton size="lg" width="100%" height="80" shadow shadow-color="tn-gray" @click="submitForm"> 提交
			</TnButton>
		</view>
		<view class="tn-mt-xl tn-flex-center">
			<TnButton size="lg" width="100%" height="80" shadow shadow-color="tn-gray" type="danger" @click="tnNavPage('/pages-user/server/index', 'navigateTo')"> 修改服务器配置
			</TnButton>
		</view>
		<!-- <view class="tn-mt-xl tn-flex-center" @click="goToRegister">
			注册账号
		</view> -->
		<TnFooter :content="`© ${sysConfigData.CompanyName}`" text-color="#fff" offset-bottom="40" />
	</view>
</template>

<style lang="scss" scoped>
	@import './style/index.scss';
</style>