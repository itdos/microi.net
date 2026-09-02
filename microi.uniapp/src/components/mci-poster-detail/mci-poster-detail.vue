<template>
  <view class="mci-poster-detail" data-mci-ui-root>
    <view class="mci-poster-detail__header">
      <view class="mci-poster-detail__brand-row">
        <view class="mci-poster-detail__eyebrow">
          <text>XDRINKTEK</text>
		  <text>COOPERATIVE CASE<!-- {{ presentation.eyebrow || 'COOPERATIVE CASE' }} --></text> 
        </view>
        <view class="mci-poster-detail__brand">
          <image v-if="resolvedBrandImage && !logoFailed" :src="resolvedBrandImage" mode="aspectFit"
            @error="logoFailed = true" />
          <!-- <text v-else>{{ merchantName }}</text>
          <text v-if="presentation.brandSubtitle && (!presentation.brandImage || logoFailed)">{{ presentation.brandSubtitle }}</text> -->
        </view>
      </view>

      <view class="mci-poster-detail__title-strip">
        <text>{{ posterTitle }}</text>
      </view>
      <text class="mci-poster-detail__intro">{{ introText }}</text>

      <view v-if="metaItems.length" class="mci-poster-detail__meta">
        <view v-for="item in metaItems" :key="item.field">
          <text>{{ item.label }}</text>
          <text>{{ item.value }}</text>
        </view>
      </view>
    </view>

    <view class="mci-poster-detail__paper">
      <view class="mci-poster-detail__gallery" :class="`mci-poster-detail__gallery--${Math.min(photoCount, 3)}`">
        <mci-native-field v-if="photoField && photoCount" :model-value="form[photoField.Name]"
          :field="photoField" readonly :table-name="tableName" :form-data="form"
          :form-data-id="formDataId" :menu-id="menuId" :file-access-menu-id="fileAccessMenuId"
          :module-engine-key="moduleEngineKey" :table-child-auth="tableChildAuth" />
        <view v-else class="mci-poster-detail__gallery-empty">
          <view class="mci-poster-detail__gallery-mark"><view></view></view>
          <text>{{ presentation.photoEmptyText || '暂未上传案例照片' }}</text>
        </view>
      </view>

      <view class="mci-poster-detail__facts">
        <view v-for="(row, index) in factRows" :key="row.field || index" class="mci-poster-detail__fact">
          <view class="mci-poster-detail__fact-label"><text>{{ row.label }}</text></view>
          <view class="mci-poster-detail__fact-value"><text>{{ row.value }}</text></view>
          <view v-if="row.badge" class="mci-poster-detail__badge" :class="`tone-${row.badge.tone || 'teal'}`">
            <image v-if="shouldShowBadgeImage(row, index)" class="mci-poster-detail__badge-image"
              :src="row.badge.image" mode="aspectFit" @error="handleBadgeImageError(row, index)" />
            <view v-else class="mci-poster-detail__badge-icon" :class="`is-${row.badge.icon || 'ring'}`">
              <view></view><view></view>
            </view>
            <text>{{ row.badge.text }}</text>
            <text v-if="row.badge.subtext">{{ row.badge.subtext }}</text>
          </view>
          <view v-else class="mci-poster-detail__badge mci-poster-detail__badge--empty"></view>
        </view>
      </view>

      <view class="mci-poster-detail__footer">
        <view>
			<text>新纪源·一站式商用饮水解决方案服务商</text>
			<text></text>
         <!-- <text>{{ merchantName }}</text>
          <text>{{ presentation.footerNote || '专业服务，长期陪伴' }}</text> -->
        </view>
        <text>{{ footerTag }}</text>
      </view>
    </view>
  </view>
</template>

<script>
import MciNativeField from '@/components/mci-native-field/mci-native-field.vue'
import { fieldDisplayValue } from '@/platform/native-form.js'
import { normalizeUploadItems } from '@/platform/display.js'

