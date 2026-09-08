<template>
    <section class="diy-component-source-info" data-component-source-info :aria-busy="loading">
        <header>
            <strong>{{ t('Msg.RenderSourceDetailsTitle') }}</strong>
            <MciRenderSourceBadge :type="sourceType" :source-info="sourceInfo" :instance-key="field.Id" />
        </header>
        <dl>
            <div><dt>{{ t('Msg.ComponentName') }}</dt><dd>{{ config.DevComponentName || '—' }}</dd></div>
            <div><dt>{{ t('Msg.ComponentPath') }}</dt><dd>{{ config.DevComponentPath || '—' }}</dd></div>
            <template v-if="sourceInfo.appKey">
                <div><dt>{{ t('Msg.MicroService') }}</dt><dd>{{ sourceInfo.appName }}</dd></div>
                <div><dt>{{ t('Msg.ApplicationKey') }}</dt><dd>{{ sourceInfo.appKey }}</dd></div>
                <div><dt>{{ t('Msg.RoutePath') }}</dt><dd>{{ sourceInfo.routePath }}</dd></div>
                <div><dt>{{ t('Msg.PageKey') }}</dt><dd>{{ sourceInfo.pageKey }}</dd></div>
                <div><dt>{{ t('Msg.Version') }}</dt><dd>{{ sourceInfo.version || t('Msg.StableRuntimeEntry') }}</dd></div>
                <div><dt>{{ t('Msg.SourcePath') }}</dt><dd>{{ sourceInfo.sourcePath }}</dd></div>
            </template>
        </dl>
        <el-skeleton v-if="loading" :rows="2" animated />
        <p v-else-if="error" role="status">{{ error }}</p>
        <p v-else-if="sourceType === 'microservice'">{{ t('Msg.MicroServiceLegacyComponentHint') }}</p>
    </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import MciRenderSourceBadge from '@/components/MciRenderSourceBadge/index.vue';
import DynamicComponentCache from '@/utils/dynamicComponentCache.js';
import { findLegacyMicroAppPage } from '@/utils/microAppDevComponentResolver.js';
import { loadMicroAppComponentPages, loadMicroAppComponentSourceInfo } from '@/utils/microAppComponentSource.js';

const props = defineProps({ field: { type: Object, required: true } });
const { t } = useI18n();
const config = computed(() => {
    if (typeof props.field.Config === 'object') return props.field.Config || {};
    try { return JSON.parse(props.field.Config || '{}'); } catch { return {}; }
});
const sourceType = computed(() => config.value.DevComponentPath
    ? DynamicComponentCache.getSource(config.value.DevComponentName, config.value.DevComponentPath) : 'custom');
const sourceInfo = ref({});
const loading = ref(false);
const error = ref('');
let generation = 0;
onBeforeUnmount(() => { generation += 1; });
watch(() => [props.field.Id, config.value.DevComponentName, config.value.DevComponentPath], async () => {
    const current = ++generation;
    const componentPath = config.value.DevComponentPath || '';
    sourceInfo.value = { componentName: config.value.DevComponentName || '', componentPath };
    error.value = '';
    loading.value = sourceType.value === 'microservice';
    if (!loading.value) return;
    try {
        const result = await loadMicroAppComponentPages();
        const page = findLegacyMicroAppPage(result, componentPath);
        if (!page) throw new Error(t('Msg.MicroServiceComponentAliasMissing'));
        const info = await loadMicroAppComponentSourceInfo(page, componentPath);
        if (current === generation) sourceInfo.value = info;
    } catch (e) {
        if (current === generation) error.value = e.message || t('Msg.MicroServiceComponentSourceFailed');
    } finally {
        if (current === generation) loading.value = false;
    }
}, { immediate: true });
</script>

<style scoped lang="scss">
.diy-component-source-info {
    margin: 8px 0 16px;
    padding: 12px;
    border-radius: var(--mci-radius-sm, 8px);
    background: var(--el-fill-color-light);
    color: var(--el-text-color-primary);
    font-size: 12px;
    header { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    dl { margin: 12px 0 0; }
    dl > div { display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 8px; margin-top: 8px; }
    dt, p { color: var(--el-text-color-secondary); }
    dd { margin: 0; overflow-wrap: anywhere; user-select: text; }
    p { margin: 12px 0 0; line-height: 1.6; }
}
</style>
