<template>
  <view class="mall-container" :style="'--theme:' + themeColor + ';--theme-light:' + themeColorLight + ';--theme-gradient:' + themeGradient">
    <!-- 顶部搜索栏 -->
    <view class="search-header" :style="{ paddingTop: statusBarHeight + 'px', background: themeGradient }">
      <view class="search-bar" :style="{ paddingRight: capsuleWidth + 'px' }">
        <view class="search-input-wrap">
          <text class="search-icon">🔍</text>
          <input
            class="search-input"
            type="text"
            v-model="keyword"
            :placeholder="t('mall.searchPlaceholder')"
            placeholder-style="color:#bbb;font-size:13px;"
            confirm-type="search"
            @confirm="onSearch"
          />
          <view v-if="keyword" class="search-clear" @tap="clearSearch">✕</view>
          <view class="filter-btn-inline" :style="{ background: themeColor }" @tap="showFilter = true">
            <text class="filter-icon-inline">☰</text>
            <view class="filter-dot-inline" v-if="hasActiveFilter"></view>
          </view>
        </view>
      </view>
    </view>

    <!-- 主体内容：左分类 + 右列表 -->
    <view class="main-body">
      <!-- 左侧分类栏 -->
      <scroll-view class="category-sidebar" scroll-y :show-scrollbar="false">
        <!-- 全部 -->
        <view
          class="cat-item"
          :class="{ active: !currentCategory }"
          @tap="selectMainCategory(null)"
        >
          <text>{{ t('common.all') }}</text>
        </view>
        <!-- 一级分类 -->
        <view v-for="cat in categoryTree" :key="cat.Id" class="cat-group">
          <view
            class="cat-item"
            :class="{ active: currentMainId === cat.Id }"
            @tap="selectMainCategory(cat)"
          >
            <text class="cat-arrow" v-if="cat._Child && cat._Child.length">{{ cat._expanded ? '▾' : '▸' }}</text>
            <text class="cat-name">{{ cat.Mingcheng }}</text>
          </view>
          <!-- 二级分类（展开时显示） -->
          <view v-if="cat._expanded && cat._Child && cat._Child.length" class="sub-cat-list">
            <view
              v-for="sub in cat._Child"
              :key="sub.Id"
              class="sub-cat-item"
              :class="{ active: currentCategory === sub.Id }"
              @tap="selectSubCategory(cat, sub)"
            >
              <text>{{ sub.Mingcheng }}</text>
            </view>
          </view>
        </view>
      </scroll-view>

      <!-- 右侧商品列表 -->
      <scroll-view
        class="product-area"
        scroll-y
        :refresher-enabled="true"
        :refresher-triggered="refreshing"
        @refresherrefresh="onRefresh"
        @scrolltolower="loadMore"
      >
        <!-- 商品卡片列表 -->
        <view class="product-list" v-if="products.length > 0">
          <view
            class="product-card"
            v-for="item in products"
            :key="item.Id"
            @tap="goDetail(item.Id)"
          >
            <view class="card-image">
              <image :src="getProductImage(item)" mode="aspectFill" lazy-load />
              <view class="card-tag" v-if="item.ShangpinLX">
                <text>{{ item.ShangpinLX }}</text>
              </view>
            </view>
            <view class="card-body">
              <text class="card-title">{{ item.ShangpinMC || t('mall.noProductName') }}</text>
              <text class="card-model" v-if="item.ShangpinBH">{{ item.ShangpinBH }}</text>
              <view class="card-prices">
                <view class="cp-rent" v-if="item.ShangpinLX === '设备' && item.ZulinXJ">
                  <text class="cp-label">{{ t('mall.lease') }}</text>
                  <text class="cp-val">¥{{ formatNum(item.ZulinXJ) }}</text>
                </view>
                <view class="cp-buy" v-if="item.ShangpinLX === '耗材'">
                  <text class="cp-label">{{ t('mall.filter') }}</text>
                  <text class="cp-val">¥{{ formatNum(item.Xianjia || item.Yuanjia) }}</text>
                </view>
                <view class="cp-buy" v-if="item.ShangpinLX === '设备'">
                  <text class="cp-label">{{ t('mall.purchase') }}</text>
                  <text class="cp-val">¥{{ formatNum(item.Xianjia || item.Yuanjia) }}</text>
                </view>
                <view class="cp-rent" v-if="item.ShangpinLX !== '设备' && item.ShangpinLX !== '耗材'">
                  <text class="cp-val">¥{{ formatNum(item.Xianjia || item.ZulinXJ || item.Yuanjia) }}</text>
                </view>
              </view>
              <text class="card-supplier" v-if="item.TenantName">{{ item.TenantName }}</text>
            </view>
          </view>
        </view>

        <!-- 空状态 -->
        <view class="empty-state" v-if="!loading && products.length === 0">
          <text class="empty-icon">📦</text>
          <text class="empty-text">{{ t('mall.noProducts') }}</text>
          <text class="empty-sub">{{ t('mall.tryOther') }}</text>
        </view>

        <!-- 加载更多 -->
        <view class="load-more" v-if="products.length > 0">
          <text v-if="loadingMore" class="load-more-text">{{ t('common.loading') }}</text>
          <text v-else-if="noMore" class="load-more-text">{{ t('common.noMore') }}</text>
        </view>
      </scroll-view>
    </view>

    <!-- 骨架屏 -->
    <view class="skeleton-overlay" v-if="loading && products.length === 0">
      <view class="skeleton-list">
        <view class="skeleton-card" v-for="i in 4" :key="i">
          <view class="sk-img"></view>
          <view class="sk-body">
            <view class="sk-line sk-l1"></view>
            <view class="sk-line sk-l2"></view>
            <view class="sk-line sk-l3"></view>
          </view>
        </view>
      </view>
    </view>

    <!-- 高级筛选弹窗 -->
    <view class="filter-mask" v-if="showFilter" @tap="showFilter = false">
      <view class="filter-panel" @tap.stop>
        <view class="filter-header">
          <text class="filter-title">{{ t('mall.advancedFilter') }}</text>
          <text class="filter-close" @tap="showFilter = false">✕</text>
        </view>

        <!-- 类型筛选 -->
        <view class="filter-section">
          <text class="filter-sec-title">{{ t('mall.productType') }}</text>
          <view class="filter-chips">
            <view
              v-for="tp in typeOptions"
              :key="tp.Key"
              class="filter-chip"
              :class="{ active: selectedTypes.includes(tp.Value) }"
              @tap="toggleType(tp.Value)"
            >
              <text>{{ tp.Value }}</text>
            </view>
          </view>
        </view>

        <!-- 价格区间 -->
        <view class="filter-section">
          <text class="filter-sec-title">{{ t('mall.priceRange') }}</text>
          <view class="price-range">
            <input class="price-input" type="digit" v-model="priceMin" :placeholder="t('mall.minPrice')" />
            <text class="price-sep">—</text>
            <input class="price-input" type="digit" v-model="priceMax" :placeholder="t('mall.maxPrice')" />
          </view>
        </view>

        <!-- 底部操作 -->
        <view class="filter-actions">
          <view class="filter-reset-btn" @tap="resetFilter">
            <text>{{ t('common.reset') }}</text>
          </view>
          <view class="filter-confirm-btn" :style="{ background: themeGradient }" @tap="confirmFilter">
            <text>{{ t('mall.confirmFilter') }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { getProductList, getProductCategories, getProductTypes, parseImages, getImageUrl } from '@/utils/api.js'
import appConfig from '@/config.js'
import { themeMixin } from '@/utils/theme.js'
import { getMenuButtonRect } from '@/utils/platform.js'

export default {
  mixins: [themeMixin],
  data() {
    return {
      statusBarHeight: 44,
      capsuleWidth: 0,
      keyword: '',
      // 分类树
      categoryTree: [],
      currentMainId: null,    // 当前选中的一级分类Id
      currentCategory: null,  // 实际传给API的分类Id（可能是一级或二级）
      // 商品
      products: [],
      loading: true,
      loadingMore: false,
      refreshing: false,
      noMore: false,
      pageIndex: 1,
      pageSize: 10,
      totalCount: 0,
      // 高级筛选
      showFilter: false,
      typeOptions: [],
      selectedTypes: [],
      priceMin: '',
      priceMax: '',
      // 已应用的筛选（确认后才生效）
      appliedTypes: [],
      appliedPriceMin: '',
      appliedPriceMax: ''
    }
  },

  computed: {
    hasActiveFilter() {
      return this.appliedTypes.length > 0 || this.appliedPriceMin || this.appliedPriceMax
    }
  },

  onLoad() {
    try {
      const info = uni.getWindowInfo()
      this.statusBarHeight = info.statusBarHeight || 44
    } catch (e) {
      try {
        this.statusBarHeight = uni.getSystemInfoSync().statusBarHeight || 44
      } catch (e2) {}
    }
    // 计算小程序胶囊按钮占用的右侧宽度（跨平台）
    try {
      const menuBtn = getMenuButtonRect()
      if (menuBtn) {
        const sysInfo = uni.getWindowInfo ? uni.getWindowInfo() : uni.getSystemInfoSync()
        this.capsuleWidth = sysInfo.windowWidth - menuBtn.left + 8
      }
    } catch (e) {}
    this.loadCategoryTree()
    this.loadTypes()
    this.loadProducts()
  },

  methods: {
    // 加载分类树（带子分类）
    async loadCategoryTree() {
      try {
        const res = await getProductCategories()
        if (res.Code === 1 && res.Data) {
          // 给每个一级分类添加 _expanded 标志
          this.categoryTree = (res.Data || []).map(item => ({
            ...item,
            _expanded: false
          }))
        }
      } catch (e) {
        console.error('[Mall] loadCategoryTree error:', e)
      }
    },

    // 加载商品类型选项
    async loadTypes() {
      try {
        const res = await getProductTypes()
        if (res.Code === 1 && res.Data) {
          this.typeOptions = res.Data || []
        }
      } catch (e) {
        console.error('[Mall] loadTypes error:', e)
      }
    },

    // 选择一级分类
    selectMainCategory(cat) {
      if (!cat) {
        // 选择"全部"
        this.currentMainId = null
        this.currentCategory = null
        // 收起所有展开
        this.categoryTree.forEach(c => { c._expanded = false })
        this.loadProducts()
        return
      }

      if (this.currentMainId === cat.Id) {
        // 再次点击同一分类：如果有子分类则切换展开/收起
        if (cat._Child && cat._Child.length) {
          cat._expanded = !cat._expanded
        }
        return
      }

      // 收起其他分类
      this.categoryTree.forEach(c => {
        if (c.Id !== cat.Id) c._expanded = false
      })

      this.currentMainId = cat.Id
      this.currentCategory = cat.Id

      // 如果有子分类则展开，否则直接搜索
      if (cat._Child && cat._Child.length) {
        cat._expanded = true
      }
      this.loadProducts()
    },

    // 选择二级分类
    selectSubCategory(parent, sub) {
      this.currentMainId = parent.Id
      this.currentCategory = sub.Id
      this.loadProducts()
    },

    // 加载商品列表
    async loadProducts(append = false) {
      if (!append) {
        this.loading = true
        this.pageIndex = 1
        this.noMore = false
      }
      try {
        const res = await getProductList({
          pageIndex: this.pageIndex,
          pageSize: this.pageSize,
          categoryId: this.currentCategory,
          keyword: this.keyword,
          types: this.appliedTypes,
          priceMin: this.appliedPriceMin,
          priceMax: this.appliedPriceMax
        })
        if (res.Code === 1) {
          const list = res.Data || []
          if (append) {
            this.products = [...this.products, ...list]
          } else {
            this.products = list
          }
          this.totalCount = res.DataCount || 0
          if (list.length < this.pageSize) {
            this.noMore = true
          }
        }
      } catch (e) {
        console.error('[Mall] loadProducts error:', e)
      } finally {
        this.loading = false
        this.loadingMore = false
        this.refreshing = false
      }
    },

    // 搜索
    onSearch() {
      this.loadProducts()
    },

    // 清除搜索
    clearSearch() {
      this.keyword = ''
      this.loadProducts()
    },

    // 下拉刷新
    onRefresh() {
      this.refreshing = true
      this.loadProducts()
    },

    // 加载更多
    loadMore() {
      if (this.loadingMore || this.noMore) return
      this.loadingMore = true
      this.pageIndex++
      this.loadProducts(true)
    },

    // 切换类型选择
    toggleType(val) {
      const idx = this.selectedTypes.indexOf(val)
      if (idx > -1) {
        this.selectedTypes.splice(idx, 1)
      } else {
        this.selectedTypes.push(val)
      }
    },

    // 重置筛选
    resetFilter() {
      this.selectedTypes = []
      this.priceMin = ''
      this.priceMax = ''
    },

    // 确认筛选
    confirmFilter() {
      this.appliedTypes = [...this.selectedTypes]
      this.appliedPriceMin = this.priceMin
      this.appliedPriceMax = this.priceMax
      this.showFilter = false
      this.loadProducts()
    },

    // 获取商品图片
    getProductImage(item) {
      const imgs = parseImages(item.Tupian)
      if (imgs.length > 0) return imgs[0]
      return '/static/microi-blue-256.png'
    },

    // 格式化数字
    formatNum(val) {
      if (!val && val !== 0) return '0.00'
      return Number(val).toFixed(2)
    },

    // 跳转详情
    goDetail(id) {
      uni.navigateTo({
        url: '/pages/mall/detail?id=' + id
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.mall-container {
  height: 100vh;
  background: #f5f7fa;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ========== 搜索栏 ========== */
.search-header {
  /* bg: themeGradient inline */
  padding-bottom: 16rpx;
  flex-shrink: 0;
  z-index: 100;
}

.search-bar {
  display: flex;
  align-items: center;
  padding: 12rpx 24rpx;
}

.search-input-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  background: rgba(255,255,255,0.95);
  border-radius: 40rpx;
  padding: 0 16rpx 0 24rpx;
  height: 68rpx;
}

.search-icon {
  font-size: 26rpx;
  margin-right: 10rpx;
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  font-size: 26rpx;
  color: #333;
  height: 68rpx;
}

.search-clear {
  font-size: 22rpx;
  color: #999;
  padding: 8rpx 8rpx 8rpx 12rpx;
  flex-shrink: 0;
}

/* 筛选按钮（嵌入搜索框内部右侧） */
.filter-btn-inline {
  position: relative;
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  /* bg: themeColor inline */
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-left: 8rpx;
}

.filter-icon-inline {
  font-size: 26rpx;
  color: #fff;
}

.filter-dot-inline {
  position: absolute;
  top: 4rpx;
  right: 4rpx;
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: #ff4d4f;
  border: 2rpx solid #fff;
}

/* ========== 主体（左分类 + 右列表） ========== */
.main-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* ========== 左侧分类栏 ========== */
.category-sidebar {
  width: 200rpx;
  background: #fff;
  border-right: 1rpx solid #f0f0f0;
  flex-shrink: 0;
  height: 100%;
}

/* 隐藏左侧滚动条 */
.category-sidebar ::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.cat-item {
  position: relative;
  display: flex;
  align-items: center;
  padding: 26rpx 16rpx 26rpx 20rpx;
  font-size: 26rpx;
  color: #666;
  background: #fafbfc;
  border-bottom: 1rpx solid #f5f5f5;
  transition: all 0.15s;

  &.active {
    background: #fff;
    color: var(--theme, #4e6ef2);
    font-weight: 600;

    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 16rpx;
      bottom: 16rpx;
      width: 6rpx;
      border-radius: 0 4rpx 4rpx 0;
      background: var(--theme, #4e6ef2);
    }
  }
}

.cat-arrow {
  font-size: 22rpx;
  color: #999;
  margin-right: 4rpx;
  flex-shrink: 0;
}

.cat-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sub-cat-list {
  background: #fff;
}

.sub-cat-item {
  padding: 22rpx 16rpx 22rpx 44rpx;
  font-size: 24rpx;
  color: #888;
  border-bottom: 1rpx solid #f8f8f8;
  transition: all 0.15s;

  &.active {
    color: var(--theme, #4e6ef2);
    font-weight: 600;
    background: var(--theme-light, rgba(78,110,242,0.08));
  }
}

/* ========== 右侧商品列表 ========== */
.product-area {
  flex: 1;
  height: 100%;
}

.product-list {
  padding: 16rpx;
}

.product-card {
  display: flex;
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
  margin-bottom: 16rpx;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.06);
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:active {
    transform: scale(0.98);
    box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.08);
  }
}

.card-image {
  position: relative;
  width: 220rpx;
  height: 220rpx;
  flex-shrink: 0;
  background: #f8f8f8;

  image {
    width: 100%;
    height: 100%;
  }
}

.card-tag {
  position: absolute;
  top: 8rpx;
  left: 8rpx;
  background: linear-gradient(135deg, #ff6b6b, #ff8e53);
  padding: 2rpx 12rpx;
  border-radius: 16rpx;

  text {
    font-size: 18rpx;
    color: #fff;
    font-weight: 500;
  }
}

.card-body {
  flex: 1;
  padding: 16rpx 20rpx;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}

.card-title {
  font-size: 26rpx;
  color: #333;
  font-weight: 500;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}

.card-model {
  font-size: 22rpx;
  color: #aaa;
  margin-top: 6rpx;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-prices {
  margin-top: 10rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
}

.cp-rent, .cp-buy {
  display: flex;
  align-items: center;
}

.cp-label {
  font-size: 20rpx;
  margin-right: 4rpx;
}

.cp-val {
  font-size: 26rpx;
  font-weight: 700;
}

.cp-rent {
  .cp-label { color: #CD371E; }
  .cp-val { color: #CD371E; }
}

.cp-buy {
  .cp-label { color: #E9800E; }
  .cp-val { color: #E9800E; }
}

.card-supplier {
  font-size: 20rpx;
  color: #aaa;
  margin-top: 6rpx;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ========== 空状态 ========== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0;
}

.empty-icon {
  font-size: 80rpx;
  margin-bottom: 24rpx;
}

.empty-text {
  font-size: 30rpx;
  color: #666;
  font-weight: 500;
}

.empty-sub {
  font-size: 24rpx;
  color: #999;
  margin-top: 8rpx;
}

/* ========== 加载更多 ========== */
.load-more {
  text-align: center;
  padding: 32rpx 0 48rpx;
}

.load-more-text {
  font-size: 24rpx;
  color: #999;
}

/* ========== 骨架屏 ========== */
.skeleton-overlay {
  position: absolute;
  left: 200rpx;
  right: 0;
  top: 0;
  bottom: 0;
  background: #f5f7fa;
  z-index: 50;
  padding: 16rpx;
}

.skeleton-list {
  padding: 0;
}

.skeleton-card {
  display: flex;
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
  margin-bottom: 16rpx;
}

.sk-img {
  width: 220rpx;
  height: 220rpx;
  flex-shrink: 0;
  background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
  background-size: 400% 100%;
  animation: shimmer 1.5s infinite;
}

.sk-body {
  flex: 1;
  padding: 20rpx;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 12rpx;
}

.sk-line {
  height: 24rpx;
  background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
  background-size: 400% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 12rpx;
}

.sk-l1 { width: 80%; }
.sk-l2 { width: 55%; }
.sk-l3 { width: 40%; height: 28rpx; }

/* ========== 高级筛选弹窗 ========== */
.filter-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.45);
  z-index: 1000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
}

.filter-panel {
  width: 92%;
  margin-top: 180rpx;
  background: #fff;
  border-radius: 24rpx;
  padding: 36rpx 32rpx 28rpx;
  box-shadow: 0 8rpx 40rpx rgba(0,0,0,0.12);
}

.filter-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 32rpx;
}

.filter-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
}

.filter-close {
  font-size: 32rpx;
  color: #999;
  padding: 8rpx;
}

.filter-section {
  margin-bottom: 32rpx;
}

.filter-sec-title {
  font-size: 26rpx;
  color: #666;
  font-weight: 500;
  margin-bottom: 16rpx;
  display: block;
}

.filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.filter-chip {
  padding: 12rpx 32rpx;
  border-radius: 32rpx;
  background: #f5f7fa;
  border: 2rpx solid #f0f0f0;
  font-size: 26rpx;
  color: #666;
  transition: all 0.15s;

  &.active {
    background: var(--theme-light, rgba(78,110,242,0.08));
    border-color: var(--theme, #4e6ef2);
    color: var(--theme, #4e6ef2);
    font-weight: 500;
  }
}

.price-range {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.price-input {
  flex: 1;
  height: 72rpx;
  background: #f5f7fa;
  border: 2rpx solid #f0f0f0;
  border-radius: 12rpx;
  padding: 0 20rpx;
  font-size: 26rpx;
  color: #333;
  text-align: center;
}

.price-sep {
  color: #ccc;
  font-size: 28rpx;
}

.filter-actions {
  display: flex;
  gap: 20rpx;
  margin-top: 12rpx;
}

.filter-reset-btn {
  flex: 1;
  height: 80rpx;
  border-radius: 40rpx;
  border: 2rpx solid #ddd;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  font-size: 28rpx;
}

.filter-confirm-btn {
  flex: 2;
  height: 80rpx;
  border-radius: 40rpx;
  /* bg: themeGradient inline */
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 28rpx;
  font-weight: 500;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.12);
  transition: transform 0.15s ease;

  &:active {
    transform: scale(0.97);
  }
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
