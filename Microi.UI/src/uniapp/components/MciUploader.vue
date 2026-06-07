<template>
  <view class="mci-uni-uploader" :class="{ 'is-disabled': disabled }">
    <view class="mci-uni-uploader__trigger" @tap="open">
      <view class="mci-uni-uploader__plus" />
      <text class="mci-uni-uploader__title">{{ title }}</text>
      <text class="mci-uni-uploader__desc">{{ description }}</text>
    </view>
    <view v-if="files.length" class="mci-uni-uploader__list">
      <text v-for="(file, index) in files" :key="file.path || file.name || index">
        {{ file.name || file.path || `文件${index + 1}` }}
      </text>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';

defineOptions({ name: 'MciUploader' });

const props = defineProps({
  title: { type: String, default: '上传文件' },
  description: { type: String, default: '点击选择图片或文件' },
  count: { type: Number, default: 9 },
  disabled: { type: Boolean, default: false }
});

const emit = defineEmits(['change']);
const files = ref([]);

function open() {
  if (props.disabled) return;
  if (typeof uni !== 'undefined' && uni.chooseImage) {
    uni.chooseImage({
      count: props.count,
      success(res) {
        files.value = (res.tempFiles || []).map((item, index) => ({
          ...item,
          name: item.name || `图片${index + 1}`
        }));
        emit('change', files.value);
      }
    });
  }
}
</script>

<style scoped>
.mci-uni-uploader {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.mci-uni-uploader__trigger {
  min-height: 280rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  border: 2rpx dashed var(--mci-border-strong);
  border-radius: var(--mci-shape-card);
  background: var(--mci-bg-surface);
  box-sizing: border-box;
}

.mci-uni-uploader__trigger:active {
  transform: scale(.99);
}

.mci-uni-uploader__plus {
  width: 92rpx;
  height: 92rpx;
  border-radius: 999rpx;
  background: var(--mci-gradient-primary);
  box-shadow: var(--mci-shadow-button);
  position: relative;
}

.mci-uni-uploader__plus::before,
.mci-uni-uploader__plus::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  width: 34rpx;
  height: 6rpx;
  border-radius: 999rpx;
  background: var(--mci-text-on-primary);
  transform: translate(-50%, -50%);
}

.mci-uni-uploader__plus::after {
  transform: translate(-50%, -50%) rotate(90deg);
}

.mci-uni-uploader__title {
  color: var(--mci-text-primary);
  font-size: 30rpx;
  font-weight: 900;
}

.mci-uni-uploader__desc {
  color: var(--mci-text-tertiary);
  font-size: 24rpx;
}

.mci-uni-uploader__list {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.mci-uni-uploader__list text {
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  background: var(--mci-bg-soft);
  color: var(--mci-color-primary);
  font-size: 22rpx;
  font-weight: 800;
}

.mci-uni-uploader.is-disabled {
  opacity: .58;
}
</style>
