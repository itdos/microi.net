<template>
  <view class="privacy-page">
    <view class="privacy-content">
      <view class="section">
        <text class="section-title">引言</text>
        <text class="section-text">
          欢迎使用{{ appName }}小程序（以下简称"本小程序"）。我们非常重视您的隐私保护和个人信息安全。本隐私政策说明了我们如何收集、使用、存储和保护您的个人信息。请您仔细阅读本政策，如您不同意本政策的内容，请停止使用本小程序。
        </text>
      </view>

      <view class="section">
        <text class="section-title">一、信息收集</text>
        <text class="section-text">
          1. 账号信息：当您使用账号密码登录时，我们会收集您输入的账号和密码信息，密码采用RSA加密传输，我们不会以明文形式存储您的密码。
        </text>
        <text class="section-text">
          2. 微信授权信息：当您选择微信授权登录时，我们会获取您的微信OpenID，用于识别您的身份。我们不会获取您的微信昵称、头像等其他信息，除非获得您的明确授权。
        </text>
        <text class="section-text">
          3. 设备信息：我们可能会收集您的设备型号、操作系统版本等基础设备信息，用于优化服务体验。
        </text>
      </view>

      <view class="section">
        <text class="section-title">二、信息使用</text>
        <text class="section-text">
          我们收集的信息将用于以下目的：
        </text>
        <text class="section-text">1. 提供用户身份验证和登录服务</text>
        <text class="section-text">2. 维护和改进我们的服务质量</text>
        <text class="section-text">3. 保障账号和系统安全</text>
        <text class="section-text">4. 遵守适用法律法规的要求</text>
      </view>

      <view class="section">
        <text class="section-title">三、信息存储与保护</text>
        <text class="section-text">
          1. 您的登录凭证（Token）将存储在小程序本地存储中，用于保持登录状态。
        </text>
        <text class="section-text">
          2. 我们采用行业标准的安全技术措施保护您的个人信息，防止未经授权的访问、使用或泄露。
        </text>
        <text class="section-text">
          3. 密码采用RSA非对称加密传输，确保传输安全。
        </text>
      </view>

      <view class="section">
        <text class="section-title">四、信息共享</text>
        <text class="section-text">
          我们不会将您的个人信息出售、交换或出租给任何第三方，除非：
        </text>
        <text class="section-text">1. 获得您的明确同意</text>
        <text class="section-text">2. 法律法规要求或政府部门依法要求</text>
        <text class="section-text">3. 维护公共利益所必要</text>
      </view>

      <view class="section">
        <text class="section-title">五、您的权利</text>
        <text class="section-text">1. 您有权访问和修改您的个人信息</text>
        <text class="section-text">2. 您有权删除您的个人信息（退出登录即清除本地数据）</text>
        <text class="section-text">3. 您有权拒绝提供某些非必要的个人信息</text>
      </view>

      <view class="section">
        <text class="section-title">六、未成年人保护</text>
        <text class="section-text">
          本小程序主要面向企业用户使用。如果您是未满18周岁的未成年人，请在监护人指导下使用本小程序。
        </text>
      </view>

      <view class="section">
        <text class="section-title">七、政策更新</text>
        <text class="section-text">
          我们可能会不时更新本隐私政策。更新后的政策将在小程序内公布，请您定期查阅。
        </text>
      </view>

      <view class="section">
        <text class="section-title">八、联系我们</text>
        <text class="section-text">
          如您对本隐私政策有任何疑问或建议，请通过小程序内的联系方式与我们取得联系。
        </text>
      </view>

      <view class="update-time">
        <text>最后更新日期：2026年2月23日</text>
      </view>
    </view>
  </view>
</template>

<script>
import appConfig from '@/utils/config.js'

export default {
  data() {
    return {
      appName: appConfig.appName
    }
  }
}
</script>

<style lang="scss" scoped>
.privacy-page {
  min-height: 100vh;
  background: #ffffff;
  padding: 30rpx;
}

.privacy-content {
  padding-bottom: 60rpx;
}

.section {
  margin-bottom: 40rpx;
}

.section-title {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: #333333;
  margin-bottom: 16rpx;
}

.section-text {
  display: block;
  font-size: 28rpx;
  color: #666666;
  line-height: 1.8;
  margin-bottom: 8rpx;
}

.update-time {
  margin-top: 60rpx;
  text-align: center;

  text {
    font-size: 24rpx;
    color: #999999;
  }
}
</style>
