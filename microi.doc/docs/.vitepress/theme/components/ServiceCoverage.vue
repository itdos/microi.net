<script setup>
import { serviceNetwork } from '../../config/service-network.mjs'
</script>

<template>
  <section class="mci-service-coverage" data-mci-public-fact="service-network" :data-reviewed-on="serviceNetwork.reviewedOn">
    <h2 id="service-coverage" tabindex="-1">服务地区与统一对接 <a class="header-anchor" href="#service-coverage" aria-label="服务地区与统一对接">​</a></h2>
    <p>{{ serviceNetwork.scope }}</p>
    <table>
      <thead><tr><th scope="col">地区</th><th scope="col">行政区划口径</th></tr></thead>
      <tbody>
        <tr v-for="region in serviceNetwork.regions" :key="region.name"><td>{{ region.name }}</td><td>{{ region.level }}</td></tr>
      </tbody>
    </table>
    <p id="service-contact"><strong>统一联系：</strong>{{ serviceNetwork.contactName }} · <a :href="`tel:${serviceNetwork.telephone}`">{{ serviceNetwork.telephone }}</a>（{{ serviceNetwork.contactType }}）。联系时说明所在地区、业务目标、平台版本、预计时间及需要的服务内容。</p>
    <p class="mci-service-coverage__source">信息核实：<time :datetime="serviceNetwork.reviewedOn">{{ serviceNetwork.reviewedOn }}</time> · 来源：{{ serviceNetwork.source }}。最新安排请向上述联系人核实；服务商名录与地区覆盖分别列示，不推定每家服务商覆盖全部地区。</p>
  </section>
</template>

<style scoped>
.mci-service-coverage { min-width: 0; }
.mci-service-coverage table { width: 100%; }
.mci-service-coverage__source { color: var(--vp-c-text-2); font-size: 0.9em; }
</style>
