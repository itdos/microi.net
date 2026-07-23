<template>
  <view class="mci-auth-prompt">
    <view class="mci-auth-prompt__card">
      <text v-if="icon" class="mci-auth-prompt__icon">{{ icon }}</text>
      <view v-else class="mci-auth-prompt__lock" aria-hidden="true">
        <view class="mci-auth-prompt__lock-shackle" />
        <view class="mci-auth-prompt__lock-body">
          <view class="mci-auth-prompt__lock-keyhole" />
        </view>
      </view>
      <text class="mci-auth-prompt__title">{{ title }}</text>
      <text class="mci-auth-prompt__desc">{{ desc }}</text>
      <view class="mci-auth-prompt__button" :style="{ background: gradient }" @tap="$emit('action')">
        <text class="mci-auth-prompt__button-text">{{ actionText }}</text>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'MciAuthPrompt',
  props: {
    icon: {
      type: String,
      default: ''
    },
    title: {
      type: String,
      required: true
    },
    desc: {
      type: String,
      default: ''
    },
    actionText: {
      type: String,
      required: true
    },
    gradient: {
      type: String,
      default: 'var(--mci-gradient-primary)'
    }
  },
  emits: ['action']
}
</script>

<style lang="scss" scoped>
.mci-auth-prompt {
  flex: 1;
  width: 100%;
  min-height: 0;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 48rpx;
}

.mci-auth-prompt__card {
  width: 100%;
  box-sizing: border-box;
  background: var(--mci-bg-elevated, #fff);
  border: 1rpx solid var(--mci-border-color, rgba(15, 18, 30, 0.08));
  border-radius: 24rpx;
  padding: 60rpx 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: var(--mci-shadow-md, 0 8rpx 32rpx rgba(0, 0, 0, 0.06));
}

.mci-auth-prompt__icon {
  font-size: 80rpx;
  line-height: 1;
  margin-bottom: 20rpx;
}

.mci-auth-prompt__lock {
  position: relative;
  width: 80rpx;
  height: 82rpx;
  margin-bottom: 20rpx;
}

.mci-auth-prompt__lock-shackle {
  position: absolute;
  top: 0;
  left: 17rpx;
  width: 46rpx;
  height: 42rpx;
  box-sizing: border-box;
  border: 7rpx solid var(--mci-brand-primary, #ff5a3c);
  border-bottom: 0;
  border-radius: 24rpx 24rpx 0 0;
}

.mci-auth-prompt__lock-body {
  position: absolute;
  left: 8rpx;
  bottom: 0;
  width: 64rpx;
  height: 52rpx;
  border-radius: 12rpx;
  background: var(--mci-brand-primary, #ff5a3c);
  display: flex;
  align-items: center;
  justify-content: center;
}

.mci-auth-prompt__lock-keyhole {
  width: 9rpx;
  height: 18rpx;
  border-radius: 6rpx;
  background: #fff;
}

.mci-auth-prompt__title {
  font-size: 34rpx;
  font-weight: 600;
  color: var(--mci-text-primary, #333);
  line-height: 1.2;
  margin-bottom: 12rpx;
}

.mci-auth-prompt__desc {
  font-size: 26rpx;
  color: var(--mci-text-secondary, #999);
  line-height: 1.35;
  margin-bottom: 40rpx;
  text-align: center;
}

.mci-auth-prompt__button {
  min-width: 240rpx;
  height: 108rpx;
  padding: 0 80rpx;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 44rpx;
  box-shadow: var(--mci-shadow-button, 0 8rpx 24rpx rgba(78, 110, 242, 0.3));
  transition: transform 0.15s ease;
  line-height: 1;
}

.mci-auth-prompt__button:active {
  transform: scale(0.97);
}

.mci-auth-prompt__button-text {
  color: var(--mci-text-on-primary, #fff);
  font-size: 30rpx;
  font-weight: 500;
  line-height: 1;
}
</style>
