<template>
  <view class="detail-container" :style="'--theme:' + themeColor + ';--theme-light:' + themeColorLight + ';--theme-gradient:' + themeGradient">
    <!-- 自定义导航栏 -->
    <view class="nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content">
        <view class="nav-back" @tap="goBack">
          <text class="back-icon">‹</text>
        </view>
        <text class="nav-title">{{ t('mall.productDetail') }}</text>
        <view class="nav-placeholder"></view>
      </view>
    </view>

    <scroll-view class="detail-scroll" scroll-y v-if="!loading && product">
      <!-- 商品轮播图 -->
      <view class="swiper-section">
        <swiper
          class="product-swiper"
          :indicator-dots="images.length > 1"
          indicator-color="rgba(255,255,255,0.4)"
          indicator-active-color="#ffffff"
          :autoplay="true"
          :circular="true"
          :interval="4000"
        >
          <swiper-item v-for="(img, idx) in images" :key="idx">
            <image class="swiper-image" :src="img" mode="aspectFill" @tap="previewImage(idx)" />
          </swiper-item>
          <swiper-item v-if="images.length === 0">
            <view class="swiper-empty">
              <text class="empty-icon">📷</text>
              <text class="empty-text">{{ t('mall.noImage') }}</text>
            </view>
          </swiper-item>
        </swiper>
        <view class="image-counter" v-if="images.length > 1">
          <text>{{ images.length }}{{ t('common.piece') }}</text>
        </view>
      </view>

      <!-- 价格信息 - 买断/滤芯价格 -->
      <view class="price-section">
        <view class="price-main-row">
          <text class="price-type-label" v-if="product.ShangpinLX === '设备'">{{ t('mall.purchasePrice') }}</text>
          <text class="price-type-label" v-else>{{ t('mall.replaceFilter') }}</text>
          <view class="price-main">
            <text class="price-symbol">¥</text>
            <text class="price-big">{{ formatNum(product.Xianjia) }}</text>
            <text class="price-unit" v-if="product.ShangpinLX === '设备'">{{ t('mall.yuanPerUnit') }}</text>
            <text class="price-unit" v-else>{{ t('mall.yuanPerPiece') }}</text>
          </view>
          <view class="price-original" v-if="product.Yuanjia && product.Yuanjia != product.Xianjia">
            <text>¥{{ formatNum(product.Yuanjia) }}{{ product.ShangpinLX === '设备' ? t('mall.yuanPerUnit') : t('mall.yuanPerPiece') }}</text>
          </view>
        </view>
        <!-- 更换滤芯价格（设备才显示） -->
        <view class="price-filter-row" v-if="product.ShangpinLX === '设备' && product.GenghuanLXJG">
          <text class="filter-label">{{ t('mall.replaceFilter') }}</text>
          <view class="filter-price">
            <text class="filter-symbol">¥</text>
            <text class="filter-value">{{ product.GenghuanLXJG }}</text>
            <text class="filter-unit">{{ t('mall.yuanPerYear') }}</text>
          </view>
        </view>
        <view class="price-tags">
          <view class="price-tag" v-if="product.ShangpinLX">
            <text>{{ product.ShangpinLX }}</text>
          </view>
          <view class="price-tag tag-rental" v-if="product.ZulinXJ">
            <text>{{ t('mall.leasable') }}</text>
          </view>
        </view>
      </view>

      <!-- 租赁价格卡片 -->
      <view class="lease-card" v-if="product.ZulinXJ">
        <view class="lease-title-row">
          <text class="lease-title">{{ t('mall.leasePrice') }}</text>
        </view>
        <view class="lease-price-row">
          <text class="lease-symbol">¥</text>
          <text class="lease-big">{{ formatNum(product.ZulinXJ) }}</text>
          <text class="lease-unit">{{ t('mall.yuanPerUnitYear') }}</text>
          <view class="lease-original" v-if="product.ZulinYJ && product.ZulinYJ != product.ZulinXJ">
            <text>¥{{ formatNum(product.ZulinYJ) }}元/台/年</text>
          </view>
        </view>
      </view>

      <!-- 商品名称 -->
      <view class="title-section">
        <text class="product-title">{{ product.ShangpinMC }}</text>
        <view class="product-meta">
          <text v-if="product.ShangpinBH" class="meta-item">{{ t('mall.model') }}: {{ product.ShangpinBH }}</text>
          <text v-if="product.PingtaiFLMC" class="meta-item">{{ t('mall.category') }}: {{ product.PingtaiFLMC }}</text>
        </view>
      </view>

      <!-- 供应商信息 -->
      <view class="vendor-section" v-if="product.TenantName || product.ShangpinGYS">
        <view class="section-header">
          <text class="section-icon">🏪</text>
          <text class="section-title">{{ t('mall.supplyInfo') }}</text>
        </view>
        <view class="vendor-info">
          <view class="vendor-row" v-if="product.TenantName">
            <text class="vendor-label">{{ t('mall.merchant') }}</text>
            <text class="vendor-value">{{ product.TenantName }}</text>
          </view>
          <view class="vendor-row" v-if="product.ShangpinGYS">
            <text class="vendor-label">{{ t('mall.supplier') }}</text>
            <text class="vendor-value">{{ product.ShangpinGYS }}</text>
          </view>
        </view>
      </view>

      <!-- 动态属性 -->
      <view class="specs-section" v-if="dynamicFields.length > 0">
        <view class="section-header">
          <text class="section-icon">📋</text>
          <text class="section-title">{{ t('mall.productParams') }}</text>
        </view>
        <view class="specs-grid">
          <view class="spec-item" v-for="field in dynamicFields" :key="field.Name">
            <text class="spec-label">{{ field.Label }}</text>
            <text class="spec-value">{{ dynamicData[field.Name] || '-' }}</text>
          </view>
        </view>
      </view>

      <!-- Tab 切换: 商品详情 / 案例图片 -->
      <view class="tab-section">
        <view class="tab-bar">
          <view
            class="tab-item"
            :class="{ active: currentTab === 0 }"
            @tap="currentTab = 0"
          >
            <text>{{ t('mall.productDetail') }}</text>
            <view class="tab-line" v-if="currentTab === 0"></view>
          </view>
          <view
            class="tab-item"
            :class="{ active: currentTab === 1 }"
            @tap="currentTab = 1"
          >
            <text>{{ t('mall.caseImages') }}</text>
            <view class="tab-line" v-if="currentTab === 1"></view>
          </view>
        </view>

        <!-- 商品详情内容 -->
        <view class="tab-content" v-if="currentTab === 0">
          <view class="rich-content" v-if="product.ShangpinXQ">
            <rich-text :nodes="processHtml(product.ShangpinXQ)" />
          </view>
          <view class="tab-empty" v-else>
            <text class="tab-empty-text">{{ t('mall.noProductDetail') }}</text>
          </view>
        </view>

        <!-- 案例图片内容 -->
        <view class="tab-content" v-if="currentTab === 1">
          <view class="case-gallery" v-if="caseImages.length > 0">
            <image
              v-for="(img, idx) in caseImages"
              :key="idx"
              class="case-image"
              :src="img"
              mode="widthFix"
              @tap="previewCaseImage(idx)"
            />
          </view>
          <view class="tab-empty" v-else>
            <text class="tab-empty-text">{{ t('mall.noCaseImages') }}</text>
          </view>
        </view>
      </view>

      <!-- 底部间距 (给底部操作栏留出空间) -->
      <view class="bottom-space"></view>
    </scroll-view>

    <!-- 底部操作栏 -->
    <view class="bottom-bar" v-if="!loading && product">
      <view class="bar-action" @tap="handleShare">
        <text class="bar-icon">↗</text>
        <text class="bar-label">{{ t('mall.share') }}</text>
      </view>
      <view class="bar-action" :class="{ 'is-collected': isFavorited }" @tap="handleFavorite">
        <text class="bar-icon">{{ isFavorited ? '★' : '☆' }}</text>
        <text class="bar-label">{{ isFavorited ? t('mall.favorited') : t('mall.favorite') }}</text>
      </view>
      <view class="bar-btn" :style="{ background: themeGradient }" @tap="handleReserve">
        <text>{{ t('mall.bookNow') }}</text>
      </view>
    </view>

    <!-- 预约弹窗 -->
    <view class="popup-mask" v-if="showReservePopup" @tap="showReservePopup = false">
      <view class="popup-content" @tap.stop>
        <view class="popup-header">
          <text class="popup-title">{{ t('mall.bookProduct') }}</text>
          <text class="popup-close" @tap="showReservePopup = false">✕</text>
        </view>
        <view class="popup-body">
          <view class="form-item">
            <text class="form-label">{{ t('mall.quantity') }}</text>
            <view class="form-num">
              <view class="num-btn" @tap="reserveForm.num > 1 && reserveForm.num--">-</view>
              <text class="num-value">{{ reserveForm.num }}</text>
              <view class="num-btn" @tap="reserveForm.num++">+</view>
            </view>
          </view>
          <view class="form-item">
            <text class="form-label">{{ t('mall.name') }}</text>
            <input class="form-input" v-model="reserveForm.name" :placeholder="t('mall.enterName')" />
          </view>
          <view class="form-item">
            <text class="form-label">{{ t('mall.phone') }}</text>
            <input class="form-input" v-model="reserveForm.phone" :placeholder="t('mall.enterPhone')" type="number" maxlength="11" />
          </view>
        </view>
        <view class="popup-footer">
          <view class="popup-submit-btn" :style="{ background: themeGradient }" @tap="submitReserve">
            <text>{{ t('mall.confirmBook') }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 加载状态 -->
    <view class="loading-state" v-if="loading">
      <view class="loading-spinner"></view>
      <text class="loading-text">{{ t('common.loading') }}</text>
    </view>
  </view>
</template>

<script>
import { getProductDetail, getProductDynamicInfo, parseImages, getImageUrl, checkFavorite, toggleFavorite, reserveProduct } from '@/utils/api.js'
import { getToken } from '@/utils/request.js'
import appConfig from '@/utils/config.js'
import { themeMixin } from '@/utils/theme.js'

export default {
  mixins: [themeMixin],
  data() {
    return {
      statusBarHeight: 44,
      productId: '',
      product: null,
      images: [],
      caseImages: [],
      dynamicData: {},
      dynamicFields: [],
      loading: true,
      currentTab: 0,
      isFavorited: false,
      showReservePopup: false,
      reserveForm: {
        num: 1,
        name: '',
        phone: ''
      },
      submitting: false
    }
  },

  onLoad(options) {
    try {
      const info = uni.getWindowInfo()
      this.statusBarHeight = info.statusBarHeight || 44
    } catch (e) {
      try {
        this.statusBarHeight = uni.getSystemInfoSync().statusBarHeight || 44
      } catch (e2) {}
    }

    this.productId = options.id
    if (this.productId) {
      this.loadDetail()
      this.loadDynamicInfo()
      this.loadFavoriteStatus()
    }
  },

  // 微信分享
  onShareAppMessage() {
    return {
      title: this.product ? this.product.ShangpinMC : '商品详情',
      path: '/pages/mall/detail?id=' + this.productId,
      imageUrl: this.images.length > 0 ? this.images[0] : ''
    }
  },

  methods: {
    formatNum(val) {
      if (!val && val !== 0) return '0.00'
      return Number(val).toFixed(2)
    },

    async loadDetail() {
      this.loading = true
      try {
        const res = await getProductDetail(this.productId)
        if (res.Code === 1 && res.Data) {
          this.product = res.Data
          this.images = parseImages(res.Data.Tupian)
          this.caseImages = parseImages(res.Data.Anli)
        }
      } catch (e) {
        console.error('[Mall Detail] loadDetail error:', e)
        uni.showToast({ title: this.t('mall.loadFailed'), icon: 'none' })
      } finally {
        this.loading = false
      }
    },

    async loadDynamicInfo() {
      try {
        const res = await getProductDynamicInfo(this.productId)
        if (res.Code === 1) {
          this.dynamicData = res.Data || {}
          if (res.DataAppend && res.DataAppend.FieldList) {
            this.dynamicFields = res.DataAppend.FieldList
          }
        }
      } catch (e) {
        console.log('[Mall Detail] loadDynamicInfo:', e.message)
      }
    },

    // 检查收藏状态
    async loadFavoriteStatus() {
      const token = getToken()
      if (!token) return
      try {
        const res = await checkFavorite(this.productId)
        if (res.Code === 1 && res.Data) {
          this.isFavorited = res.Data.ShifouSC === 1 || res.Data.ShifouSC === '1' || res.Data.ShifouSC === true
        }
      } catch (e) {
        console.log('[Mall Detail] checkFavorite:', e.message)
      }
    },

    // 检查登录状态，未登录跳转登录页
    checkLogin() {
      const token = getToken()
      if (!token) {
        uni.navigateTo({
          url: '/pages/login/index?redirect=' + encodeURIComponent('/pages/mall/detail?id=' + this.productId)
        })
        return false
      }
      return true
    },

    // 分享
    handleShare() {
      // #ifdef MP
      // 小程序中无法主动触发分享，提示用户使用右上角分享
      uni.showToast({ title: this.t('mall.shareHint'), icon: 'none' })
      // #endif
      // #ifdef APP-PLUS
      // App 端可以调用系统分享
      uni.share && uni.share({
        provider: 'system',
        type: 0,
        title: this.product ? this.product.ShangpinMC : '商品详情',
        summary: '查看商品详情',
        href: appConfig.webviewUrl + '/#/pages/mall/detail?id=' + this.productId
      })
      // #endif
    },

    // 收藏/取消收藏
    async handleFavorite() {
      if (!this.checkLogin()) return
      try {
        const type = this.isFavorited ? 1 : 0
        const res = await toggleFavorite(this.productId, type)
        if (res.Code === 1) {
          this.isFavorited = !this.isFavorited
          uni.showToast({
            title: this.isFavorited ? this.t('mall.favorited') : this.t('mall.unfavorited'),
            icon: 'none'
          })
        } else {
          uni.showToast({ title: res.Msg || '操作失败', icon: 'none' })
        }
      } catch (e) {
        uni.showToast({ title: this.t('common.operationFailed'), icon: 'none' })
      }
    },

    // 预约
    handleReserve() {
      if (!this.checkLogin()) return
      this.showReservePopup = true
    },

    // 提交预约
    async submitReserve() {
      if (!this.reserveForm.name) {
        uni.showToast({ title: this.t('mall.enterName'), icon: 'none' })
        return
      }
      if (!this.reserveForm.phone || !/^1\d{10}$/.test(this.reserveForm.phone)) {
        uni.showToast({ title: this.t('mall.enterCorrectPhone'), icon: 'none' })
        return
      }
      if (this.submitting) return
      this.submitting = true
      try {
        const res = await reserveProduct({
          ShangpinID: this.productId,
          Xingming: this.reserveForm.name,
          Dianhua: this.reserveForm.phone,
          Shuliang: this.reserveForm.num
        })
        if (res.Code === 1) {
          uni.showToast({ title: '预约成功', icon: 'success' })
          this.showReservePopup = false
          this.reserveForm = { num: 1, name: '', phone: '' }
        } else {
          uni.showToast({ title: res.Msg || '预约失败', icon: 'none' })
        }
      } catch (e) {
        uni.showToast({ title: '预约失败', icon: 'none' })
      } finally {
        this.submitting = false
      }
    },

    processHtml(html) {
      if (!html) return ''
      let result = html
      // 1. 先将相对路径转为绝对路径
      result = result.replace(/<img([^>]*?)src="(?!http)(.*?)"([^>]*?)>/gi, (match, before, src, after) => {
        const fullSrc = getImageUrl(src)
        return `<img${before}src="${fullSrc}"${after}>`
      })
      // 2. 对所有img标签统一设置样式
      result = result.replace(/<img([^>]*?)>/gi, (match, attrs) => {
        const cleanAttrs = attrs.replace(/\s*style\s*=\s*"[^"]*"/gi, '').replace(/\s*style\s*=\s*'[^']*'/gi, '')
        return `<img${cleanAttrs} style="max-width:100%;width:100%;height:auto;display:block;">`
      })
      return result
    },

    previewImage(idx) {
      uni.previewImage({
        urls: this.images,
        current: idx
      })
    },

    previewCaseImage(idx) {
      uni.previewImage({
        urls: this.caseImages,
        current: idx
      })
    },

    goBack() {
      uni.navigateBack({ delta: 1 })
    }
  }
}
</script>

<style lang="scss" scoped>
.detail-container {
  height: 100vh;
  background: #f5f7fa;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 导航栏 */
.nav-bar {
  background: #fff;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.04);
}

.nav-content {
  height: 88rpx;
  display: flex;
  align-items: center;
  padding: 0 24rpx;
}

.nav-back {
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #f5f7fa;
}

.back-icon {
  font-size: 44rpx;
  color: #333;
  font-weight: 300;
  margin-top: -4rpx;
}

.nav-title {
  flex: 1;
  text-align: center;
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
}

.nav-placeholder {
  width: 64rpx;
}

/* 轮播图 */
.swiper-section {
  position: relative;
}

.product-swiper {
  width: 100%;
  height: 600rpx;
}

.swiper-image {
  width: 100%;
  height: 100%;
}

.swiper-empty {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #f0f0f0;
}

.swiper-empty .empty-icon {
  font-size: 80rpx;
  margin-bottom: 12rpx;
}

.swiper-empty .empty-text {
  font-size: 26rpx;
  color: #999;
}

.image-counter {
  position: absolute;
  bottom: 24rpx;
  right: 24rpx;
  background: rgba(0,0,0,0.5);
  padding: 6rpx 16rpx;
  border-radius: 20rpx;

  text {
    font-size: 22rpx;
    color: #fff;
  }
}

/* 价格区域 */
.price-section {
  background: linear-gradient(135deg, #fff5f5, #fff);
  padding: 28rpx 30rpx;
  margin-bottom: 2rpx;
}

.price-main-row {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
}

.price-type-label {
  font-size: 24rpx;
  color: #CD371E;
  margin-right: 12rpx;
  font-weight: 500;
}

.price-main {
  display: flex;
  align-items: baseline;
}

.price-symbol {
  font-size: 30rpx;
  color: #CD371E;
  font-weight: 700;
}

.price-big {
  font-size: 52rpx;
  color: #CD371E;
  font-weight: 700;
  margin-left: 4rpx;
}

.price-unit {
  font-size: 22rpx;
  color: #CD371E;
  margin-left: 4rpx;
}

.price-original {
  margin-left: 16rpx;
  text {
    font-size: 24rpx;
    color: #bbb;
    text-decoration: line-through;
  }
}

.price-filter-row {
  display: flex;
  align-items: center;
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 1rpx dashed #f0d0d0;
}

.filter-label {
  font-size: 24rpx;
  color: #E9800E;
  margin-right: 12rpx;
  font-weight: 500;
}

.filter-price {
  display: flex;
  align-items: baseline;
}

.filter-symbol {
  font-size: 22rpx;
  color: #E9800E;
  font-weight: 600;
}

.filter-value {
  font-size: 36rpx;
  color: #E9800E;
  font-weight: 700;
  margin-left: 2rpx;
}

.filter-unit {
  font-size: 22rpx;
  color: #E9800E;
  margin-left: 4rpx;
}

.price-tags {
  display: flex;
  margin-top: 16rpx;
}

.price-tag {
  padding: 6rpx 18rpx;
  border-radius: 20rpx;
  background: #fff0e6;
  margin-right: 12rpx;

  text {
    font-size: 22rpx;
    color: #ff6b35;
    font-weight: 500;
  }

  &.tag-rental {
    background: #e6f7ee;
    text {
      color: #07c160;
    }
  }
}

/* 租赁价格卡片 */
.lease-card {
  background: linear-gradient(135deg, #e6f7ee, #f0fff5);
  padding: 24rpx 30rpx;
  margin: 16rpx 24rpx;
  border-radius: 16rpx;
  border: 1rpx solid #d4edd8;
}

.lease-title-row {
  margin-bottom: 12rpx;
}

.lease-title {
  font-size: 26rpx;
  color: #07c160;
  font-weight: 600;
}

.lease-price-row {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
}

.lease-symbol {
  font-size: 26rpx;
  color: #CD371E;
  font-weight: 700;
}

.lease-big {
  font-size: 44rpx;
  color: #CD371E;
  font-weight: 700;
  margin-left: 2rpx;
}

.lease-unit {
  font-size: 22rpx;
  color: #CD371E;
  margin-left: 4rpx;
}

.lease-original {
  margin-left: 16rpx;
  text {
    font-size: 22rpx;
    color: #bbb;
    text-decoration: line-through;
  }
}

/* 标题区域 */
.title-section {
  background: #fff;
  padding: 28rpx 30rpx;
  margin-bottom: 16rpx;
}

.product-title {
  font-size: 34rpx;
  color: #222;
  font-weight: 600;
  line-height: 1.5;
}

.product-meta {
  display: flex;
  flex-wrap: wrap;
  margin-top: 16rpx;
}

.meta-item {
  font-size: 24rpx;
  color: #888;
  margin-right: 24rpx;
  background: #f5f7fa;
  padding: 6rpx 16rpx;
  border-radius: 8rpx;
}

/* 通用 section */
.vendor-section, .specs-section {
  background: #fff;
  padding: 28rpx 30rpx;
  margin-bottom: 16rpx;
}

.section-header {
  display: flex;
  align-items: center;
  margin-bottom: 20rpx;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid #f5f5f5;
}

.section-icon {
  font-size: 32rpx;
  margin-right: 10rpx;
}

.section-title {
  font-size: 30rpx;
  color: #333;
  font-weight: 600;
}

/* 供应商信息 */
.vendor-info {
  padding: 0 8rpx;
}

.vendor-row {
  display: flex;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f8f8f8;

  &:last-child {
    border-bottom: none;
  }
}

.vendor-label {
  font-size: 26rpx;
  color: #666;
  width: 140rpx;
  flex-shrink: 0;
}

.vendor-value {
  font-size: 26rpx;
  color: #333;
  flex: 1;
}

/* 规格参数 */
.specs-grid {
  display: flex;
  flex-wrap: wrap;
}

.spec-item {
  width: 50%;
  display: flex;
  flex-direction: column;
  padding: 14rpx 8rpx;
  box-sizing: border-box;
}

.spec-label {
  font-size: 22rpx;
  color: #999;
  margin-bottom: 6rpx;
}

.spec-value {
  font-size: 26rpx;
  color: #333;
}

/* Tab 切换 */
.tab-section {
  background: #fff;
  margin-bottom: 16rpx;
}

.tab-bar {
  display: flex;
  border-bottom: 1rpx solid #f0f0f0;
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24rpx 0 20rpx;
  position: relative;

  text {
    font-size: 28rpx;
    color: #666;
  }

  &.active text {
    color: #CD371E;
    font-weight: 600;
  }
}

.tab-line {
  position: absolute;
  bottom: 0;
  width: 60rpx;
  height: 4rpx;
  background: #CD371E;
  border-radius: 2rpx;
}

.tab-content {
  padding: 24rpx 30rpx;
  min-height: 200rpx;
}

.tab-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 80rpx 0;
}

.tab-empty-text {
  font-size: 28rpx;
  color: #999;
}

/* 富文本详情 */
.rich-content {
  overflow: hidden;
}

/* 案例图片 */
.case-gallery {
  display: flex;
  flex-direction: column;
}

.case-image {
  width: 100%;
  border-radius: 12rpx;
  margin-bottom: 12rpx;
}

.bottom-space {
  height: 140rpx;
}

/* 底部操作栏 */
.bottom-bar {
  display: flex;
  align-items: center;
  background: #fff;
  padding: 16rpx 24rpx;
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
  box-shadow: 0 -4rpx 16rpx rgba(0,0,0,0.06);
  position: relative;
  z-index: 50;
}

.bar-action {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 24rpx;
  flex-shrink: 0;

  &.is-collected {
    .bar-icon {
      color: #ff4d4f;
    }
    .bar-label {
      color: #ff4d4f;
    }
  }
}

.bar-icon {
  font-size: 40rpx;
  color: #666;
  line-height: 1;
}

.bar-label {
  font-size: 20rpx;
  color: #666;
  margin-top: 4rpx;
}

.bar-btn {
  flex: 1;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #CD371E, #e85d3a);
  border-radius: 40rpx;
  margin-left: 24rpx;

  text {
    font-size: 30rpx;
    color: #fff;
    font-weight: 600;
  }
}

/* 预约弹窗 */
.popup-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  z-index: 200;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.popup-content {
  width: 100%;
  background: #fff;
  border-radius: 32rpx 32rpx 0 0;
  overflow: hidden;
}

.popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 30rpx 32rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.popup-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
}

.popup-close {
  font-size: 36rpx;
  color: #999;
  padding: 8rpx;
}

.popup-body {
  padding: 24rpx 32rpx;
}

.form-item {
  display: flex;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f5f5f5;

  &:last-child {
    border-bottom: none;
  }
}

.form-label {
  font-size: 28rpx;
  color: #333;
  width: 140rpx;
  flex-shrink: 0;
}

.form-input {
  flex: 1;
  font-size: 28rpx;
  color: #333;
  height: 72rpx;
}

.form-num {
  display: flex;
  align-items: center;
}

.num-btn {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  border-radius: 12rpx;
  font-size: 36rpx;
  color: #333;
}

.num-value {
  font-size: 32rpx;
  color: #333;
  min-width: 80rpx;
  text-align: center;
}

.popup-footer {
  padding: 16rpx 32rpx 32rpx;
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
}

.popup-submit-btn {
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #CD371E, #e85d3a);
  border-radius: 44rpx;

  text {
    font-size: 32rpx;
    color: #fff;
    font-weight: 600;
  }
}

/* 加载状态 */
.loading-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.loading-spinner {
  width: 64rpx;
  height: 64rpx;
  border: 4rpx solid #eee;
  border-top-color: var(--theme, #4e6ef2);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 20rpx;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: 28rpx;
  color: #999;
}

.detail-scroll {
  flex: 1;
  height: 0;
}
</style>