export default {
  name: 'MciPosterDetail',
  components: { MciNativeField },
  props: {
    presentation: { type: Object, required: true },
    form: { type: Object, default: () => ({}) },
    definition: { type: Object, default: null },
    brandLogo: { type: String, default: '' },
    tableName: { type: String, default: '' },
    formDataId: { type: String, default: '' },
    menuId: { type: String, default: '' },
    fileAccessMenuId: { type: String, default: '' },
    moduleEngineKey: { type: String, default: '' },
    tableChildAuth: { type: Object, default: null }
  },
  data() {
    return {
      logoFailed: false,
      badgeImageFailures: {}
    }
  },
  watch: {
    resolvedBrandImage() { this.logoFailed = false }
  },
  computed: {
    fieldMap() {
      return new Map((this.definition?.fields || []).map((field) => [String(field.Name || '').toLowerCase(), field]))
    },
    posterTitle() {
      return this.display(this.presentation.titleField) || this.presentation.fallbackTitle || '客户合作案例'
    },
    introText() {
      return this.display(this.presentation.introField) || this.presentation.fallbackIntro || '以稳定设备与持续服务，为客户提供可靠的饮水保障。'
    },
    merchantName() {
      return this.display(this.presentation.merchantField) || this.presentation.brandName || '专业服务团队'
    },
    resolvedBrandImage() {
      return this.presentation.brandImage || this.brandLogo || ''
    },
    footerTag() {
      return this.display(this.presentation.footerTagField) || this.presentation.footerTag || '客户案例'
    },
    metaItems() {
      return (this.presentation.metaFields || []).map((item) => ({
        ...item,
        label: item.label || this.field(item.field)?.Label || item.field,
        value: this.display(item.field) || '-'
      })).filter((item) => item.field)
    },
    factRows() {
      return (this.presentation.rows || []).map((row) => ({
        ...row,
        label: row.label || this.field(row.field)?.Label || row.field,
        value: this.display(row.field) || '-'
      })).filter((row) => row.field)
    },
    photoField() {
      return this.field(this.presentation.photoField)
    },
    photoCount() {
      if (!this.photoField) return 0
      try {
        return normalizeUploadItems(this.form[this.photoField.Name]).length
      } catch (error) {
        return 0
      }
    }
  },
  methods: {
    badgeImageKey(row, index) {
      return String(row?.field || index)
    },
    shouldShowBadgeImage(row, index) {
      const image = String(row?.badge?.image || '')
      return !!image && this.badgeImageFailures[this.badgeImageKey(row, index)] !== image
    },
    handleBadgeImageError(row, index) {
      const image = String(row?.badge?.image || '')
      if (!image) return
      // 正式素材失效时仅回退当前徽标，避免一个坏地址影响其它案例指标。
      this.badgeImageFailures[this.badgeImageKey(row, index)] = image
    },
    field(name) {
      return name ? this.fieldMap.get(String(name).toLowerCase()) || null : null
    },
    display(name) {
      if (!name) return ''
      const value = this.form[name]
      if (value === null || value === undefined || value === '') return ''
      const field = this.field(name)
      if (!field) return String(value)
      const text = fieldDisplayValue(field, value)
      return text === '-' ? '' : String(text || '')
    }
  }
}
</script>

<style scoped>
.mci-poster-detail {
  overflow: hidden;
  border: 1px solid rgba(165, 53, 36, .2);
  border-radius: var(--mci-shape-card, 18px);
  background: #f6f0e6;
  box-shadow: 0 18rpx 46rpx rgba(105, 42, 31, .15);
  animation: mciPosterEnter .36s ease-out both;
}

.mci-poster-detail__header {
  position: relative;
  overflow: hidden;
  padding: 27rpx 27rpx 25rpx;
  color: #fff;
  background:
    linear-gradient(118deg, rgba(225, 31, 41, 1.0), rgba(188, 45, 38, .96) 58%, rgba(222, 120, 24, .94)),
    #a6222a;
}

.mci-poster-detail__brand-row,
.mci-poster-detail__title-strip,
.mci-poster-detail__intro,
.mci-poster-detail__meta { position: relative; z-index: 1; }

.mci-poster-detail__brand-row {
  min-height: 74rpx;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 22rpx;
}

