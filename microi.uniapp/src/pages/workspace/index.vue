<template>
  <view class="workspace-container" :style="'--theme:' + themeColor + ';--theme-light:' + themeColorLight + ';--theme-gradient:' + themeGradient">
    <!-- 顶部区域 -->
    <view class="ws-header" :style="{ paddingTop: statusBarHeight + 'px', background: themeGradient }">
      <view class="header-bg">
        <view class="bg-circle c1"></view>
        <view class="bg-circle c2"></view>
      </view>
      <view class="header-content">
        <view class="header-top">
          <view class="header-left">
            <image class="ws-logo" :src="logoUrl" mode="aspectFit" />
            <view class="header-text">
              <text class="ws-title">{{ t('workspace.title') }}</text>
              <text class="ws-subtitle">{{ appName }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 未登录提示 -->
    <view class="login-prompt" v-if="!isLoggedIn">
      <view class="prompt-card">
        <text class="prompt-icon">🔒</text>
        <text class="prompt-title">{{ t('common.loginFirst') }}</text>
        <text class="prompt-desc">{{ t('workspace.loginHint') }}</text>
        <view class="prompt-btn" :style="{ background: themeGradient }" @tap="goLogin">
          <text>{{ t('common.loginNow') }}</text>
        </view>
      </view>
    </view>

    <!-- 内容区域 -->
    <scroll-view
      v-else
      class="ws-content"
      scroll-y
      :refresher-enabled="true"
      :refresher-triggered="refreshing"
      @refresherrefresh="onRefresh"
    >
      <!-- 骨架屏 -->
      <view v-if="loading && menuList.length === 0" class="skeleton-wrap">
        <view class="sk-card" v-for="i in 3" :key="i">
          <view class="sk-card-header"></view>
          <view class="sk-card-body">
            <view class="sk-grid-item" v-for="j in 4" :key="j">
              <view class="sk-icon-circle"></view>
              <view class="sk-text-line"></view>
            </view>
          </view>
        </view>
      </view>

      <!-- 菜单卡片 -->
      <view v-else class="menu-cards">
        <!-- 空状态 -->
        <view class="empty-ws" v-if="menuList.length === 0 && !loading">
          <text class="empty-icon">📋</text>
          <text class="empty-text">{{ t('workspace.noMenu') }}</text>
          <text class="empty-sub">{{ t('workspace.contactAdmin') }}</text>
        </view>

        <view
          v-for="menu in menuList"
          :key="menu.Id"
          class="menu-card"
        >
          <!-- 卡片头部 -->
          <view class="card-header" :style="{ background: themeGradient }">
            <view class="card-header-icon">
              <text>{{ getMenuEmoji(menu) }}</text>
            </view>
            <text class="card-header-title">{{ menu.meta && menu.meta.title || menu.name || t('workspace.menu') }}</text>
          </view>

          <!-- 子菜单网格 -->
          <view class="card-grid">
            <view
              v-for="child in getVisibleChildren(menu.children)"
              :key="child.Id"
              class="grid-item"
              @tap="handleMenuClick(child)"
            >
              <view class="grid-icon-wrap">
                <text class="grid-icon">{{ getMenuEmoji(child) }}</text>
              </view>
              <text class="grid-name">{{ child.meta && child.meta.title || child.name || '' }}</text>
              <view class="has-sub-badge" v-if="child.children && getVisibleChildren(child.children).length > 0">
                <text>⟩</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- 底部 powered by -->
      <view class="ws-footer">
        <text>Powered by {{ companyName || 'Microi.net' }}</text>
      </view>
    </scroll-view>

    <!-- 子菜单弹窗 -->
    <view class="submenu-mask" v-if="showSubMenu" @tap="closeSubMenu">
      <view class="submenu-panel" @tap.stop>
        <view class="submenu-header">
          <view class="submenu-back" v-if="subMenuStack.length > 1" @tap="goBackSubMenu">
            <text>‹ {{ t('common.back') }}</text>
          </view>
          <text class="submenu-title">{{ currentSubMenu && currentSubMenu.meta && currentSubMenu.meta.title || t('workspace.subMenu') }}</text>
          <text class="submenu-close" @tap="closeSubMenu">✕</text>
        </view>
        <scroll-view class="submenu-list" scroll-y>
          <view
            v-for="item in currentSubMenuItems"
            :key="item.Id"
            class="submenu-item"
            @tap="handleSubMenuClick(item)"
          >
            <view class="submenu-item-icon">
              <text>{{ getMenuEmoji(item) }}</text>
            </view>
            <text class="submenu-item-name">{{ item.meta && item.meta.title || item.name || '' }}</text>
            <text class="submenu-item-arrow" v-if="item.children && getVisibleChildren(item.children).length > 0">›</text>
          </view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script>
import { getToken, getUser } from '@/utils/request.js'
import { post } from '@/utils/request.js'
import appConfig from '@/utils/config.js'
import { themeMixin } from '@/utils/theme.js'
import { getSysConfig, getServerPath } from '@/utils/sysconfig.js'
import { getSourceTag } from '@/utils/platform.js'

export default {
  mixins: [themeMixin],
  data() {
    return {
      statusBarHeight: 44,
      isLoggedIn: false,
      loading: true,
      refreshing: false,
      menuList: [],
      appName: appConfig.appName || '',
      logoUrl: appConfig.logoUrl || '/static/microi-blue-256.png',
      companyName: '',
      // 子菜单
      showSubMenu: false,
      currentSubMenu: null,
      currentSubMenuItems: [],
      subMenuStack: []
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
    this.loadSysConfig()
  },

  onShow() {
    const token = getToken()
    this.isLoggedIn = !!token
    if (this.isLoggedIn) {
      this.loadMenus()
    } else {
      this.loading = false
    }
  },

  methods: {
    async loadSysConfig() {
      try {
        const cfg = await getSysConfig()
        if (cfg) {
          if (cfg.SysTitle) this.appName = cfg.SysTitle
          if (cfg.CompanyName) this.companyName = cfg.CompanyName
          if (cfg.SysLogo) this.logoUrl = getServerPath(cfg.SysLogo)
        }
      } catch (e) {}
    },

    // 加载菜单数据（参考 microi.web/src/pinia/modules/permission.js）
    // 使用与 web 端相同的 SysMenu/GetSysMenuStep 接口
    async loadMenus() {
      this.loading = true
      try {
        const res = await post('/api/SysMenu/GetSysMenuStep', {
          OsClient: appConfig.osClient,
          TableName: 'Sys_Menu',
          _OrderBy: 'Sort',
          _OrderByType: 'ASC'
        }, true)
        if (res.Code === 1 && res.Data) {
          // 将 SysMenu 结构转为显示用的菜单树
          this.menuList = this.buildMenuTree(res.Data || [])
        }
      } catch (e) {
        console.error('[Workspace] loadMenus error:', e)
      } finally {
        this.loading = false
        this.refreshing = false
      }
    },

    /**
     * 将后端 SysMenu 结构转为小程序显示用的菜单树
     * SysMenu 字段映射：
     *   Name → meta.title
     *   IconClass → meta.icon
     *   Display → Display (PC端显示标志)
     *   AppDisplay → AppDisplay (移动端显示标志，优先检查)
     *   Url → path
     *   Link → Link (外部链接)
     *   _Child → children (递归)
     *   DiyTableId → 关联表引擎ID
     */
    buildMenuTree(sysMenus) {
      if (!Array.isArray(sysMenus)) return []

      const result = []
      for (const item of sysMenus) {
        const menu = this.convertSysMenu(item)
        if (!menu) continue

        // 顶级菜单（有子菜单的显示为卡片，无子菜单的也显示为独立卡片）
        if (menu.children && menu.children.length > 0) {
          result.push(menu)
        } else if (menu.meta && menu.meta.title) {
          // 无子菜单的顶级项，包装成一个卡片（自身作为唯一子项）
          result.push({
            Id: menu.Id,
            meta: menu.meta,
            Display: menu.Display,
            AppDisplay: menu.AppDisplay,
            children: [menu]
          })
        }
      }
      return result
    },

    convertSysMenu(item) {
      if (!item) return null
      // 过滤掉无名称的项
      if (!item.Name) return null
      // 过滤移动端不显示的项（AppDisplay 为 0 或 false 表示不在移动端显示）
      if (item.AppDisplay === 0 || item.AppDisplay === false || item.AppDisplay === '0') return null
      // 过滤外部 http 链接作为顶级项（但保留 Link 字段用于跳转）
      const url = (item.Url || '').trim()
      if (url.startsWith('http://') || url.startsWith('https://')) return null

      const menu = {
        Id: item.Id,
        path: url || ('/folder-' + (item.Id || '')),
        Display: item.Display,
        AppDisplay: item.AppDisplay,
        Link: item.Link || '',
        DiyTableId: item.DiyTableId || '',
        meta: {
          title: item.Name,
          icon: item.IconClass || '',
          Id: item.Id,
          Display: item.Display,
          DiyTableId: item.DiyTableId
        },
        children: []
      }

      // 递归处理子菜单
      if (item._Child && Array.isArray(item._Child) && item._Child.length > 0) {
        for (const child of item._Child) {
          const childMenu = this.convertSysMenu(child)
          if (childMenu) {
            menu.children.push(childMenu)
          }
        }
      }

      return menu
    },

    // 获取可见子菜单（移动端使用 AppDisplay 字段）
    getVisibleChildren(children) {
      if (!children || !Array.isArray(children)) return []
      return children.filter(child => {
        // AppDisplay 控制移动端是否显示（0 或 false 为隐藏）
        if (child.AppDisplay === 0 || child.AppDisplay === false || child.AppDisplay === '0') return false
        if (child.hidden) return false
        // 有标题的才显示
        if (!child.meta || !child.meta.title) return false
        return true
      })
    },

    // 处理菜单点击
    handleMenuClick(menu) {
      const visibleChildren = this.getVisibleChildren(menu.children)
      if (visibleChildren.length > 0) {
        this.currentSubMenu = menu
        this.currentSubMenuItems = visibleChildren
        this.subMenuStack = [menu]
        this.showSubMenu = true
      } else {
        this.navigateToMenu(menu)
      }
    },

    // 处理子菜单点击
    handleSubMenuClick(item) {
      const visibleChildren = this.getVisibleChildren(item.children)
      if (visibleChildren.length > 0) {
        this.subMenuStack.push(item)
        this.currentSubMenu = item
        this.currentSubMenuItems = visibleChildren
      } else {
        this.closeSubMenu()
        this.navigateToMenu(item)
      }
    },

    // 子菜单返回上级
    goBackSubMenu() {
      if (this.subMenuStack.length > 1) {
        this.subMenuStack.pop()
        const parent = this.subMenuStack[this.subMenuStack.length - 1]
        this.currentSubMenu = parent
        this.currentSubMenuItems = this.getVisibleChildren(parent.children)
      }
    },

    closeSubMenu() {
      this.showSubMenu = false
      this.subMenuStack = []
    },

    // 导航到菜单对应页面（通过 webview 加载）
    navigateToMenu(menu) {
      let targetPath = menu.path || ''

      // 外部链接
      if (menu.Link && (menu.Link.startsWith('http://') || menu.Link.startsWith('https://'))) {
        targetPath = menu.Link
      } else {
        const base = appConfig.webviewUrl.replace(/\/$/, '')
        if (targetPath && !targetPath.startsWith('/')) {
          targetPath = '/' + targetPath
        }
        // Web端使用 hash 路由模式，URL格式为 base/#/path
        targetPath = base + '/#' + targetPath
      }

      // 附加 token 参数
      const token = getToken()
      const sep = targetPath.includes('?') ? '&' : '?'
      targetPath += sep + 'token=' + encodeURIComponent(token)
      targetPath += '&source=' + getSourceTag()
      targetPath += '&OsClient=' + appConfig.osClient
      targetPath += '&hideTabBar=1'

      uni.navigateTo({
        url: '/pages/webview/index?url=' + encodeURIComponent(targetPath),
        fail: (err) => {
          console.error('[Workspace] navigate to webview failed:', err)
        }
      })
    },

    onRefresh() {
      this.refreshing = true
      this.loadMenus()
    },

    goLogin() {
      uni.navigateTo({
        url: '/pages/login/index'
      })
    },

    // 根据菜单名称获取 emoji 图标
    getMenuEmoji(menu) {
      const title = (menu.meta && menu.meta.title) || menu.name || ''
      const icon = (menu.meta && menu.meta.icon) || ''

      const map = {
        'dashboard': '📊', 'home': '🏠', 'system': '⚙️', 'user': '👤',
        'setting': '⚙️', 'tool': '🔧', 'monitor': '📡', 'log': '📝',
        'chart': '📈', 'table': '📋', 'form': '📝', 'tree': '🌲',
        'edit': '✏️', 'list': '📃', 'search': '🔍', 'message': '💬',
        'peoples': '👥', 'money': '💰', 'shopping': '🛒', 'star': '⭐',
        'lock': '🔒', 'eye': '👁️', 'guide': '🧭', 'international': '🌐',
        'documentation': '📖', 'bug': '🐛', 'excel': '📊', 'zip': '📦',
        'pdf': '📄', 'clipboard': '📋', 'education': '🎓', 'nested': '📂',
        'component': '🧩', 'tab': '📑', 'link': '🔗', 'example': '💡',
        'email': '📧', 'wechat': '💚', 'skill': '⚡', 'drag': '🖱️',
        'dict': '📚', 'build': '🏗️', 'code': '💻', 'swagger': '🔌',
        'job': '⏰', 'online': '🖥️', 'server': '🖧', 'redis': '🗄️',
        'row': '📊', 'date': '📅', 'number': '🔢'
      }

      const iconLower = icon.toLowerCase()
      for (const [key, emoji] of Object.entries(map)) {
        if (iconLower.includes(key)) return emoji
      }

      const titleMap = {
        '系统': '⚙️', '用户': '👤', '角色': '👥', '菜单': '📋',
        '部门': '🏢', '岗位': '💼', '字典': '📚', '参数': '🔧',
        '通知': '🔔', '日志': '📝', '登录': '🔑', '操作': '⚡',
        '在线': '🟢', '定时': '⏰', '任务': '📌', '代码': '💻',
        '表单': '📝', '流程': '🔄', '设备': '🖥️', '商品': '🛒',
        '订单': '📦', '客户': '🤝', '合同': '📃', '财务': '💰',
        '报表': '📊', '审批': '✅', '考勤': '⏰', '工资': '💵',
        '公告': '📢', '文件': '📁', '资产': '🏠', '库存': '📦',
        '采购': '🛍️', '销售': '💹', '项目': '📋', '会议': '🤝',
        '数据': '📊', '分析': '📈', '配置': '⚙️', '管理': '📋',
        '监控': '📡', '服务': '🔌', '接口': '🔗', '工具': '🔧',
        '企业': '🏢', '租赁': '🔑', '维护': '🛠️', '安装': '📦',
        '净水': '💧', '水源': '💧', '滤芯': '🔄'
      }

      for (const [key, emoji] of Object.entries(titleMap)) {
        if (title.includes(key)) return emoji
      }

      return '📋'
    }
  }
}
</script>

<style lang="scss" scoped>
.workspace-container {
  height: 100vh;
  background: #f5f7fa;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 顶部区域 */
.ws-header {
  position: relative;
  /* bg: themeGradient set inline */
  padding-bottom: 28rpx;
  flex-shrink: 0;
  z-index: 10;
}

.header-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
}

.bg-circle {
  position: absolute;
  border-radius: 50%;
  background: rgba(255,255,255,0.06);

  &.c1 {
    width: 400rpx;
    height: 400rpx;
    top: -100rpx;
    right: -80rpx;
  }
  &.c2 {
    width: 250rpx;
    height: 250rpx;
    bottom: -60rpx;
    left: -60rpx;
  }
}

.header-content {
  position: relative;
  z-index: 1;
  padding: 16rpx 32rpx 0;
}

.header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-left {
  display: flex;
  align-items: center;
}

.ws-logo {
  width: 72rpx;
  height: 72rpx;
  border-radius: 16rpx;
  background: rgba(255,255,255,0.2);
  margin-right: 16rpx;
}

.header-text {
  display: flex;
  flex-direction: column;
}

.ws-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #fff;
}

.ws-subtitle {
  font-size: 22rpx;
  color: rgba(255,255,255,0.7);
  margin-top: 2rpx;
}

/* 未登录提示 */
.login-prompt {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 48rpx;
}

.prompt-card {
  width: 100%;
  background: #fff;
  border-radius: 24rpx;
  padding: 60rpx 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 8rpx 32rpx rgba(0,0,0,0.06);
}

.prompt-icon {
  font-size: 80rpx;
  margin-bottom: 20rpx;
}

.prompt-title {
  font-size: 34rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 12rpx;
}

.prompt-desc {
  font-size: 26rpx;
  color: #999;
  margin-bottom: 40rpx;
}

.prompt-btn {
  /* bg: themeGradient inline */
  padding: 20rpx 80rpx;
  border-radius: 44rpx;
  box-shadow: 0 8rpx 24rpx rgba(78, 110, 242, 0.3);
  transition: transform 0.15s ease;

  &:active {
    transform: scale(0.97);
  }

  text {
    color: #fff;
    font-size: 30rpx;
    font-weight: 500;
  }
}

/* 内容滚动区 */
.ws-content {
  flex: 1;
  height: 0;
}

/* 骨架屏 */
.skeleton-wrap {
  padding: 20rpx 24rpx;
}

.sk-card {
  background: #fff;
  border-radius: 20rpx;
  margin-bottom: 20rpx;
  overflow: hidden;
}

.sk-card-header {
  height: 88rpx;
  background: linear-gradient(90deg, #e8e8e8 25%, #f0f0f0 50%, #e8e8e8 75%);
  background-size: 400% 100%;
  animation: shimmer 1.5s infinite;
}

.sk-card-body {
  display: flex;
  flex-wrap: wrap;
  padding: 20rpx 16rpx;
}

.sk-grid-item {
  width: 25%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16rpx 0;
}

.sk-icon-circle {
  width: 80rpx;
  height: 80rpx;
  border-radius: 20rpx;
  background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
  background-size: 400% 100%;
  animation: shimmer 1.5s infinite;
  margin-bottom: 10rpx;
}

.sk-text-line {
  width: 60%;
  height: 20rpx;
  border-radius: 10rpx;
  background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
  background-size: 400% 100%;
  animation: shimmer 1.5s infinite;
}

/* 菜单卡片 */
.menu-cards {
  padding: 20rpx 24rpx;
}

.menu-card {
  background: #fff;
  border-radius: 20rpx;
  margin-bottom: 20rpx;
  overflow: hidden;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.06);
  transition: transform 0.2s ease;

  &:active {
    transform: scale(0.98);
  }
}

.card-header {
  display: flex;
  align-items: center;
  padding: 24rpx 28rpx;
  /* bg: themeGradient inline */
}

.card-header-icon {
  width: 48rpx;
  height: 48rpx;
  background: rgba(255,255,255,0.25);
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16rpx;

  text {
    font-size: 28rpx;
  }
}

.card-header-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #fff;
}

