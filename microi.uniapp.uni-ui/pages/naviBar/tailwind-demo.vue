<template>
  <view class="p-4 bg-gray-100 min-h-screen">
    <view class="bg-white shadow-lg rounded-lg p-6 mb-6">
      <text class="text-2xl font-bold text-blue-600 mb-4 block">Tailwind CSS 测试页</text>
      <text class="text-gray-700 mb-4 block">这个页面用于测试 Tailwind CSS 在 uni-app 中是否正常工作</text>
      
      <view class="mt-6">
        <text class="text-lg font-semibold text-gray-800 mb-2 block">基础样式</text>
        <view class="bg-blue-100 p-3 rounded">
          <text class="text-blue-800">这是一个蓝色背景的文本框</text>
        </view>
        <view class="bg-green-100 p-3 mt-2 rounded">
          <text class="text-green-800">这是一个绿色背景的文本框</text>
        </view>
        <view class="bg-red-100 p-3 mt-2 rounded">
          <text class="text-red-800">这是一个红色背景的文本框</text>
        </view>
      </view>
      
      <view class="mt-6">
        <text class="text-lg font-semibold text-gray-800 mb-2 block">Flex 布局</text>
        <view class="flex flex-row space-x-2">
          <view class="w-1/3 bg-blue-500 p-2 rounded">
            <text class="text-white text-center">1/3</text>
          </view>
          <view class="w-1/3 bg-green-500 p-2 rounded">
            <text class="text-white text-center">1/3</text>
          </view>
          <view class="w-1/3 bg-red-500 p-2 rounded">
            <text class="text-white text-center">1/3</text>
          </view>
        </view>
      </view>
      
      <view class="mt-6">
        <text class="text-lg font-semibold text-gray-800 mb-2 block">边框和阴影</text>
        <view class="flex flex-wrap gap-3">
          <view class="w-20 h-20 border-2 border-blue-500 rounded"></view>
          <view class="w-20 h-20 border-2 border-green-500 rounded-md"></view>
          <view class="w-20 h-20 border-2 border-red-500 rounded-lg"></view>
          <view class="w-20 h-20 border-2 border-yellow-500 rounded-full"></view>
        </view>
      </view>
      
      <view class="mt-6">
        <button @click="goToHome" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
          返回首页
        </button>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  methods: {
    goToHome() {
      uni.navigateTo({
        url: '/pages/naviBar/home/index'
      });
    }
  }
}
</script>

<style>
/* 可以在这里添加额外的自定义样式 */
</style> 