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
}

.glow-layer {
  position: absolute;
  border-radius: 50%;
  filter: blur(120px); /* 更大的模糊扩散 */
  mix-blend-mode: screen;
  will-change: transform, opacity;
}

/* 只保留上半部分的3个光晕 - 缩小尺寸 */
.glow-1 {
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, rgba(138, 43, 226, 1), rgba(138, 43, 226, 0.7) 35%, transparent 60%);
  top: -20%;
  left: -5%;
  opacity: 0.95;
  animation: moveGlow1 4s infinite ease-in-out; /* 大幅加快 */
}

.glow-2 {
  width: 550px;
  height: 550px;
  background: radial-gradient(circle, rgba(0, 191, 255, 1), rgba(0, 191, 255, 0.7) 35%, transparent 60%);
  top: -25%;
  right: -5%;
  opacity: 1;
  animation: moveGlow2 5s infinite ease-in-out; /* 大幅加快 */
}

.glow-3 {
  width: 450px;
  height: 450px;
  background: radial-gradient(circle, rgba(255, 0, 128, 0.95), rgba(255, 0, 128, 0.65) 35%, transparent 60%);
  top: 5%;
  left: 50%;
  opacity: 0.9;
  transform: translateX(-50%);
  animation: moveGlow3 4.5s infinite ease-in-out; /* 大幅加快 */
}

/* 光晕动画 - 左右上下移动 + 缩放变化 */
@keyframes moveGlow1 {
  0% { 
    transform: translate(-30px, -30px) scale(0.8);
    opacity: 0.7;
  }
  25% {
    transform: translate(40px, 20px) scale(1.1);
    opacity: 0.95;
  }
  50% {
    transform: translate(80px, 100px) scale(1.4);
    opacity: 0.75;
  }
  75% {
    transform: translate(30px, 140px) scale(1.2);
    opacity: 0.85;
  }
  100% { 
    transform: translate(-30px, -30px) scale(0.8);
    opacity: 0.7;
  }
}

@keyframes moveGlow2 {
  0% { 
    transform: translate(30px, -20px) scale(0.85);
    opacity: 0.75;
  }
  25% {
    transform: translate(-30px, 30px) scale(1.15);
    opacity: 0.9;
  }
  50% {
    transform: translate(-80px, 90px) scale(1.45);
    opacity: 0.8;
  }
  75% {
    transform: translate(-40px, 130px) scale(1.25);
    opacity: 0.95;
  }
  100% { 
    transform: translate(30px, -20px) scale(0.85);
    opacity: 0.75;
  }
}

@keyframes moveGlow3 {
  0% { 
    transform: translateX(-50%) translateY(-20px) scale(0.9);
    opacity: 0.7;
  }
  25% {
    transform: translateX(-50%) translateY(20px) scale(1.1);
    opacity: 0.85;
  }
  50% {
    transform: translateX(-50%) translateY(60px) scale(1.35);
    opacity: 0.7;
  }
  75% {
    transform: translateX(-50%) translateY(90px) scale(1.2);
    opacity: 0.8;
  }
  100% { 
    transform: translateX(-50%) translateY(-20px) scale(0.9);
    opacity: 0.7;
  }
}

/* 响应式调整 */
@media (max-width: 960px) {
  .glow-background-wrapper {
    height: 45vh;
  }
  
  .glow-layer {
    filter: blur(100px);
  }
  
  .glow-1, .glow-2, .glow-3 {
    width: 600px;
    height: 600px;
  }
}

@media (max-width: 768px) {
  .glow-background-wrapper {
    height: 40vh;
  }
  
  .glow-layer {
    filter: blur(80px);
  }
  
  .glow-1, .glow-2, .glow-3 {
    width: 450px;
    height: 450px;
  }
}
</style>
