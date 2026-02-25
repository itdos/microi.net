<template>
  <view class="news-container" :style="'--theme:' + themeColor + ';--theme-light:' + themeColorLight + ';--theme-gradient:' + themeGradient">
    <!-- 顶部区域 -->
    <view class="news-header" :style="{ paddingTop: statusBarHeight + 'px', background: themeGradient }">
      <view class="header-content">
        <text class="header-title">{{ t('news.title') }}</text>
        <text class="header-sub">{{ t('news.subtitle') }}</text>
      </view>
    </view>

    <!-- 轮播图 -->
    <view class="banner-section" v-if="banners.length > 0">
      <swiper
        class="banner-swiper"
        :indicator-dots="true"
        indicator-color="rgba(255,255,255,0.4)"
        indicator-active-color="#ffffff"
        :autoplay="true"
        :circular="true"
        :interval="4000"
      >
        <swiper-item v-for="(item, idx) in banners" :key="idx">
          <image
            class="banner-image"
            :src="getBannerImage(item)"
            mode="aspectFill"
            @tap="onBannerTap(item)"
          />
        </swiper-item>
      </swiper>
    </view>

    <!-- 资讯列表 -->
    <scroll-view
      class="news-list-wrap"
      scroll-y
      :refresher-enabled="true"
      :refresher-triggered="refreshing"
      @refresherrefresh="onRefresh"
      @scrolltolower="loadMore"
    >
      <!-- 列表内容 -->
      <view class="news-list" v-if="newsList.length > 0">
        <!-- 第一条大图 -->
        <view class="news-item-featured" v-if="newsList.length > 0" @tap="goDetail(newsList[0].Id)">
          <image class="featured-image" :src="getNewsImage(newsList[0])" mode="aspectFill" />
          <view class="featured-overlay">
            <text class="featured-title">{{ newsList[0].Biaoti }}</text>
            <view class="featured-meta">
              <text class="meta-time">{{ formatTime(newsList[0].UpdateTime) }}</text>
              <text class="meta-views" v-if="newsList[0].BrowseNum">👁 {{ newsList[0].BrowseNum }}</text>
            </view>
          </view>
        </view>

        <!-- 普通列表 -->
        <view
          class="news-item"
          v-for="item in newsList.slice(1)"
          :key="item.Id"
          @tap="goDetail(item.Id)"
        >
          <view class="news-item-content">
            <view class="news-item-text">
              <text class="news-item-title">{{ item.Biaoti }}</text>
              <view class="news-item-meta">
                <text class="meta-time">{{ formatTime(item.UpdateTime) }}</text>
                <text class="meta-views" v-if="item.BrowseNum">👁 {{ item.BrowseNum }}</text>
              </view>
            </view>
            <image
              v-if="getNewsImage(item)"
              class="news-item-thumb"
              :src="getNewsImage(item)"
              mode="aspectFill"
            />
          </view>
        </view>
      </view>

      <!-- 空状态 -->
      <view class="empty-state" v-if="!loading && newsList.length === 0">
        <text class="empty-icon">📰</text>
        <text class="empty-text">{{ t('news.noNews') }}</text>
        <text class="empty-sub">{{ t('news.checkLater') }}</text>
      </view>

      <!-- 加载更多 -->
      <view class="load-more" v-if="newsList.length > 0">
        <text v-if="loadingMore" class="load-more-text">{{ t('common.loading') }}</text>
        <text v-else-if="noMore" class="load-more-text">{{ t('common.noMore') }}</text>
      </view>
    </scroll-view>

    <!-- 骨架屏 -->
    <view class="skeleton-wrap" v-if="loading && newsList.length === 0">
      <view class="skeleton-featured">
        <view class="skeleton-shimmer"></view>
      </view>
      <view class="skeleton-item" v-for="i in 4" :key="i">
        <view class="skeleton-text">
          <view class="skeleton-line skeleton-title-line"></view>
          <view class="skeleton-line skeleton-meta-line"></view>
        </view>
        <view class="skeleton-thumb"></view>
      </view>
    </view>
  </view>
</template>

<script>
import { getNewsList, getBannerList, parseImages, getImageUrl } from '@/utils/api.js'
import appConfig from '@/utils/config.js'
import { themeMixin } from '@/utils/theme.js'

