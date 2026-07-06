<template>
  <ClientOnly>
    <div v-if="isHomePage" class="glow-background-wrapper">
      <div class="glow-layer glow-1"></div>
      <div class="glow-layer glow-2"></div>
      <div class="glow-layer glow-3"></div>
    </div>
  </ClientOnly>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vitepress'

const isHomePage = ref(false)
const route = useRoute()

// 检查是否是首页
const checkHomePage = () => {
  if (typeof window === 'undefined') return false
  const path = route.path || window.location.pathname
  return path === '/' || path === '/index.html' || path === '/index'
}

// 应用首页样式
const applyHomePageStyles = () => {
  if (typeof document === 'undefined') return
  
  // 只隐藏主题切换按钮，不修改全局dark类
  const hideThemeToggle = () => {
    if (typeof document === 'undefined') return
    const themeToggles = document.querySelectorAll('.VPNavBarAppearance, .VPSwitchAppearance')
    themeToggles.forEach(toggle => {
      if (toggle instanceof HTMLElement) {
        toggle.style.display = 'none'
      }
    })
  }
  
  setTimeout(hideThemeToggle, 50)
  setTimeout(hideThemeToggle, 200)
}

// 恢复正常页面样式
const restoreNormalStyles = () => {
  if (typeof document === 'undefined') return
  
  // 移除首页设置的 data-theme 属性
  document.documentElement.removeAttribute('data-theme')
  
  // 恢复主题切换按钮显示
  const themeToggles = document.querySelectorAll('.VPNavBarAppearance, .VPSwitchAppearance')
  themeToggles.forEach(toggle => {
    if (toggle instanceof HTMLElement) {
      toggle.style.display = ''
    }
  })
}

// 监听路由变化
watch(() => route.path, (newPath) => {
  const isHome = checkHomePage()
  isHomePage.value = isHome
  
  if (isHome) {
    applyHomePageStyles()
  } else {
    restoreNormalStyles()
  }
}, { immediate: true })

onMounted(() => {
  isHomePage.value = checkHomePage()
  
  if (isHomePage.value) {
    applyHomePageStyles()
  }
})

onUnmounted(() => {
  restoreNormalStyles()
})
</script>

<style scoped>
.glow-background-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 50vh; /* 只覆盖上半部分 */
  z-index: 0;
  pointer-events: none;
  overflow: visible; /* 允许光晕溢出 */
  contain: layout style;
}

.glow-layer {
  position: absolute;
  border-radius: 50%;
  filter: blur(56px);
  mix-blend-mode: screen;
  will-change: transform;
  backface-visibility: hidden;
  transform: translateZ(0);
}

/* 只保留上半部分的3个光晕 - 缩小尺寸 */
.glow-1 {
  width: 430px;
  height: 430px;
  background: radial-gradient(circle, rgba(138, 43, 226, 1), rgba(138, 43, 226, 0.7) 35%, transparent 60%);
  top: -20%;
  left: -5%;
  opacity: 0.78;
  animation: moveGlow1 12s infinite ease-in-out;
}

.glow-2 {
  width: 470px;
  height: 470px;
  background: radial-gradient(circle, rgba(0, 191, 255, 1), rgba(0, 191, 255, 0.7) 35%, transparent 60%);
  top: -25%;
  right: -5%;
  opacity: 0.82;
  animation: moveGlow2 14s infinite ease-in-out;
}

.glow-3 {
  width: 380px;
  height: 380px;
  background: radial-gradient(circle, rgba(255, 0, 128, 0.95), rgba(255, 0, 128, 0.65) 35%, transparent 60%);
  top: 5%;
  left: 50%;
  opacity: 0.72;
  transform: translateX(-50%);
  animation: moveGlow3 15s infinite ease-in-out;
}

/* 光晕动画 - 缩小缩放范围提升性能 */
@keyframes moveGlow1 {
  0% { 
    transform: translate3d(-18px, -18px, 0) scale(0.95);
    opacity: 0.7;
  }
  25% {
    transform: translate3d(24px, 14px, 0) scale(1.02);
    opacity: 0.84;
  }
  50% {
    transform: translate3d(42px, 58px, 0) scale(1.08);
    opacity: 0.75;
  }
  75% {
    transform: translate3d(18px, 72px, 0) scale(1.05);
    opacity: 0.78;
  }
  100% { 
    transform: translate3d(-18px, -18px, 0) scale(0.95);
    opacity: 0.7;
  }
}

@keyframes moveGlow2 {
  0% { 
    transform: translate3d(18px, -12px, 0) scale(0.95);
    opacity: 0.75;
  }
  25% {
    transform: translate3d(-18px, 18px, 0) scale(1.04);
    opacity: 0.82;
  }
  50% {
    transform: translate3d(-44px, 54px, 0) scale(1.1);
    opacity: 0.8;
  }
  75% {
    transform: translate3d(-24px, 76px, 0) scale(1.05);
    opacity: 0.86;
  }
  100% { 
    transform: translate3d(18px, -12px, 0) scale(0.95);
    opacity: 0.75;
  }
}

@keyframes moveGlow3 {
  0% { 
    transform: translateX(-50%) translate3d(0, -12px, 0) scale(0.97);
    opacity: 0.7;
  }
  25% {
    transform: translateX(-50%) translate3d(0, 14px, 0) scale(1.02);
    opacity: 0.78;
  }
  50% {
    transform: translateX(-50%) translate3d(0, 36px, 0) scale(1.08);
    opacity: 0.72;
  }
  75% {
    transform: translateX(-50%) translate3d(0, 48px, 0) scale(1.04);
    opacity: 0.76;
  }
  100% { 
    transform: translateX(-50%) translate3d(0, -12px, 0) scale(0.97);
    opacity: 0.7;
  }
}

/* 响应式调整 */
@media (max-width: 960px) {
  .glow-background-wrapper {
    height: 45vh;
  }
  
  .glow-layer {
    filter: blur(48px);
  }
  
  .glow-1, .glow-2, .glow-3 {
    width: 500px;
    height: 500px;
  }
}

@media (max-width: 768px) {
  .glow-background-wrapper {
    height: 40vh;
  }
  
  .glow-layer {
    filter: blur(38px);
  }
  
  .glow-1, .glow-2, .glow-3 {
    width: 350px;
    height: 350px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .glow-layer {
    animation: none;
  }
}
</style>
