<script setup lang="ts">
import { computed } from 'vue'
import {
  trainingArchitectureImage,
  trainingEngineGroups,
  trainingAdditionalEngines,
  trainingWhyProof,
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
            <div><strong>引擎复用</strong><span>减少重复开发</span></div>
            <div><strong>在线编排</strong><span>聚焦业务增量</span></div>
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
      <header class="mci-common-heading"><div><p class="mci-common-eyebrow">02 · FRAMEWORK / SYSTEM ARCHITECTURE</p><h2>{{ title || trainingFrameworkTitle }}</h2></div><span>{{ page }}</span></header>
      <section class="mci-framework-hero" aria-label="企业研发的框架选型结论">
        <strong>企业研发软件，<em>优先选型一套系统框架至关重要。</em></strong>
        <p>市面上有非常多优秀的<strong><span>开源前端框架</span>、<span>后端框架</span>、<span>工作流引擎等等</span></strong>，<br>许多企业正基于它们开发软件。</p>
      </section>
      <section class="mci-common-foundation" aria-label="系统架构选型范围">
        <div class="mci-common-foundation__label"><span>先选框架，再做业务</span><strong>绝大部分研发团队<br>都会在开发前先选型</strong></div>
        <div class="mci-common-foundation__layers"><div v-for="layer in trainingFrameworkLayers" :key="layer.label" :class="'is-tone-' + layer.tone"><i aria-hidden="true">{{ layer.glyph }}</i><span>{{ layer.label }}</span></div></div>
      </section>
      <div class="mci-common-paths" aria-label="两种 AI 软件研发路径">
        <article v-for="path in trainingFrameworkPaths" :key="path.code" :class="'is-tone-' + path.tone">
          <header><span>{{ path.code }}</span><h3>{{ path.title }}</h3></header>
          <ol><li v-for="step in path.steps" :key="step">{{ step }}</li></ol>
          <p>{{ path.text }}</p><strong class="mci-common-paths__outcome">{{ path.outcome }}</strong>
        </article>
      </div>
      <footer class="mci-framework-maturity"><span>长期演进</span><div><strong>成熟架构，来自持续迭代与真实项目验证</strong><p>若自研高性能分布式系统架构 / 框架，即使花费 <b>1 年以上</b>与 AI 对话开发，也大概率仍难以达到市面上成熟系统框架的综合水平。选型时应综合比较能力完整度、稳定性、开放性与维护成本。</p></div></footer>
    </template>

    <template v-else-if="kind === 'why'">
      <header class="mci-common-heading"><div><p class="mci-common-eyebrow">03 · WHY MICROI</p><h2>为什么选择吾码？<em>让 AI 站在 30+ 成熟引擎上</em></h2><p>通用能力由引擎承接，AI 专注业务差异；实际收益以同任务测试结果为准。</p></div><span>{{ page }}</span></header>
      <div class="mci-engine-proof">
        <aside class="mci-engine-proof__evidence" aria-label="吾码成熟度与系统架构">
          <div class="mci-engine-proof__hero"><strong>30<span>+</span></strong><div><b>成熟插件化引擎</b><span>一套开源 AI 开发框架的底座</span></div></div>
          <div class="mci-engine-proof__metrics"><div><strong>12<span>年</span></strong><b>吾码持续升级迭代</b><small>始于2014年，2018年重构，2025年开源</small></div><div class="mci-common-download-proof"><strong>{{ trainingWhyProof.downloads }}<span>万+</span></strong><b>微软 NuGet 下载量</b><small>截至{{ trainingWhyProof.date }}</small></div></div>
          <p class="mci-engine-proof__token"><strong>引擎复用</strong><span>聚焦业务增量<small>复用通用能力，减少重复实现</small></span></p>
          <!-- 保留原始CDN架构图，网页可全屏查看；PDF中显示清晰缩略图。 -->
          <button class="mci-common-architecture" type="button" aria-label="全屏查看 Microi吾码系统架构图" @click="$emit('preview', trainingArchitectureImage)"><img :src="trainingArchitectureImage.src" :alt="trainingArchitectureImage.alt" decoding="sync"><span class="mci-screen-only">系统架构图 · 点击全屏 <i aria-hidden="true">⤢</i></span></button>
          <small class="mci-engine-proof__history">与 ChatGPT、Opus 等大模型连续对话多年，持续以 AI 对话升级研发。</small>
        </aside>
        <section class="mci-engine-proof__catalog" aria-label="五大引擎与特色能力分组">
          <div class="mci-engine-matrix"><section v-for="group in trainingEngineGroups" :key="group.title" :class="'is-tone-' + group.tone"><h3>{{ group.title }}<small>{{ String(group.engines.length).padStart(2, '0') }}</small></h3><ul><li v-for="engine in group.engines" :key="engine">{{ engine }}</li></ul></section></div>
          <p class="mci-engine-proof__more"><b>特色能力</b><span v-for="engine in trainingAdditionalEngines" :key="engine">{{ engine }}</span></p>
          <div class="mci-engine-proof__benefits" aria-label="引擎如何支撑业务"><article v-for="advantage in trainingWhyAdvantages" :key="advantage.code" :class="'is-tone-' + advantage.tone"><span aria-hidden="true">{{ advantage.code }}</span><div><h3>{{ advantage.title }}</h3><p>{{ advantage.text }}</p></div></article></div>
        </section>
      </div>
      <footer class="mci-engine-proof__promise"><p class="mci-common-why__promise"><span>一句话，开发大型企业应用</span><strong>0 代码提速，工程化不设上限</strong></p><p>AI 负责理解业务，<strong>引擎负责把事做对。</strong></p></footer>
      <div class="mci-engine-proof__foundation"><span>高性能 · 分布式原生 · .NET 10 / Vue 3 / Redis · L1 + L2</span><span>MCP + Skills · 全自动化测试 · 企业级治理</span></div>
      <p class="mci-engine-proof__note">* Token 收益依需求与团队基线而异；AI CAD / SolidWorks 为技术预览。各能力配置与适用范围详见官方文档，欢迎与优秀框架全方位对比。</p>
    </template>

    <template v-else>
      <header class="mci-common-closing"><div class="mci-common-closing__signal"><img src="/icon.png" alt="Microi吾码"><span>READY TO BUILD</span><i aria-hidden="true"></i></div><p class="mci-common-eyebrow">THANK YOU<span v-if="total"> · {{ total }} / {{ total }}</span></p><h2>把 AI 的速度，<br><strong>变成企业交付力。</strong></h2><p>从今天开始，少重复造轮子，多创造真正有差异的业务价值。</p></header>
      <section class="mci-common-benefits is-closing-benefits" aria-label="再次回顾 Microi吾码核心优势"><article v-for="benefit in trainingCoreBenefits" :key="benefit.code" :class="`is-tone-${benefit.tone}`"><span class="mci-common-benefits__glyph" aria-hidden="true">{{ benefit.code }}</span><div><strong>{{ benefit.title }}</strong><small>{{ benefit.text }}</small></div></article></section>
      <div class="mci-common-closing__outcomes"><span>引擎复用 · 减少重复开发</span><span>在线编排 · 聚焦业务增量</span><span>30+ 成熟引擎</span><span v-for="signal in trainingTrustSignals" :key="signal">{{ signal }}</span><span>成熟案例</span></div>
      <div class="mci-common-closing__actions mci-screen-only"><a href="/profile.html#/overview" class="is-primary">立即开始使用 <span aria-hidden="true">→</span></a><a href="/doc/" target="_blank" rel="noopener noreferrer">打开官方文档 <span aria-hidden="true">↗</span></a></div>
      <small class="mci-common-closing__signature">* 典型平台能力高复用场景；实际收益取决于需求与团队基线。<br>MICROI吾码 · OPEN-SOURCE AI DEVELOPMENT FRAMEWORK</small>
    </template>
  </div>
</template>