.mci-poster-detail__eyebrow { min-width: 0; padding-top: 5rpx; }
.mci-poster-detail__eyebrow text { display: block; max-width: 390rpx; font-size: 26rpx; letter-spacing: 3rpx; line-height: 1.35; }
/* .mci-poster-detail__eyebrow view { width: 72rpx; height: 4rpx; margin-top: 12rpx; background: rgba(255,255,255,.72); } */

.mci-poster-detail__brand {
  /* width: 154rpx; */
  position: relative;
  top: -10px;
  right: -10px;
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  /* color: rgba(255,255,255,.78); */
  font-size: 17rpx;
  text-align: right;
}

.mci-poster-detail__brand image { width: 200rpx; height: 70rpx; }
.mci-poster-detail__brand > text:first-child { color: #fff; font-size: 23rpx; font-weight: 750; }
.mci-poster-detail__brand > text:last-child { margin-top: 5rpx; }

.mci-poster-detail__title-strip {
  margin: 22rpx -6rpx 0;
  padding: 11rpx 13rpx 13rpx;
  background: linear-gradient(90deg, rgba(117, 12, 28, .18), rgba(232, 140, 36, .76));
}

.mci-poster-detail__title-strip text {
  display: block;
  color: #fff8ed;
  font-size: 42rpx;
  font-weight: 850;
  letter-spacing: 8rpx;
  line-height: 1.28;
}

.mci-poster-detail__intro {
  display: block;
  margin-top: 20rpx;
  color: rgba(255,255,255,.9);
  font-size: 24rpx;
  line-height: 1.72;
  white-space: pre-wrap;
}

.mci-poster-detail__meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 11rpx;
  margin-top: 21rpx;
}

.mci-poster-detail__meta view {
  min-width: 0;
  padding: 10rpx 12rpx;
  border: 1px solid rgba(255,255,255,.19);
  background: rgba(89, 13, 28, .2);
}

