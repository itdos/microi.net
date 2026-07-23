<template>
  <view class="catalog-page" :style="mciTokenStyle">
    <view class="catalog-header mci-safe-top">
      <view class="nav-row mci-safe-nav-row">
        <view class="nav-back" @tap="goBack"><text>‹</text></view>
        <text class="nav-title">全部功能</text>
        <view class="nav-space"></view>
      </view>
      <view class="catalog-search">
        <input v-model="keyword" placeholder="搜索客户、订单、设备、售后等功能" />
      </view>
    </view>

    <scroll-view class="catalog-scroll" scroll-y>
      <view class="catalog-content">
        <view v-for="group in filteredGroups" :key="group.key" class="catalog-group">
          <view class="group-heading">
            <view class="group-mark" :style="{ backgroundColor: group.accent }"></view>
            <view>
              <text class="group-title">{{ group.title }}</text>
              <text class="group-subtitle">{{ group.subtitle }}</text>
            </view>
          </view>
          <view class="entry-list">
            <view
              v-for="item in group.items"
              :key="item.key"
              class="entry-row"
              hover-class="entry-row--pressed"
              @tap="open(item.key)"
            >
              <view class="entry-icon" :style="{ backgroundColor: `${group.accent}12` }">
                <image :src="item.icon" mode="aspectFit" />
              </view>
              <view class="entry-copy">
                <text class="entry-title">{{ item.title }}</text>
                <text class="entry-desc">{{ getDescription(item.key) }}</text>
              </view>
              <text class="entry-arrow">›</text>
            </view>
          </view>
        </view>

        <view v-if="filteredGroups.length === 0" class="empty-state">
          <text class="empty-title">没有匹配的功能</text>
          <text class="empty-text">试试客户、设备、订单、售后或打卡</text>
        </view>
      </view>
    </scroll-view>
    <mci-ai-launcher />
  </view>
</template>

<script>
import { themeMixin } from '@/utils/theme.js'
import { businessGroups } from '@/platform/business.js'
import { openBusiness } from '@/platform/business-runtime.js'

const descriptions = {
  customers: '客户档案、负责人及跟进状态', contacts: '客户联系人与电话快速拨打', visits: '拜访过程与下次跟进安排',
  performance: '销售与服务经营统计', cases: '客户项目案例与现场成果', casebooks: '整理并组合客户案例', cooperativeCustomers: '已合作客户集中管理',
  orders: '合同订单、金额与审批状态', tasks: '接单、预约、服务与验收', devices: '设备状态、位置与二维码',
  filters: '滤芯更换和耗材统计', areas: '服务片区与人员安排', afterSalesAdd: '发起报修或售后需求',
  serviceRecords: '历史服务和客户评价', stores: '平台商家档案', suppliers: '商品与耗材供应商',
  directory: '内部组织通讯录', attendance: '定位、现场照片与拜访打卡', recruitment: '应聘信息与人才档案',
  leads: '市场线索收集与转化', opportunities: '商机阶段与预计金额', partners: '项目外部协作人员', demands: '项目需求发布与响应',
  proposals: '饮水方案、设备选型与成本试算', customerCare: '礼品关怀与客户维护记录', customerMap: '按距离查看附近客户',
  contactMap: '按客户位置查看联系人', visitMap: '按客户位置进入跟进记录',
  serviceForms: '按客户和时间生成服务档案', taskScan: '扫描设备码接单并完成任务', deviceMap: '设备点位、范围与现场导航',
  orderGoods: '订单商品与合作方式', installationPositions: '安装点位、人数和联系人', consumableArchives: '滤芯级数、周期与价格',
  attendanceRecords: '位置、照片与现场打卡历史', members: '组织成员、角色与联系方式', applicantFamily: '应聘人家庭成员档案',
  applicantEducation: '应聘人教育背景', applicantWork: '应聘人工作履历', applicantCertificates: '应聘人专业证书',
  demandResponses: '需求筛选结果与响应记录', leadVisits: '线索跟进过程与下次安排'
}