export default {
  mixins: [themeMixin],
  data() {
    return {
      statusBarHeight: 44,
      banners: [],
      newsList: [],
      loading: true,
      loadingMore: false,
      refreshing: false,
      noMore: false,
      pageIndex: 1,
      pageSize: 10
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
    this.loadBanners()
    this.loadNews()
  },

  methods: {
    // 加载轮播图
    async loadBanners() {
      try {
        const res = await getBannerList()
        if (res.Code === 1 && res.Data) {
          this.banners = res.Data
        }
      } catch (e) {
        console.log('[News] loadBanners:', e.message)
      }
    },

    // 加载资讯列表
    async loadNews(append = false) {
      if (!append) {
        this.loading = true
        this.pageIndex = 1
        this.noMore = false
      }
      try {
        const res = await getNewsList({
          pageIndex: this.pageIndex,
          pageSize: this.pageSize
        })
        if (res.Code === 1) {
          const list = res.Data || []
          if (append) {
            this.newsList = [...this.newsList, ...list]
          } else {
            this.newsList = list
          }
          if (list.length < this.pageSize) {
            this.noMore = true
          }
        }
      } catch (e) {
        console.error('[News] loadNews error:', e)
      } finally {
        this.loading = false
        this.loadingMore = false
        this.refreshing = false
      }
    },

    // 获取资讯封面图
    getNewsImage(item) {
      if (!item.Tupian) return ''
      const imgs = parseImages(item.Tupian)
      if (imgs.length > 0) return imgs[0]
      return getImageUrl(item.Tupian)
    },

    // 获取轮播图图片
    getBannerImage(item) {
      if (!item.Tupian) return ''
      return getImageUrl(item.Tupian)
    },

    // 轮播图点击
    onBannerTap(item) {
      if (item.Leixing === '商品' && item.Lianjie) {
        uni.navigateTo({ url: '/pages/mall/detail?id=' + item.Lianjie })
      } else if (item.Leixing === '链接' && item.Lianjie) {
        // 外部链接暂不处理
      }
    },

    // 格式化时间
    formatTime(t) {
      if (!t) return ''
      // 简单格式化：取日期部分
      const d = new Date(t.replace(/-/g, '/'))
      if (isNaN(d.getTime())) return t
      const now = new Date()
      const diff = now.getTime() - d.getTime()
      const day = 86400000
      if (diff < day) return '今天'
      if (diff < 2 * day) return '昨天'
      if (diff < 7 * day) return Math.floor(diff / day) + '天前'
      const m = d.getMonth() + 1
      const dd = d.getDate()
      if (d.getFullYear() === now.getFullYear()) {
        return m + '月' + dd + '日'
      }
      return d.getFullYear() + '/' + m + '/' + dd
    },

    // 下拉刷新
    onRefresh() {
      this.refreshing = true
      this.loadBanners()
      this.loadNews()
    },

    // 加载更多
    loadMore() {
      if (this.loadingMore || this.noMore) return
      this.loadingMore = true
      this.pageIndex++
      this.loadNews(true)
    },

    // 跳转详情
    goDetail(id) {
      uni.navigateTo({
        url: '/pages/news/detail?id=' + id
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.news-container {
  height: 100vh;
  background: #f5f7fa;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 顶部 */
.news-header {
  background: var(--theme-gradient, linear-gradient(135deg, #4e6ef2, #6b8aff));
  padding-bottom: 24rpx;
}

.header-content {
  padding: 16rpx 32rpx 0;
}

.header-title {
  font-size: 44rpx;
  color: #fff;
  font-weight: 700;
  display: block;
}

.header-sub {
  font-size: 24rpx;
  color: rgba(255,255,255,0.7);
  margin-top: 4rpx;
  display: block;
}

/* 轮播图 */
.banner-section {
  margin: 16rpx 24rpx 16rpx;
  border-radius: 20rpx;
  overflow: hidden;
  box-shadow: 0 8rpx 24rpx rgba(0,0,0,0.1);
}

.banner-swiper {
  height: 320rpx;
}

.banner-image {
  width: 100%;
  height: 100%;
  border-radius: 20rpx;
}

/* 资讯列表 */
.news-list-wrap {
  flex: 1;
  height: 0;
}

.news-list {
  padding: 0 24rpx 24rpx;
}

/* 大图文章 */
.news-item-featured {
  position: relative;
  border-radius: 20rpx;
  overflow: hidden;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.08);
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:active {
    transform: scale(0.98);
    box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.12);
  }
}

.featured-image {
  width: 100%;
  height: 360rpx;
}

.featured-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 40rpx 28rpx 24rpx;
  background: linear-gradient(transparent, rgba(0,0,0,0.7));
}

.featured-title {
  font-size: 32rpx;
  color: #fff;
  font-weight: 600;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.4;
}

.featured-meta {
  display: flex;
  align-items: center;
  margin-top: 10rpx;
}

.featured-meta .meta-time,
.featured-meta .meta-views {
  font-size: 22rpx;
  color: rgba(255,255,255,0.7);
  margin-right: 20rpx;
}

/* 普通列表项 */
.news-item {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.06);
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:active {
    transform: scale(0.98);
    box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.08);
  }
}

.news-item-content {
  display: flex;
  align-items: flex-start;
}

.news-item-text {
  flex: 1;
  margin-right: 20rpx;
}

.news-item-title {
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.news-item-meta {
  display: flex;
  align-items: center;
  margin-top: 12rpx;
}

.meta-time {
  font-size: 22rpx;
  color: #999;
  margin-right: 20rpx;
}

.meta-views {
  font-size: 22rpx;
  color: #999;
}

.news-item-thumb {
  width: 200rpx;
  height: 140rpx;
  border-radius: 12rpx;
  flex-shrink: 0;
  background: #f5f5f5;
}

/* 空状态 */
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
  font-size: 32rpx;
  color: #666;
  font-weight: 500;
}

.empty-sub {
  font-size: 26rpx;
  color: #999;
  margin-top: 8rpx;
}

/* 加载更多 */
.load-more {
  text-align: center;
  padding: 32rpx 0 48rpx;
}

.load-more-text {
  font-size: 24rpx;
  color: #999;
}

/* 骨架屏 */
.skeleton-wrap {
  padding: 0 24rpx;
}

.skeleton-featured {
  height: 360rpx;
  border-radius: 20rpx;
  overflow: hidden;
  margin-bottom: 20rpx;
}

.skeleton-shimmer {
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
  background-size: 400% 100%;
  animation: shimmer 1.5s infinite;
}

.skeleton-item {
  display: flex;
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
}

.skeleton-text {
  flex: 1;
  margin-right: 20rpx;
}

.skeleton-line {
  background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
  background-size: 400% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 8rpx;
}

.skeleton-title-line {
  height: 28rpx;
  width: 80%;
  margin-bottom: 16rpx;
}

.skeleton-meta-line {
  height: 22rpx;
  width: 50%;
}

.skeleton-thumb {
  width: 200rpx;
  height: 140rpx;
  border-radius: 12rpx;
  flex-shrink: 0;
  background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
  background-size: 400% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
