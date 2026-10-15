<script setup lang="ts">
import { enterpriseSlides } from '../enterprise-training-slides.js'
import '../styles/enterprise-case-slides.scss'
defineProps<{ slide:(typeof enterpriseSlides)[number]; index:number }>()
defineEmits<{ jump:[index:number]; preview:[image:{src:string;alt:string}] }>()
</script>

<template>
  <div class="mci-enterprise-cases" :class="`is-${slide.layout}`">
    <header class="mci-enterprise-case-heading mci-deck-reveal"><div><p class="mci-deck-eyebrow">{{ slide.eyebrow }}</p><h2>{{ slide.title }}</h2><p>{{ slide.summary }}</p></div><span>{{ String(index+1).padStart(2,'0') }}</span></header>
    <template v-if="slide.layout === 'overview'">
      <div class="mci-industry-portals">
        <button v-for="(card,i) in slide.cards" :key="card.title" type="button" :class="`is-${card.accent}`" :style="{'--portal-order':i}" @click="$emit('jump',card.target)"><span>{{ card.label }}</span><i>{{ card.glyph }}</i><h3>{{ card.title }}</h3><p>{{ card.text }}</p><b>探索案例 <span>↗</span></b></button>
      </div><p class="mci-enterprise-case-takeaway">{{ slide.takeaway }}</p>
    </template>
    <template v-else-if="slide.layout === 'case'">
      <div class="mci-enterprise-case-layout">
        <section class="mci-enterprise-case-story"><div class="mci-enterprise-case-metric"><strong>{{ slide.metric }}</strong><span>{{ slide.metricLabel }}</span></div><div class="mci-enterprise-case-points"><article v-for="(card,i) in slide.cards" :key="card.title"><span>0{{ i+1 }}</span><div><h3>{{ card.title }}</h3><p>{{ card.text }}</p></div></article></div><p class="mci-enterprise-case-takeaway">{{ slide.takeaway }}</p></section>
        <!-- 所有原图始终列出，网页点击放大；导出沿用同一图库，不省略截图。 -->
        <section class="mci-enterprise-gallery" :class="`has-${slide.gallery.length}`" aria-label="案例原图图库"><figure v-for="(asset,i) in slide.gallery" :key="asset.url"><button type="button" :aria-label="`全屏查看${asset.alt}`" @click="$emit('preview',{src:asset.url,alt:asset.alt})"><img :src="asset.url" :alt="asset.alt" decoding="async"><span aria-hidden="true">⤢</span></button><figcaption><b>{{ String(i+1).padStart(2,'0') }}</b>{{ asset.alt }}</figcaption></figure></section>
      </div>
    </template>
    <template v-else-if="slide.layout === 'universe'">
      <div class="mci-industry-universe"><div class="mci-industry-universe-core"><i></i><i></i><i></i><span>MICROI ECOSYSTEM</span><strong>{{ slide.metric }}</strong><p>{{ slide.metricLabel }}</p><small>一个底座 · 无数可能</small></div><div class="mci-industry-cloud"><span v-for="(sector,i) in slide.sectors" :key="sector" :style="{'--sector-order':i}"><i>✦</i>{{ sector }}</span></div></div><footer class="mci-industry-universe-footer"><p>{{ slide.takeaway }}</p><a v-for="source in slide.sources" :key="source.href" :href="source.href" target="_blank" rel="noopener noreferrer">{{ source.label }} ↗</a></footer>
    </template>
  </div>
</template>