.mci-poster-detail__meta text { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mci-poster-detail__meta text:first-child { color: rgba(255,255,255,.65); font-size: 18rpx; }
.mci-poster-detail__meta text:last-child { margin-top: 4rpx; color: #fff; font-size: 22rpx; font-weight: 650; }

.mci-poster-detail__paper { padding: 20rpx; background: linear-gradient(180deg, #f9f7f2, #f2eee7); background:#fff; }
.mci-poster-detail__gallery { overflow: hidden; padding: 10rpx;  background: #fff; }
.mci-poster-detail__gallery-empty { height: 286rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #887f72; background: #eeeae2; font-size: 23rpx; }
.mci-poster-detail__gallery-mark { position: relative; width: 66rpx; height: 48rpx; margin-bottom: 16rpx; border: 4rpx solid #aa9f90; border-radius: 8rpx; box-sizing: border-box; }
.mci-poster-detail__gallery-mark::before { position: absolute; top: 7rpx; right: 8rpx; width: 10rpx; height: 10rpx; border-radius: 50%; background: #aa9f90; content: ''; }
.mci-poster-detail__gallery-mark view { position: absolute; right: 7rpx; bottom: 7rpx; left: 7rpx; height: 21rpx; border-left: 4rpx solid #aa9f90; border-bottom: 4rpx solid #aa9f90; transform: skewY(-32deg); }

.mci-poster-detail__gallery :deep(.native-control--readonly) { min-height: 0; padding: 0; border: 0; background: transparent; }
.mci-poster-detail__gallery :deep(.mci-media-uploader__grid) { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10rpx; }
.mci-poster-detail__gallery :deep(.mci-media-uploader__item) { height: 290rpx; aspect-ratio: auto; border-radius: 2rpx; }
.mci-poster-detail__gallery--1 :deep(.mci-media-uploader__grid) { grid-template-columns: minmax(0, 1fr); }
.mci-poster-detail__gallery--1 :deep(.mci-media-uploader__item) { height: 328rpx; }

.mci-poster-detail__facts { margin-top: 19rpx; }
.mci-poster-detail__fact {
  display: grid;
  grid-template-columns: 136rpx minmax(0, 1fr) 102rpx;
  gap: 11rpx;
  align-items: stretch;
  margin-top: 11rpx;
}

.mci-poster-detail__fact-label,
.mci-poster-detail__fact-value { min-height: 93rpx; box-sizing: border-box; }
.mci-poster-detail__fact-label { display: flex; align-items: center; justify-content: center; padding: 14rpx 10rpx; color: #fff; background: linear-gradient(115deg, #b42431, #df871f); font-size: 25rpx; font-weight: 750; letter-spacing: 2rpx; text-align: center; }
.mci-poster-detail__fact-value { display: flex; align-items: center; padding: 15rpx 18rpx; color: #282d30; background: #e5e5e5; font-size: 23rpx; line-height: 1.55; }
.mci-poster-detail__fact-value text { white-space: pre-wrap; overflow-wrap: anywhere; }

.mci-poster-detail__badge {
  min-height: 93rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #0e6f69;
  font-size: 19rpx;
  font-weight: 750;
  line-height: 1.18;
  text-align: center;
}

.mci-poster-detail__badge.tone-blue { color: #176c82; }
.mci-poster-detail__badge.tone-green { color: #367849; }
.mci-poster-detail__badge.tone-red { color: #a7352d; }
.mci-poster-detail__badge--empty { visibility: hidden; }
.mci-poster-detail__badge-image { display: block; width: 52rpx; height: 52rpx; margin-bottom: 3rpx; }
.mci-poster-detail__badge-icon { position: relative; width: 48rpx; height: 48rpx; margin-bottom: 5rpx; color: currentColor; }

.mci-poster-detail__badge-icon.is-energy { border: 4rpx solid currentColor; border-radius: 13rpx; box-sizing: border-box; }
.mci-poster-detail__badge-icon.is-energy view:first-child { position: absolute; top: 8rpx; left: 18rpx; width: 7rpx; height: 29rpx; background: currentColor; transform: skew(-20deg); }
.mci-poster-detail__badge-icon.is-energy view:last-child { position: absolute; top: 19rpx; left: 10rpx; width: 28rpx; height: 6rpx; background: currentColor; transform: rotate(-52deg); }
.mci-poster-detail__badge-icon.is-water { width: 38rpx; height: 38rpx; margin-top: 4rpx; border: 4rpx solid currentColor; border-radius: 52% 48% 55% 45%; box-sizing: border-box; transform: rotate(45deg); }
.mci-poster-detail__badge-icon.is-saving { border: 4rpx solid currentColor; border-radius: 50%; box-sizing: border-box; }
.mci-poster-detail__badge-icon.is-saving view:first-child { position: absolute; top: 9rpx; left: 15rpx; width: 17rpx; height: 25rpx; border: 4rpx solid currentColor; border-radius: 90% 0 90% 0; box-sizing: border-box; transform: rotate(-22deg); }
.mci-poster-detail__badge-icon.is-filter { border: 4rpx solid currentColor; border-radius: 50%; box-sizing: border-box; }
.mci-poster-detail__badge-icon.is-filter view:first-child { position: absolute; top: 11rpx; left: 14rpx; width: 14rpx; height: 24rpx; border: 3rpx solid currentColor; border-radius: 3rpx; box-sizing: border-box; }
.mci-poster-detail__badge-icon.is-filter view:last-child { position: absolute; top: 16rpx; left: 18rpx; width: 6rpx; height: 3rpx; background: currentColor; box-shadow: 0 7rpx 0 currentColor; }

.mci-poster-detail__footer {
  min-height: 94rpx;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18rpx;
  margin-top: 24rpx;
  padding: 19rpx 16rpx 6rpx;
  border-top: 1px solid #ded8ce;
}

.mci-poster-detail__footer > view { min-width: 0; }
.mci-poster-detail__footer > view text { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mci-poster-detail__footer > view text:first-child { color: #a62530; font-size: 24rpx; font-weight: 750; }
.mci-poster-detail__footer > view text:last-child { margin-top: 5rpx; color: #7b746b; font-size: 18rpx; }
.mci-poster-detail__footer > text { flex: none; min-width: 132rpx; padding: 12rpx 16rpx; color: #fff; background: #aa1524; font-size: 26rpx; font-weight: 800; text-align: center; }

@keyframes mciPosterEnter {
  from { opacity: 0; transform: translateY(16rpx); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .mci-poster-detail { animation: none; }
}
</style>
