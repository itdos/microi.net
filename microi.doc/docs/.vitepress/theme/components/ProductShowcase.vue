<template>
  <ClientOnly>
    <div v-if="isHomePage" class="product-showcase">
      <!-- 分割线 + 标题同行 -->
      <div class="section-divider">
        <div class="divider-line"></div>
        <div class="divider-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="url(#star-gradient)" />
            <defs>
              <linearGradient id="star-gradient" x1="2" y1="2" x2="22" y2="21">
                <stop offset="0%" stop-color="#8a2be2" />
                <stop offset="100%" stop-color="#00bfff" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <h2 class="section-title">产品矩阵</h2>
        <div class="divider-line"></div>
      </div>

      <!-- 副标题 -->
      <div class="section-header">
        <p class="section-subtitle">基于 Microi吾码 低代码平台构建的企业级解决方案</p>
      </div>

      <!-- 产品卡片网格 -->
      <div class="product-grid">
        <div
          v-for="(product, index) in products"
          :key="product.name"
          class="product-card"
          :class="`product-card--${product.id}`"
          :style="{ '--delay': `${index * 0.1}s` }"
          @mouseenter="activeCard = product.id"
          @mouseleave="activeCard = ''"
        >
          <div class="card-glow" :class="{ active: activeCard === product.id }"></div>
          <div class="card-content">
            <div class="card-icon">
              <span class="icon-emoji">{{ product.icon }}</span>
            </div>
            <h3 class="card-title">{{ product.name }}</h3>
            <p class="card-desc">{{ product.desc }}</p>
            <div class="card-tags">
              <span v-for="tag in product.tags" :key="tag" class="tag">{{ tag }}</span>
            </div>
            <div class="card-pricing">
              <div class="price-item">
                <span class="price-label">在线使用</span>
                <span class="price-value">{{ product.onlinePrice }}</span>
              </div>
              <div class="price-divider"></div>
              <div class="price-item">
                <span class="price-label">本地部署</span>
                <span class="price-value">{{ product.localPrice }}</span>
              </div>
            </div>
            <div class="card-footer">
              <button class="try-btn" @click.stop="handleTry(product)">
                <span class="try-btn-glow"></span>
                <span class="try-btn-text">在线试用</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Toast 通知 -->
      <Transition name="toast">
        <div v-if="toastVisible" class="toast-notification">
          <div class="toast-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 8v4M12 16h.01"/>
            </svg>
          </div>
          <span class="toast-text">暂未开放试用，请<a href="/contact/" class="toast-link">联系我们</a></span>
        </div>
      </Transition>
    </div>
  </ClientOnly>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { useRoute } from 'vitepress'

const route = useRoute()
const isHomePage = ref(false)
const activeCard = ref('')
const toastVisible = ref(false)
let toastTimer = null

const checkHomePage = () => {
  if (typeof window === 'undefined') return false
  const path = route.path || window.location.pathname
  return path === '/' || path === '/index.html' || path === '/index'
}

const handleTry = (product) => {
  if (product.url) {
    window.open(product.url, '_blank', 'noopener,noreferrer')
  } else {
    showToast()
  }
}

const showToast = () => {
  if (toastTimer) clearTimeout(toastTimer)
  toastVisible.value = true
  toastTimer = setTimeout(() => {
    toastVisible.value = false
  }, 3000)
}

watch(() => route.path, () => {
  isHomePage.value = checkHomePage()
}, { immediate: true })

onMounted(() => {
  isHomePage.value = checkHomePage()
})

const products = [
  {
    id: 'oa',
    name: 'OA 办公自动化',
    icon: '🏢',
    desc: '智能审批流、公文管理、会议管理、日程协作、通知公告，打造高效协同办公体验',
    tags: ['审批流程', '协同办公', '公文管理'],
    onlinePrice: '¥999/年',
    localPrice: '¥4999/永久',
    url: '',
  },
  {
    id: 'crm',
    name: 'CRM 客户管理',
    icon: '🤝',
    desc: '客户全生命周期管理、销售漏斗分析、商机跟进、合同管理，助力企业业绩增长',
    tags: ['客户管理', '销售分析', '商机跟进'],
    onlinePrice: '¥999/年',
    localPrice: '¥4999/永久',
    url: '',
  },
  {
    id: 'b2c',
    name: 'B2C 电商平台',
    icon: '🛒',
    desc: '商品管理、订单处理、支付集成、营销活动、会员体系，一站式电商解决方案',
    tags: ['商品管理', '在线支付', '会员体系'],
    onlinePrice: '¥999/年',
    localPrice: '¥4999/永久',
    url: '',
  },
  {
    id: 'erp',
    name: 'ERP 企业资源',
    icon: '📊',
    desc: '采购、库存、生产、财务、人力资源全流程管理，实现企业数字化转型升级',
    tags: ['进销存', '财务管理', '供应链'],
    onlinePrice: '¥999/年',
    localPrice: '¥4999/永久',
    url: '',
  },
  {
    id: 'mes',
    name: 'MES 制造执行',
    icon: '🏭',
    desc: '覆盖生产排程（APS）、物料需求计划（MRP）、工单管理、质量追溯（QMS）、设备健康管理（EAM）、工艺路线管控，打通计划层与执行层，赋能数字化车间与工业4.0',
    tags: ['APS排程', 'MRP计划', 'QMS质量', 'EAM设备'],
    onlinePrice: '?',
    localPrice: '?',
    url: '',
  },
  {
    id: 'booking',
    name: '在线预约',
    icon: '📅',
    desc: '面向服务型门店（美发、足浴、养生、医美等）的全流程数字化运营平台，涵盖在线预约、排班管理、会员积分、储值消费、服务评价及多门店统一调度，提升客户体验与坪效',
    tags: ['智能预约', '会员体系', '门店管理'],
    onlinePrice: '¥999/年',
    localPrice: '¥4999/永久',
    url: '',
  },
  {
    id: 'fintech',
    name: '数字经济',
    icon: '💹',
    desc: '聚焦新零售与数字普惠金融场景，支持限时秒杀、团购拼单、积分兑换、余额理财、稳健型理财产品认购及资产流转，构建覆盖消费、社交与金融闭环的数字生态平台',
    tags: ['新零售', '数字金融', '生态闭环'],
    onlinePrice: '?',
    localPrice: '¥50,000/永久',
    url: '',
  },
  {
    id: 'iot',
    name: 'IoT 物联网',
    icon: '🔌',
    desc: '基于MQTT/CoAP协议的工业级物联网平台，支持设备接入与生命周期管理、实时数据采集、边缘计算、远程配置与OTA升级、数字孪生及多维告警规则引擎，赋能智慧工厂、智慧园区与智慧城市',
    tags: ['设备管理', '边缘计算', '数字孪生', 'MQTT'],
    onlinePrice: '¥999/年',
    localPrice: '¥4999/永久',
    url: '',
  },
]
</script>

<style scoped>
.product-showcase {
  position: relative;
  padding: 60px 24px 80px;
  max-width: 1152px;
  margin: 0 auto;
}

/* 分割线 */
.section-divider {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 48px;
}

.divider-line {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(138, 43, 226, 0.4), transparent);
}

