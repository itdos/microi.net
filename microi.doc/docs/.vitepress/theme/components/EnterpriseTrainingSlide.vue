<script setup lang="ts">
import { enterpriseSlides } from '../enterprise-training-slides.js'
defineProps<{ slide: (typeof enterpriseSlides)[number]; index: number }>()
defineEmits<{ start: [] }>()
</script>

<template>
  <div class="mci-enterprise-slide" :class="`is-layout-${slide.layout}`">
    <header class="mci-enterprise-heading mci-deck-reveal">
      <div><p class="mci-deck-eyebrow">{{ slide.eyebrow }}</p><h1 v-if="index === 0">{{ slide.title }}</h1><h2 v-else>{{ slide.title }}</h2><p>{{ slide.summary }}</p></div>
      <span class="mci-enterprise-page">{{ String(index + 1).padStart(2, '0') }}</span>
    </header>
    <div class="mci-enterprise-body" :class="{ 'has-image': slide.image }">
      <div class="mci-enterprise-story">
        <p v-if="slide.lead" class="mci-enterprise-lead mci-deck-reveal">{{ slide.lead }}</p>
        <div v-if="slide.metrics?.length" class="mci-enterprise-metrics mci-deck-reveal"><div v-for="metric in slide.metrics" :key="metric.label"><strong>{{ metric.value }}</strong><span>{{ metric.label }}</span><small v-if="metric.note">{{ metric.note }}</small></div></div>
        <ol v-if="slide.steps?.length" class="mci-enterprise-flow mci-deck-reveal"><li v-for="(step, stepIndex) in slide.steps" :key="step"><i>{{ String(stepIndex + 1).padStart(2, '0') }}</i><strong>{{ step }}</strong></li></ol>
        <div v-if="slide.cards?.length" class="mci-enterprise-cards" :class="{ 'is-six': slide.cards.length > 4, 'is-three': slide.cards.length === 3 }"><article v-for="(card, cardIndex) in slide.cards" :key="card.title" class="mci-deck-reveal" :style="{ '--mci-deck-order': cardIndex }"><span>{{ card.label || String(cardIndex + 1).padStart(2, '0') }}</span><h3>{{ card.title }}</h3><p>{{ card.text }}</p></article></div>
      </div>
      <figure v-if="slide.image" class="mci-enterprise-image mci-deck-reveal"><img :src="slide.image.src" :alt="slide.image.alt"><figcaption>{{ slide.image.caption }}</figcaption></figure>
    </div>
    <footer class="mci-enterprise-footer mci-deck-reveal">
      <p v-if="slide.takeaway" class="mci-enterprise-takeaway">{{ slide.takeaway }}</p>
      <div class="mci-enterprise-sources"><a v-for="source in slide.sources" :key="source.href" :href="source.href" target="_blank" rel="noopener noreferrer">{{ source.label }} ↗</a><span>Microi吾码 · 企业应用版</span></div>
      <button v-if="index === 0" class="mci-deck-start mci-screen-only" type="button" @click="$emit('start')">开始企业应用介绍 →</button>
    </footer>
  </div>
</template>
