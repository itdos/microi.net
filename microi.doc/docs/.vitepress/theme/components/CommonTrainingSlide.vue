<script setup lang="ts">
import { computed } from 'vue'
import {
  trainingArchitectureImage,
  trainingCoreBenefits,
  trainingDeliveryStages,
  trainingFrameworkLayers,
  trainingFrameworkPaths,
  trainingFrameworkTitle,
  trainingTrustSignals,
  trainingWhyAdvantages,
} from '../common-training-content.js'
import '../styles/common-training-slides.scss'

const props = withDefaults(defineProps<{
  kind: 'cover' | 'decision' | 'why' | 'closing'
  version?: 'technical' | 'enterprise'
  title?: string
  summary?: string
  index?: number
  total?: number
}>(), { version: 'technical', title: '', summary: '', index: 0, total: 0 })

defineEmits<{ start: []; preview: [image: { src: string; alt: string }] }>()

const isEnterprise = computed(() => props.version === 'enterprise')
const page = computed(() => String(props.index + 1).padStart(2, '0'))
const coverRoute = computed(() => isEnterprise.value
  ? '以成功案例为路线，现场了解平台如何走进工厂、组织、数字世界与更多行业。'
  : '以功能点为路线，现场了解平台、引擎能力、AI 开发与企业交付。')
</script>

