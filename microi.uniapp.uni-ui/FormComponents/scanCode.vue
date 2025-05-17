<template>
  <view>
  <!-- 二维码弹窗 -->
  <mumu-get-qrcode ref="mumuGetQrcode" @success='qrcodeSucess' @error="qrcodeError" />
  </view>
</template>

<script setup>
import mumuGetQrcode from '@/uni_modules/mumu-getQrcode/components/mumu-getQrcode/mumu-getQrcode.vue'
import { inject, onMounted } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app';
const V8 = inject('V8'); // 使用注入V8实例
const pages = getCurrentPages();  // 无需import
const page = pages[pages.length - 1];
const eventChannel = page.getOpenerEventChannel();
// 扫码成功
const qrcodeSucess = (data) => {
  console.log('扫码成功', data);
  // 向上一级页面发送扫码成功事件
  eventChannel.emit('scanSuccess', data);
  uni.navigateBack()
}
// 扫码失败
const qrcodeError = (err) => {
  eventChannel.emit('scanSuccess', err);
  uni.showModal({
    title: '摄像头授权失败',
    content: '摄像头授权失败，请检测当前浏览器是否有摄像头权限。',
    success: () => {
      uni.navigateBack()
    }
  })
}
// setTimeout(() => {
// qrcodeSucess('50')
// }, 1500)
</script>

<style>

</style>