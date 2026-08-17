<template>
  <view class="restricted-card">
    <view class="restricted-card__head">
      <view class="restricted-card__title-wrap">
        <view class="restricted-card__lock" aria-hidden="true">
          <view class="restricted-card__lock-ring"></view>
          <view class="restricted-card__lock-body"></view>
        </view>
        <text class="restricted-card__title">{{ row.CustomerName || '未命名客户' }}</text>
      </view>
      <text class="restricted-card__badge">{{ row.ScopeLabel || '私有客户' }}</text>
    </view>

    <view class="restricted-card__fields">
      <view v-for="item in fields" :key="item.label" class="restricted-card__field">
        <text class="restricted-card__label">{{ item.label }}</text>
        <text class="restricted-card__value">{{ item.value || '-' }}</text>
      </view>
    </view>

    <view class="restricted-card__notice">
      <text>{{ row.TipText || '该客户已有人员负责，仅展示查重信息' }}</text>
    </view>
  </view>
</template>

<script>
export default {
  name: 'MciRestrictedRecordCard',
  props: {
    row: { type: Object, default: () => ({}) }
  },
  computed: {
    fields() {
      return [
        { label: '所属商家', value: this.row.MerchantName },
        { label: '负责人', value: this.row.OwnerName },
        { label: '协作人', value: this.row.CollaboratorNames },
        { label: '详细地址', value: this.row.DetailedAddress }
      ]
    }
  }
}
</script>

<style scoped lang="scss">
.restricted-card {
  margin-bottom: 20rpx;
  padding: 26rpx 24rpx 22rpx;
  border: 1rpx solid rgba(245, 158, 11, 0.28);
  border-radius: 20rpx;
  background: #fffdf8;
  box-shadow: 0 8rpx 24rpx rgba(146, 92, 15, 0.08);
}

.restricted-card__head,
.restricted-card__title-wrap,
.restricted-card__field {
  display: flex;
  align-items: center;
}

.restricted-card__head {
  justify-content: space-between;
  gap: 16rpx;
  padding-bottom: 18rpx;
  border-bottom: 1rpx solid #f4ead6;
}

.restricted-card__title-wrap { min-width: 0; gap: 14rpx; }
.restricted-card__title { overflow: hidden; color: #263238; font-size: 30rpx; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.restricted-card__badge { flex: none; padding: 8rpx 14rpx; border-radius: 10rpx; background: #fff1d6; color: #a35c00; font-size: 22rpx; }

.restricted-card__lock { position: relative; width: 28rpx; height: 32rpx; flex: none; }
.restricted-card__lock-ring { position: absolute; top: 0; left: 6rpx; width: 16rpx; height: 16rpx; border: 4rpx solid #d98600; border-bottom: 0; border-radius: 14rpx 14rpx 0 0; box-sizing: border-box; }
.restricted-card__lock-body { position: absolute; bottom: 0; left: 2rpx; width: 24rpx; height: 20rpx; border-radius: 5rpx; background: #d98600; }

.restricted-card__fields { padding-top: 14rpx; }
.restricted-card__field { align-items: flex-start; padding: 7rpx 0; line-height: 1.55; }
.restricted-card__label { width: 136rpx; flex: none; color: #87929a; font-size: 25rpx; }
.restricted-card__value { flex: 1; min-width: 0; color: #48545c; font-size: 25rpx; word-break: break-all; }
.restricted-card__notice { margin-top: 14rpx; padding: 14rpx 18rpx; border-radius: 12rpx; background: #fff6e6; color: #956000; font-size: 23rpx; line-height: 1.5; }
</style>