<template>
  <div class="mci-common-training" :class="[`is-common-${kind}`, `is-version-${version}`]">
    <template v-if="kind === 'cover'">
      <div class="mci-common-cover">
        <header class="mci-common-cover__copy">
          <p class="mci-common-eyebrow">MICROI · OPEN-SOURCE AI DEVELOPMENT FRAMEWORK</p>
          <h1><span>Microi吾码</span><strong>AI 开发框架</strong><em>{{ isEnterprise ? '企业版介绍' : '技术培训大纲' }}</em></h1>
          <p class="mci-common-cover__route">{{ coverRoute }}</p>
          <div class="mci-common-cover__metrics" aria-label="平台核心价值">
            <div><strong>10×+</strong><span>Token 更省*</span></div>
            <div><strong>10×+</strong><span>AI 开发更快*</span></div>
            <div><strong>30+</strong><span>成熟引擎</span></div>
          </div>
          <button class="mci-common-start mci-screen-only" type="button" @click="$emit('start')">{{ isEnterprise ? '开始介绍' : '开始培训' }}<span aria-hidden="true">→</span></button>
        </header>
        <div class="mci-common-cover__visual" aria-label="成熟平台底座与 AI 交付链路">
          <div class="mci-common-core">
            <div class="mci-common-core__ring is-one" aria-hidden="true"></div>
            <div class="mci-common-core__ring is-two" aria-hidden="true"></div>
            <div class="mci-common-core__mark"><img src="/icon.png" alt="Microi吾码"><strong>AI</strong><span>BUILD · RUN · DELIVER</span></div>
            <span class="mci-common-core__label is-top">MCP + SKILLS</span>
            <span class="mci-common-core__label is-left">30+ 引擎</span>
            <span class="mci-common-core__label is-right">V8 RUNTIME</span>
          </div>
          <p>成熟底座承接通用能力<br><strong>让 AI 专注真正有差异的业务</strong></p>
        </div>
      </div>
      <section class="mci-common-benefits" aria-label="Microi吾码核心优势">
        <article v-for="benefit in trainingCoreBenefits" :key="benefit.code" :class="`is-tone-${benefit.tone}`">
          <span class="mci-common-benefits__glyph" aria-hidden="true">{{ benefit.code }}</span><div><strong>{{ benefit.title }}</strong><small>{{ benefit.text }}</small></div>
        </article>
      </section>
      <footer class="mci-common-cover__foot"><div class="mci-common-trust"><span v-for="signal in trainingTrustSignals" :key="signal">{{ signal }}</span></div><small>* 典型平台能力高复用场景；实际收益取决于需求与团队基线。</small></footer>
    </template>

    <template v-else-if="kind === 'decision'">
      <header class="mci-common-heading"><div><p class="mci-common-eyebrow">02 · FRAMEWORK / SYSTEM ARCHITECTURE</p><h2>{{ title || trainingFrameworkTitle }}</h2><p>绝大部分研发团队，在开发软件前都会先选型一套系统框架。</p></div><span>{{ page }}</span></header>
      <section class="mci-common-foundation" aria-label="系统架构选型范围">
        <div class="mci-common-foundation__label"><span>先选底座</span><strong>从界面到运行，<br>是一整套系统能力</strong></div>
        <div class="mci-common-foundation__layers"><div v-for="layer in trainingFrameworkLayers" :key="layer.label" :class="`is-tone-${layer.tone}`"><i aria-hidden="true">{{ layer.glyph }}</i><span>{{ layer.label }}</span></div></div>
        <div class="mci-common-foundation__count"><strong>30+</strong><span>吾码 AI 框架提供的引擎</span><small>以及更多可复用能力</small></div>
      </section>
      <div class="mci-common-paths" aria-label="两种 AI 软件研发路径">
        <article v-for="path in trainingFrameworkPaths" :key="path.code" :class="`is-tone-${path.tone}`">
          <header><span>{{ path.code }}</span><h3>{{ path.title }}</h3></header>
          <ol><li v-for="step in path.steps" :key="step">{{ step }}</li></ol>
          <p>{{ path.text }}</p><strong class="mci-common-paths__outcome">{{ path.outcome }}</strong>
        </article>
      </div>
      <section class="mci-common-maturity" aria-label="自研系统架构的积累成本">
        <div class="mci-common-maturity__years"><strong>8<span>年</span></strong><p>吾码持续升级迭代</p></div>
        <div><h3>架构成熟度，需要时间与真实项目共同打磨</h3><p>吾码与 ChatGPT、Opus 等大模型连续对话多年，持续以 AI 对话升级研发。若企业自研类似的高性能分布式系统架构 / 框架，即使花费 <b>1 年以上</b>与 AI 对话开发，也大概率仍难以达到市面上成熟系统框架的综合水平。</p></div>
      </section>
      <footer class="mci-common-decision-verdict"><strong>企业研发软件，优先选型一套系统框架至关重要。</strong><p>市面上优秀的开源系统框架很多，许多企业正基于它们开发软件；欢迎与吾码进行全方位对比。</p></footer>
    </template>

    <template v-else-if="kind === 'why'">
      <header class="mci-common-heading"><div><p class="mci-common-eyebrow">03 · WHY MICROI</p><h2>为什么选择吾码？</h2><p>系统灵活性做到极致，通用能力成熟复用，业务差异持续扩展。</p></div><span>{{ page }}</span></header>
      <div class="mci-common-why">
        <section class="mci-common-why__advantages" aria-label="Microi吾码八项能力优势"><article v-for="advantage in trainingWhyAdvantages" :key="advantage.code" :class="`is-tone-${advantage.tone}`"><span aria-hidden="true">{{ advantage.code }}</span><div><h3>{{ advantage.title }}</h3><p>{{ advantage.text }}</p></div></article></section>
        <aside class="mci-common-why__architecture">
          <div class="mci-common-architecture-title"><span>SYSTEM ARCHITECTURE</span><strong>一套底座，贯通企业交付</strong></div>
          <!-- 架构图保留原始 SVG；预览交由演示稿统一弹层，PDF 直接使用此缩略图。 -->
          <button class="mci-common-architecture" type="button" aria-label="全屏查看 Microi吾码系统架构图" @click="$emit('preview', trainingArchitectureImage)"><img :src="trainingArchitectureImage.src" :alt="trainingArchitectureImage.alt" decoding="sync"><span class="mci-screen-only">点击全屏查看 <i aria-hidden="true">⤢</i></span></button>
          <div class="mci-common-download-proof"><span>微软 NuGet 下载量</span><strong>1189<span>万+</span></strong><small>截止2026年10月16日</small></div>
          <p class="mci-common-why__promise">一句话，开发大型企业应用<br><strong>0 代码提速，工程化不设上限</strong></p>
        </aside>
      </div>
      <ol class="mci-common-delivery" aria-label="企业交付闭环"><li v-for="(stage, stageIndex) in trainingDeliveryStages" :key="stage"><i>{{ String(stageIndex + 1).padStart(2, '0') }}</i><span>{{ stage }}</span></li></ol>
      <div class="mci-common-trust is-centered"><span v-for="signal in trainingTrustSignals" :key="signal">{{ signal }}</span></div>
    </template>

    <template v-else>
      <header class="mci-common-closing"><div class="mci-common-closing__signal"><img src="/icon.png" alt="Microi吾码"><span>READY TO BUILD</span><i aria-hidden="true"></i></div><p class="mci-common-eyebrow">THANK YOU<span v-if="total"> · {{ total }} / {{ total }}</span></p><h2>把 AI 的速度，<br><strong>变成企业交付力。</strong></h2><p>从今天开始，少重复造轮子，多创造真正有差异的业务价值。</p></header>
      <section class="mci-common-benefits is-closing-benefits" aria-label="再次回顾 Microi吾码核心优势"><article v-for="benefit in trainingCoreBenefits" :key="benefit.code" :class="`is-tone-${benefit.tone}`"><span class="mci-common-benefits__glyph" aria-hidden="true">{{ benefit.code }}</span><div><strong>{{ benefit.title }}</strong><small>{{ benefit.text }}</small></div></article></section>
      <div class="mci-common-closing__outcomes"><span>10×+ Token 更省*</span><span>10×+ AI 开发更快*</span><span>30+ 成熟引擎</span><span v-for="signal in trainingTrustSignals" :key="signal">{{ signal }}</span><span>成熟案例</span></div>
      <div class="mci-common-closing__actions mci-screen-only"><a href="/profile.html#/overview" class="is-primary">立即开始使用 <span aria-hidden="true">→</span></a><a href="/doc/" target="_blank" rel="noopener noreferrer">打开官方文档 <span aria-hidden="true">↗</span></a></div>
      <small class="mci-common-closing__signature">* 典型平台能力高复用场景；实际收益取决于需求与团队基线。<br>MICROI吾码 · OPEN-SOURCE AI DEVELOPMENT FRAMEWORK</small>
    </template>
  </div>
</template>
