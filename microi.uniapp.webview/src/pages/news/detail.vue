<template>
  <view class="detail-container" :style="'--theme:' + themeColor + ';--theme-light:' + themeColorLight + ';--theme-gradient:' + themeGradient">
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

    <scroll-view class="detail-scroll" scroll-y v-if="!loading && article">
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

    <!-- 加载状态 -->
    <view class="loading-state" v-if="loading">
      <view class="loading-spinner"></view>
      <text class="loading-text">{{ t('common.loading') }}</text>
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
import appConfig from '@/utils/config.js'
import { themeMixin } from '@/utils/theme.js'

export default {
  mixins: [themeMixin],
  data() {
    return {
      statusBarHeight: 44,
      articleId: '',
      article: null,
      coverImage: '',
      loading: true
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
    try {
      const info = uni.getWindowInfo()
      this.statusBarHeight = info.statusBarHeight || 44
    } catch (e) {
      try {
        this.statusBarHeight = uni.getSystemInfoSync().statusBarHeight || 44
      } catch (e2) {}
    }

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
  min-height: 100vh;
  background: #fff;
  display: flex;
  flex-direction: column;
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
  flex: 1;
  height: 0;
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
  background: var(--theme, #4e6ef2);
  border-radius: 40rpx;

  text {
    font-size: 28rpx;
    color: #fff;
  }
}
</style>
