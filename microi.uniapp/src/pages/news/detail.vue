<template>
  <view class="detail-container" :style="[mciTokenStyle, { '--theme': themeColor, '--theme-light': themeColorLight, '--theme-gradient': themeGradient }]">
    <!-- 自定义导航栏 -->
    <view class="nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content">
        <view class="nav-back" @tap="goBack">
          <text class="back-icon">‹</text>
        </view>
        <text class="nav-title">{{ t('news.newsDetail') }}</text>
        <view class="nav-placeholder"></view>
      </view>
    </view>

    <scroll-view class="detail-scroll" scroll-y v-if="!loading && article" :style="{ height: scrollHeight + 'px' }">
      <!-- 文章标题 -->
      <view class="article-header">
        <text class="article-title">{{ article.Biaoti }}</text>
        <view class="article-meta">
          <text class="meta-time" v-if="article.UpdateTime">{{ formatTime(article.UpdateTime) }}</text>
          <text class="meta-views" v-if="article.BrowseNum">{{ article.BrowseNum }} {{ t('common.views') }}</text>
        </view>
      </view>

      <!-- 封面图 -->
      <view class="cover-section" v-if="coverImage">
        <image class="cover-image" :src="coverImage" mode="widthFix" />
      </view>

      <!-- 文章内容 -->
      <view class="article-body">
        <rich-text :nodes="processedContent" />
      </view>

      <!-- 底部信息 -->
      <view class="article-footer">
        <view class="footer-line"></view>
        <text class="footer-text">{{ t('common.end') }}</text>
      </view>

      <view class="bottom-space"></view>
    </scroll-view>

    <!-- 加载骨架屏 -->
    <view class="article-skeleton" v-if="loading">
      <view class="skeleton-panel skeleton-header">
        <view class="skeleton-line skeleton-title-line"></view>
        <view class="skeleton-line skeleton-title-short"></view>
        <view class="skeleton-line skeleton-meta-line"></view>
      </view>
      <view class="skeleton-cover"></view>
      <view class="skeleton-panel skeleton-body">
        <view class="skeleton-line" v-for="i in 7" :key="i" :class="{ 'is-short': i === 7 }"></view>
      </view>
    </view>

    <!-- 错误状态 -->
    <view class="error-state" v-if="!loading && !article">
      <text class="error-icon">😕</text>
      <text class="error-text">{{ t('news.articleNotFound') }}</text>
      <view class="error-btn" :style="{ background: themeColor }" @tap="goBack">
        <text>{{ t('news.backToList') }}</text>
      </view>
    </view>
  </view>
</template>

<script>
import { getNewsDetail, getImageUrl, parseImages } from '@/utils/api.js'
import appConfig from '@/config.js'
import { themeMixin } from '@/utils/theme.js'

export default {
  mixins: [themeMixin],
  data() {
    return {
      statusBarHeight: 44,
      articleId: '',
      article: null,
      coverImage: '',
      loading: true,
      // iOS WeChat 下 flex:1 + height:0 会让 scroll-view 计算不到高度导致空白，
      // 直接用 window.windowHeight - navHeight 得到像素高度。
      scrollHeight: 600
    }
  },

  computed: {
    processedContent() {
      if (!this.article || !this.article.Neirong) return ''
      let html = this.article.Neirong
      // 1. 处理图片：相对路径转绝对路径
      html = html.replace(/<img([^>]*?)src="(?!http|data:)(.*?)"([^>]*?)>/gi, (match, before, src, after) => {
        const fullSrc = getImageUrl(src)
        return '<img' + before + 'src="' + fullSrc + '"' + after + '>'
      })
      // 2. 统一处理所有img标签样式：先移除已有style，再添加自适应样式
      html = html.replace(/<img([^>]*?)>/gi, (match, attrs) => {
        const cleanAttrs = attrs.replace(/\s*style\s*=\s*"[^"]*"/gi, '').replace(/\s*style\s*=\s*'[^']*'/gi, '')
        return '<img' + cleanAttrs + ' style="max-width:100%;width:100%;height:auto;display:block;margin:16rpx 0;">'
      })
      return html
    }
  },

  onLoad(options) {
    let windowHeight = 667
    try {
      const info = uni.getWindowInfo()
      this.statusBarHeight = info.statusBarHeight || 44
      windowHeight = info.windowHeight || info.screenHeight || 667
    } catch (e) {
      try {
        const sys = uni.getSystemInfoSync()
        this.statusBarHeight = sys.statusBarHeight || 44
        windowHeight = sys.windowHeight || 667
      } catch (e2) {}
    }
    // 自定义导航栏高度 = statusBar + 44（navContent 高度 88rpx ≈ 44px）
    this.scrollHeight = Math.max(300, windowHeight - this.statusBarHeight - 44)

    this.articleId = options.id
    if (this.articleId) {
      this.loadDetail()
    } else {
      this.loading = false
    }
  },

  methods: {
    async loadDetail() {
      this.loading = true
      try {
        const res = await getNewsDetail(this.articleId)
        if (res.Code === 1 && res.Data) {
          this.article = res.Data
          // 处理封面图
          const imgs = parseImages(res.Data.Tupian)
          this.coverImage = imgs.length > 0 ? imgs[0] : ''
        }
      } catch (e) {
        console.error('[News Detail] error:', e)
      } finally {
        this.loading = false
      }
    },

    formatTime(t) {
      if (!t) return ''
      const d = new Date(t.replace(/-/g, '/'))
      if (isNaN(d.getTime())) return t
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      const hh = String(d.getHours()).padStart(2, '0')
      const mm = String(d.getMinutes()).padStart(2, '0')
      return y + '-' + m + '-' + dd + ' ' + hh + ':' + mm
    },

    goBack() {
      uni.navigateBack({ delta: 1 })
    }
  }
}
</script>

