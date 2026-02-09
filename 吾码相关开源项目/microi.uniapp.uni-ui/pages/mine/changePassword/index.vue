<template>
  <view class="container">
			<view class="example bg-white rounded-lg shadow-sm">
				<!-- 基础表单校验 -->
				<uni-forms ref="valiForm" :rules="rules" :model="valiFormData" labelWidth="100px">
					<uni-forms-item label="原密码" required name="oldPassword">
						<uni-easyinput v-model="valiFormData.oldPassword" placeholder="请输入原密码" type="password" />
					</uni-forms-item>
					<uni-forms-item label="新密码" required name="password">
						<uni-easyinput v-model="valiFormData.password" placeholder="请输入新密码" type="password" />
					</uni-forms-item>
          <uni-forms-item label="确认密码" required name="confirmPassword">
						<uni-easyinput v-model="valiFormData.confirmPassword" placeholder="请再次输入新密码" type="password" />
					</uni-forms-item>
				</uni-forms>
			</view>
      <view class="fixed bottom-0 left-0 right-0 px-4 py-6">
        <button type="primary" @click="submit('valiForm')" class="rounded-full">提交</button>
      </view>

  </view>
</template>

<script setup>
import { ref, inject, watch } from 'vue'
import { onLoad, onShow, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app';
import { getApiUrl } from '@/utils';
import { Base64 } from 'js-base64'
const Microi = inject('Microi'); // 使用注入Microi实例
const valiForm = ref(null)
const userInfo = ref(Microi.GetCurrentUser()) // 用户信息
const valiFormData = ref({
  oldPassword: '',
  password: '',
  confirmPassword: '',
})
const rules = ref({
  oldPassword: {
    rules: [{
      required: true,
      errorMessage: '请输入原密码'
    }]
  },
  password: {
    rules: [{
      required: true,
      errorMessage: '请输入新密码'
    }]
  },
  confirmPassword: {
    rules: [{
      required: true,
      errorMessage: '请再次输入新密码'
    }, {
      validateFunction: (rule, value, data, callback) => {
        if (value !== valiFormData.value.password) {
          callback('两次输入的密码不一致')
        } else {
          callback()
        }
      }
    }]
  }
})
const submit = () => {
  valiForm.value.validate().then(res => {
    console.log('res', res);
    Microi.Post(getApiUrl('uptsysuser'),{
      id: userInfo.value.Id,
      Pwd: Base64.encode(res.oldPassword),
      NewPwd: Base64.encode(res.confirmPassword)
    }, function(){},{DataType: "form"}).then(res => {
      if (res.Code == 1) {
        Microi.Tips('修改密码成功');
        Microi.SetToken('');
        Microi.SetCurrentUser('');
        uni.reLaunch({
          url: '/pages/mine/login/login'
        })
      } else {
        Microi.Tips(res.Msg, false);
      }
    }).catch(err => {
      console.log('失败', err);
    })
  }).catch(err => {
    console.log('err', err);
  })
}


</script>

<style scoped>
.container{
  padding: 30rpx;
  background-image: url('@/pages/tools/kaoqin/images/bg.jpg');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  min-height: 100vh;
}
.example {
  padding: 15px;
  background-color: #fff;
}
.title{
  text-align: center;
  padding-top: 20rpx;
}
</style>