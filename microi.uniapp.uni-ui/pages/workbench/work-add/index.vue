<template>
  <workAdd />
</template>

<script setup>
import workAdd from '@/FormComponents/workAdd.vue'
import { onLoad } from '@dcloudio/uni-app'

// 页面加载时的处理
onLoad((options) => {
  // 页面级别的处理逻辑可以在这里添加
  // 具体的表单业务逻辑已委托给workAdd组件处理
  if (options?.type === 'Edit') {
    uni.setNavigationBarTitle({
      title: '编辑'
    })
  } else {
    uni.setNavigationBarTitle({
      title: '新增'
    })
  }
})
</script>

<style scoped>
/* 页面级别的样式 */
</style>