<style lang="scss" scoped>
.detail-container {
  /* iOS WeChat 下 min-height:100vh + flex:1 会导致子 scroll-view 高度为 0 出现空白，
     改为 height:100vh 确保 flex 子项有明确父高度可以计算。 */
  height: 100vh;
  background: #fff;
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

.detail-scroll {
  /* 高度由 :style 动态计算，确保 iOS WeChat 下可正确滚动。 */
  width: 100%;
}

/* 文章标题 */
.article-header {
  padding: 36rpx 32rpx 24rpx;
}

.article-title {
  font-size: 40rpx;
  color: #222;
  font-weight: 700;
  line-height: 1.5;
  display: block;
}

.article-meta {
  display: flex;
  align-items: center;
  margin-top: 20rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid #f5f5f5;
}

.meta-time {
  font-size: 24rpx;
  color: #999;
  margin-right: 24rpx;
}

.meta-views {
  font-size: 24rpx;
  color: #999;
}

/* 封面图 */
.cover-section {
  padding: 0 32rpx 24rpx;
}

.cover-image {
  width: 100%;
  border-radius: 16rpx;
}

/* 文章内容 */
.article-body {
  padding: 0 32rpx;
  line-height: 1.8;
  font-size: 30rpx;
  color: #333;
  word-break: break-all;
}

/* 底部 */
.article-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 0 20rpx;
}

.footer-line {
  width: 120rpx;
  height: 2rpx;
  background: #eee;
  margin-bottom: 16rpx;
}

.footer-text {
  font-size: 24rpx;
  color: #ccc;
}

.bottom-space {
  height: 60rpx;
}

/* 加载骨架屏 */
.article-skeleton {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  padding: 30rpx 32rpx 80rpx;
  overflow: hidden;
}

.skeleton-panel {
  padding: 28rpx;
  border-radius: 28rpx;
  background: var(--mci-bg-elevated);
  border: 1rpx solid var(--mci-border-color);
  box-shadow: var(--mci-shadow-sm);
}

.skeleton-cover {
  height: 360rpx;
  border-radius: 28rpx;
}

.skeleton-cover,
.skeleton-line {
  background: linear-gradient(90deg, var(--mci-bg-surface) 25%, var(--mci-bg-card-hover) 50%, var(--mci-bg-surface) 75%);
  background-size: 400% 100%;
  animation: mciShimmer 1.5s ease infinite;
}

.skeleton-line {
  height: 24rpx;
  border-radius: 999rpx;
  margin-bottom: 20rpx;
}

.skeleton-line:last-child {
  margin-bottom: 0;
}

.skeleton-title-line {
  width: 86%;
  height: 36rpx;
}

.skeleton-title-short {
  width: 58%;
  height: 36rpx;
}

.skeleton-meta-line {
  width: 38%;
  height: 22rpx;
  margin-top: 16rpx;
}

.skeleton-body .skeleton-line {
  width: 100%;
}

.skeleton-body .skeleton-line.is-short {
  width: 64%;
}

/* 错误状态 */
.error-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.error-icon {
  font-size: 80rpx;
  margin-bottom: 24rpx;
}

.error-text {
  font-size: 30rpx;
  color: #666;
  margin-bottom: 36rpx;
}

.error-btn {
  padding: 16rpx 48rpx;
  background: var(--theme, #6C2BD9);
  border-radius: 40rpx;

  text {
    font-size: 28rpx;
    color: #fff;
  }
}
</style>
