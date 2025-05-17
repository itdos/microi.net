<template>
  <view class="container">
    <view class="search-box">
      <view class="search-item uni-flex">
        <uni-easyinput
          prefixIcon="search"
          v-model="keyword"
          placeholder="搜索菜单/功能"
          @input="search"
          confirm-type="search"
          @confirm="search"
          @clear="onClear"
          style="border:0;border-radius: 50rpx;"
          focus
        ></uni-easyinput>
      </view>
    </view>

    <!-- 搜索结果列表 -->
    <view class="search-results" v-if="searchResults.length > 0">
      <view 
        v-for="item in searchResults" 
        :key="item.Id" 
        @tap="navDemoPage(item)"
      >
      <view class="search-result-item"  v-if="!item._Child">
        <view class="item-content">
          <view class="item-title">{{item.Name}}</view>
          <view class="item-path" v-if="item.parentName">{{item.parentName}} > {{item.Name}}</view>
        </view>
        <uni-icons type="right" size="16"></uni-icons>
      </view>
        
      </view>
    </view>

    <!-- 无搜索结果 -->
    <view class="no-result" v-else-if="keyword && !loading">
      <image src="/static/img/no-data.png" mode="aspectFit" class="no-result-image"></image>
      <text class="no-result-text">未找到相关菜单</text>
    </view>

    <!-- 加载中 -->
    <view class="loading" v-if="loading">
      <uni-load-more status="loading"></uni-load-more>
    </view>
  </view>
</template>

<script setup>
import { ref, inject, onMounted } from 'vue'
import { getApiUrl } from '@/utils/api.js'

const Microi = inject('Microi')
const keyword = ref('')
const searchResults = ref([])
const loading = ref(false)
const allMenuData = ref([])

// 递归处理菜单数据
const processMenuItems = (items, parentPath = '', processedData = []) => {
  items.forEach(item => {
    if (item.AppDisplay !== false) {
      // 构建当前项的完整路径
      const currentPath = parentPath ? `${parentPath} > ${item.Name}` : item.Name
      
      // 添加当前菜单项
      processedData.push({
        ...item,
        parentName: parentPath
      })

      // 递归处理子菜单
      if (item._Child) {
        processMenuItems(item._Child, currentPath, processedData)
      }
    }
  })
  return processedData
}

// 获取所有菜单数据
const getMenuData = async () => {
  loading.value = true
  try {
    const res = await Microi.Post(getApiUrl('getSysMenuStep'), {})
    if (res.Code === 1 && res.Data) {
      // 使用递归函数处理菜单数据
      allMenuData.value = processMenuItems(res.Data)
    }
  } catch (error) {
    console.error('获取菜单数据失败:', error)
  } finally {
    loading.value = false
  }
}

// 搜索功能
const search = () => {
  if (!keyword.value) {
    searchResults.value = []
    return
  }

  const searchKey = keyword.value.toLowerCase()
  searchResults.value = allMenuData.value.filter(item => 
    item.Name.toLowerCase().includes(searchKey) ||
    (item.parentName && item.parentName.toLowerCase().includes(searchKey))
  )
}

// 清空搜索
const onClear = () => {
  keyword.value = ''
  searchResults.value = []
}

// 导航到对应页面
const navDemoPage = (item) => {
  if (item.Id == '3f6fca15-d3ce-453c-9dc1-d4dc161644f1') { // 我的待办
    Microi.RouterPush(`/pages/workbench/work-todo/index`, true)
  } else {
    Microi.RouterPush(`/pages/workbench/work-list/index?MenuId=${item.Id}&MenuName=${item.Name}`, true)
  }
}

// 页面加载时获取菜单数据
onMounted(() => {
  getMenuData()
})
</script>

<style scoped>
.container {
  min-height: 100vh;
  background-color: #f5f5f5;
}

.search-box {
  padding: 20rpx;
  background-color: #fff;
}

.search-results {
  margin-top: 20rpx;
  background-color: #fff;
}

.search-result-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 30rpx 20rpx;
  border-bottom: 1px solid #eee;
}

.item-content {
  flex: 1;
}

.item-title {
  font-size: 28rpx;
  color: #333;
  margin-bottom: 6rpx;
}

.item-path {
  font-size: 24rpx;
  color: #999;
}

.no-result {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 200rpx;
}

.no-result-image {
  width: 200rpx;
  height: 200rpx;
  margin-bottom: 20rpx;
}

.no-result-text {
  font-size: 28rpx;
  color: #999;
}

.loading {
  padding: 40rpx 0;
}
</style>