.card-grid {
  display: flex;
  flex-wrap: wrap;
  padding: 20rpx 12rpx;
}

.grid-item {
  width: 25%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16rpx 8rpx;
  position: relative;
}

.grid-icon-wrap {
  width: 80rpx;
  height: 80rpx;
  background: linear-gradient(135deg, #f0f5ff, #e6f0ff);
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10rpx;
}

.grid-icon {
  font-size: 36rpx;
}

.grid-name {
  font-size: 24rpx;
  color: #606266;
  text-align: center;
  line-height: 1.3;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.has-sub-badge {
  position: absolute;
  top: 12rpx;
  right: 16rpx;

  text {
    font-size: 20rpx;
    color: #ccc;
  }
}

/* 空状态 */
.empty-ws {
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

/* Footer */
.ws-footer {
  text-align: center;
  padding: 40rpx 0 60rpx;

  text {
    font-size: 22rpx;
    color: #ccc;
  }
}

/* 子菜单弹窗 */
.submenu-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.45);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.submenu-panel {
  width: 85%;
  max-height: 70vh;
  background: #fff;
  border-radius: 24rpx;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.submenu-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx;
  border-bottom: 1rpx solid #f0f0f0;
  min-height: 88rpx;
}

.submenu-back {
  text {
    font-size: 28rpx;
    color: var(--theme, #4e6ef2);
  }
}

.submenu-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
  flex: 1;
  text-align: center;
}

.submenu-close {
  font-size: 32rpx;
  color: #999;
}

.submenu-list {
  flex: 1;
  max-height: 55vh;
}

.submenu-item {
  display: flex;
  align-items: center;
  padding: 28rpx 32rpx;
  border-bottom: 1rpx solid #f8f8f8;
}

.submenu-item-icon {
  width: 72rpx;
  height: 72rpx;
  background: linear-gradient(135deg, #f0f5ff, #e6f0ff);
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;

  text {
    font-size: 32rpx;
  }
}

.submenu-item-name {
  flex: 1;
  font-size: 30rpx;
  color: #333;
}

.submenu-item-arrow {
  font-size: 36rpx;
  color: #ccc;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