.divider-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(138, 43, 226, 0.1);
  border: 1px solid rgba(138, 43, 226, 0.3);
  animation: rotateStar 8s linear infinite;
}

@keyframes rotateStar {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 标题 - 和五角星同行 */
.section-title {
  font-size: 1.6rem;
  font-weight: 700;
  background: linear-gradient(135deg, #8a2be2 0%, #00bfff 50%, #8a2be2 100%);
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: shimmerTitle 4s linear infinite;
  letter-spacing: 2px;
  white-space: nowrap;
  margin: 0;
  line-height: 44px;
}

/* 副标题区域 */
.section-header {
  text-align: center;
  margin-bottom: 48px;
}

@keyframes shimmerTitle {
  0% { background-position: 0% center; }
  100% { background-position: 200% center; }
}

.section-subtitle {
  font-size: 1rem;
  color: rgba(200, 200, 220, 0.7) !important;
  letter-spacing: 1px;
}

/* 产品卡片网格 */
.product-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}

/* 产品卡片 */
.product-card {
  position: relative;
  border-radius: 16px;
  overflow: hidden;
  background: rgba(20, 20, 35, 0.8);
  border: 1px solid rgba(138, 43, 226, 0.15);
  transform: translateY(0);
  box-shadow: 0 0 0 rgba(0, 0, 0, 0);
  transition: transform 0.45s ease-out,
              border-color 0.45s ease-out,
              box-shadow 0.45s ease-out;
  cursor: default;
}

.product-card:hover {
  transform: translateY(-8px);
  border-color: rgba(138, 43, 226, 0.5);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}

/* 每张卡片不同颜色光效 */
.product-card--oa { --card-color: #8a2be2; --card-color-rgb: 138, 43, 226; }
.product-card--crm { --card-color: #00bfff; --card-color-rgb: 0, 191, 255; }
.product-card--b2c { --card-color: #ff6b6b; --card-color-rgb: 255, 107, 107; }
.product-card--erp { --card-color: #ffd93d; --card-color-rgb: 255, 217, 61; }
.product-card--mes { --card-color: #6bcb77; --card-color-rgb: 107, 203, 119; }
.product-card--booking { --card-color: #ff9f43; --card-color-rgb: 255, 159, 67; }
.product-card--fintech { --card-color: #ee5a24; --card-color-rgb: 238, 90, 36; }
.product-card--iot { --card-color: #0fbcf9; --card-color-rgb: 15, 188, 249; }

/* 卡片发光效果 */
.card-glow {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 0.5s ease;
  background: radial-gradient(
    circle at 50% 0%,
    rgba(var(--card-color-rgb), 0.2) 0%,
    transparent 70%
  );
  pointer-events: none;
}

.card-glow.active {
  opacity: 1;
}

.product-card:hover .card-glow {
  opacity: 1;
}

/* 卡片内容 */
.card-content {
  position: relative;
  z-index: 1;
  padding: 28px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  height: 100%;
}

/* 图标 */
.card-icon {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: rgba(var(--card-color-rgb), 0.1);
  border: 1px solid rgba(var(--card-color-rgb), 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  transform: scale(1) rotate(0deg);
  transition: transform 0.45s ease-out,
              box-shadow 0.45s ease-out;
}

.product-card:hover .card-icon {
  transform: scale(1.1) rotate(5deg);
  box-shadow: 0 8px 30px rgba(var(--card-color-rgb), 0.3);
}

.icon-emoji {
  font-size: 2rem;
  line-height: 1;
}

/* 标题 */
.card-title {
  font-size: 1.05rem;
  font-weight: 600;
  color: #fff !important;
  -webkit-text-fill-color: #fff !important;
  margin-bottom: 10px;
  letter-spacing: 0.5px;
}

/* 描述 */
.card-desc {
  font-size: 0.82rem;
  line-height: 1.6;
  color: rgba(200, 200, 220, 0.75) !important;
  -webkit-text-fill-color: rgba(200, 200, 220, 0.75) !important;
  margin-bottom: 16px;
  flex: 1;
}

/* 标签 */
.card-tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  margin-bottom: 16px;
  margin-top: auto;
}

.tag {
  font-size: 0.7rem;
  padding: 3px 10px;
  border-radius: 20px;
  background: rgba(var(--card-color-rgb), 0.1);
  border: 1px solid rgba(var(--card-color-rgb), 0.2);
  color: rgba(var(--card-color-rgb), 1) !important;
  -webkit-text-fill-color: var(--card-color) !important;
  white-space: nowrap;
}

/* 价格区域 */
.card-pricing {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: 100%;
  padding: 10px 0;
  margin-bottom: 14px;
  border-radius: 10px;
  background: rgba(var(--card-color-rgb), 0.05);
  border: 1px solid rgba(var(--card-color-rgb), 0.1);
}

.price-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}

.price-label {
  font-size: 0.65rem;
  color: rgba(200, 200, 220, 0.5) !important;
  -webkit-text-fill-color: rgba(200, 200, 220, 0.5) !important;
  letter-spacing: 0.5px;
}

.price-value {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--card-color) !important;
  -webkit-text-fill-color: var(--card-color) !important;
  letter-spacing: 0.5px;
}

.price-divider {
  width: 1px;
  height: 30px;
  background: rgba(var(--card-color-rgb), 0.2);
}

/* 底部按钮 */
.card-footer {
  width: 100%;
}

.try-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 24px;
  border-radius: 20px;
  border: 1px solid rgba(var(--card-color-rgb), 0.4);
  background: rgba(var(--card-color-rgb), 0.1);
  cursor: pointer;
  overflow: hidden;
  transform: translateY(0);
  box-shadow: 0 0 0 transparent;
  transition: transform 0.35s ease-out,
              box-shadow 0.35s ease-out,
              border-color 0.35s ease-out,
              background 0.35s ease-out;
}

.try-btn:hover {
  transform: translateY(-3px);
  border-color: rgba(var(--card-color-rgb), 0.7);
  background: rgba(var(--card-color-rgb), 0.2);
  box-shadow: 0 4px 20px rgba(var(--card-color-rgb), 0.4),
              0 0 30px rgba(var(--card-color-rgb), 0.15);
}

.try-btn:active {
  transform: translateY(0) scale(0.97);
  transition: transform 0.1s ease;
}

.try-btn-glow {
  position: absolute;
  inset: 0;
  border-radius: 20px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(var(--card-color-rgb), 0.3) 50%,
    transparent 100%
  );
  background-size: 200% 100%;
  animation: btnShimmer 3s ease-in-out infinite;
  pointer-events: none;
}

@keyframes btnShimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.try-btn-text {
  position: relative;
  z-index: 1;
  font-size: 0.78rem;
  font-weight: 500;
  letter-spacing: 1px;
  color: var(--card-color) !important;
  -webkit-text-fill-color: var(--card-color) !important;
}

/* Toast 通知 */
.toast-notification {
  position: fixed;
  bottom: 32px;
  right: 32px;
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 22px;
  border-radius: 12px;
  background: rgba(25, 25, 40, 0.95);
  border: 1px solid rgba(138, 43, 226, 0.35);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4),
              0 0 20px rgba(138, 43, 226, 0.15);
  backdrop-filter: blur(12px);
}

.toast-icon {
  color: #8a8aff;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.toast-text {
  font-size: 0.85rem;
  color: rgba(220, 220, 240, 0.9) !important;
  -webkit-text-fill-color: rgba(220, 220, 240, 0.9) !important;
  white-space: nowrap;
}

.toast-link {
  color: #8a8aff !important;
  -webkit-text-fill-color: #8a8aff !important;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
  transition: color 0.2s;
}

.toast-link:hover {
  color: #b0b0ff !important;
  -webkit-text-fill-color: #b0b0ff !important;
}

/* Toast 动画 */
.toast-enter-active {
  animation: toastIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.toast-leave-active {
  animation: toastOut 0.3s ease forwards;
}

@keyframes toastIn {
  0% { opacity: 0; transform: translateY(20px) scale(0.95); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes toastOut {
  0% { opacity: 1; transform: translateY(0) scale(1); }
  100% { opacity: 0; transform: translateY(10px) scale(0.95); }
}

/* 响应式 */
@media (max-width: 1200px) {
  .product-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (max-width: 900px) {
  .product-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .product-showcase {
    padding: 40px 16px 60px;
  }

  .section-title {
    font-size: 1.3rem;
  }

  .product-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 14px;
  }

  .card-content {
    padding: 20px 14px;
    min-height: 240px;
  }
}

@media (max-width: 480px) {
  .product-grid {
    grid-template-columns: 1fr;
  }
}
</style>
