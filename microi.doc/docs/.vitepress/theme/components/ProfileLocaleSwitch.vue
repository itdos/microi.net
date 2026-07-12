<template>
  <ClientOnly>
    <label v-if="isProfilePage" class="profile-locale-switch" :aria-label="locale === 'en-US' ? 'Language' : '语言'">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.4 2.5 3.6 5.5 3.6 9S14.4 18.5 12 21c-2.4-2.5-3.6-5.5-3.6-9S9.6 5.5 12 3Z" />
      </svg>
      <select v-model="locale">
        <option value="zh-CN">简体中文</option>
        <option value="en-US">English</option>
      </select>
    </label>
  </ClientOnly>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vitepress'
import { getInitialProfileLocale, normalizeProfileLocale, type ProfileLocale } from '../profile-i18n'

const route = useRoute()
const locale = ref<ProfileLocale>(getInitialProfileLocale())
const isProfilePage = computed(() => /^\/profile(?:\.html)?\/?$/.test(route.path))

function syncProfilePageClass() {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('microi-profile-page', isProfilePage.value)
}

function onExternalLocaleChange(event: Event) {
  locale.value = normalizeProfileLocale((event as CustomEvent).detail)
}

watch(isProfilePage, syncProfilePageClass, { immediate: true })
watch(locale, (value) => {
  if (typeof window === 'undefined' || !isProfilePage.value) return
  window.localStorage.setItem('microi_profile_locale', value)
  document.documentElement.lang = value
  window.dispatchEvent(new CustomEvent('microi-profile-locale-change', { detail: value }))
})

onMounted(() => {
  syncProfilePageClass()
  window.addEventListener('microi-profile-locale-change', onExternalLocaleChange)
})

onUnmounted(() => {
  document.documentElement.classList.remove('microi-profile-page')
  window.removeEventListener('microi-profile-locale-change', onExternalLocaleChange)
})
</script>

<style scoped>
.profile-locale-switch {
  height: 34px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: 8px;
  padding: 0 9px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 9px;
  background: color-mix(in srgb, var(--vp-c-bg) 90%, transparent);
  color: var(--vp-c-text-1);
}

.profile-locale-switch svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
}

.profile-locale-switch select {
  min-width: 82px;
  border: 0;
  outline: 0;
  background: transparent;
  color: inherit;
  font-size: 13px;
  cursor: pointer;
}

.profile-locale-switch option {
  color: #1f2937;
}

@media (max-width: 768px) {
  .profile-locale-switch {
    padding: 0 6px;
  }

  .profile-locale-switch select {
    width: 28px;
    min-width: 28px;
  }
}
</style>

<style>
html.microi-profile-page .VPNavBarTranslations {
  display: none !important;
}
</style>