export default {
  mixins: [themeMixin],
  data() {
    return { statusBarHeight: 0, keyword: '', businessGroups }
  },
  computed: {
    filteredGroups() {
      const keyword = this.keyword.trim().toLowerCase()
      if (!keyword) return this.businessGroups
      return this.businessGroups.map((group) => ({
        ...group,
        items: group.items.filter((item) => `${item.title}${descriptions[item.key] || ''}`.toLowerCase().includes(keyword))
      })).filter((group) => group.items.length)
    }
  },
  onLoad() {
    try {
      const info = uni.getWindowInfo()
      this.statusBarHeight = info.statusBarHeight || 0
    } catch (e) {
      try { this.statusBarHeight = uni.getSystemInfoSync().statusBarHeight || 0 } catch (error) {}
    }
  },
  methods: {
    getDescription(key) { return descriptions[key] || '打开业务功能' },
    open(key) { openBusiness(key) },
    goBack() { uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/workspace/index' }) }) }
  }
}
</script>

<style lang="scss" scoped>
.catalog-page { height: 100vh; overflow: hidden; background: #f4f8fa; color: #18313d; }
.catalog-header { background: linear-gradient(180deg, #fff, #f9fcfd); border-bottom: 1rpx solid #e1ebef; }
.nav-row { display: grid; grid-template-columns: 72rpx 1fr 72rpx; align-items: center; min-height: 88rpx; padding: 0 calc(20rpx + var(--mci-capsule-right)) 0 20rpx; }
.nav-back { display: flex; align-items: center; justify-content: center; width: 64rpx; height: 64rpx; border-radius: 50%; font-size: 44rpx; }
.nav-title { text-align: center; font-size: 32rpx; font-weight: 650; }
.catalog-search { padding: 4rpx 24rpx 20rpx; }
.catalog-search input { box-sizing: border-box; width: 100%; height: 72rpx; padding: 0 24rpx; border: 1rpx solid #dce8ed; border-radius: 14rpx; background: #f2f7f9; font-size: 25rpx; }
.catalog-scroll { height: calc(100vh - 180rpx - var(--mci-safe-top)); }
.catalog-content { padding: 22rpx 24rpx calc(40rpx + var(--mci-safe-bottom)); }
.catalog-group { margin-bottom: 22rpx; border: 1rpx solid #e2ecef; border-radius: 16rpx; overflow: hidden; background: #fff; box-shadow: 0 6rpx 18rpx rgba(24, 76, 98, 0.05); }
.group-heading { display: flex; align-items: center; padding: 22rpx 24rpx 18rpx; border-bottom: 1rpx solid #edf3f5; }
.group-mark { width: 8rpx; height: 48rpx; margin-right: 16rpx; border-radius: 4rpx; }
.group-heading > view:last-child { display: flex; flex-direction: column; min-width: 0; }
.group-title { font-size: 29rpx; font-weight: 650; }
.group-subtitle { margin-top: 3rpx; color: #869ba4; font-size: 21rpx; }
.entry-row { display: grid; grid-template-columns: 70rpx minmax(0, 1fr) 42rpx; align-items: center; min-height: 104rpx; padding: 10rpx 20rpx; border-bottom: 1rpx solid #edf3f5; transition: background 150ms ease; }
.entry-row:last-child { border-bottom: none; }
.entry-row--pressed { background: #f1f7f9; }
.entry-icon { display: flex; align-items: center; justify-content: center; width: 58rpx; height: 58rpx; border-radius: 12rpx; }
.entry-icon image { width: 42rpx; height: 42rpx; }
.entry-copy { display: flex; flex-direction: column; min-width: 0; }
.entry-title { color: #284854; font-size: 26rpx; font-weight: 600; }
.entry-desc { margin-top: 4rpx; overflow: hidden; color: #8ba0a9; font-size: 21rpx; text-overflow: ellipsis; white-space: nowrap; }
.entry-arrow { color: #a2b1b7; text-align: right; font-size: 36rpx; }
.empty-state { display: flex; flex-direction: column; align-items: center; padding: 140rpx 30rpx; }
.empty-title { color: #506d79; font-size: 28rpx; font-weight: 600; }
.empty-text { margin-top: 10rpx; color: #94a6ad; font-size: 22rpx; }
</style>
