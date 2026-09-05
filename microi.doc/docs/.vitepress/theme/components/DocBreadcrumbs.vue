<script setup>
import { computed } from 'vue'
import { useData, useRoute } from 'vitepress'
import { breadcrumbsFor } from '../../config/seo-policy.mjs'
const { page } = useData()
const route = useRoute()
const items = computed(() => breadcrumbsFor(route.path, page.value.title))
</script>

<template>
  <nav v-if="items.length" class="mci-doc-breadcrumbs" :aria-label="route.path.startsWith('/en/') ? 'Breadcrumb' : '面包屑导航'">
    <ol>
      <li v-for="(item, index) in items" :key="item.path">
        <span v-if="index" aria-hidden="true" class="mci-doc-breadcrumb-divider">/</span>
        <span v-if="index === items.length - 1" aria-current="page">{{ item.name }}</span>
        <a v-else :href="item.path">{{ item.name }}</a>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.mci-doc-breadcrumbs { margin-bottom: 24px; color: var(--mci-site-muted); font-size: 13px; line-height: 1.7; }
.mci-doc-breadcrumbs ol { display: flex; flex-wrap: wrap; gap: 6px 10px; padding: 0; margin: 0; list-style: none; }
.mci-doc-breadcrumbs li { display: inline-flex; gap: 10px; overflow-wrap: anywhere; }
.mci-doc-breadcrumbs a { color: var(--mci-site-ink); text-decoration: underline; text-underline-offset: 3px; }
.mci-doc-breadcrumbs a:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 4px; border-radius: 2px; }
.mci-doc-breadcrumb-divider { opacity: .6; }
</style>
