<template>
    <template v-if="visible">
        <app-link v-if="!children.length || singleLeaf" :to="leafTarget">
            <el-menu-item :index="leafTarget">
                <item :icon="leafMeta?.icon || route.meta?.icon" :title="formatTitle(leafMeta?.title || '')" :menu-id="leafMeta?.Id" :badge-config="leafMeta?.MenuBadgeConfig" />
            </el-menu-item>
        </app-link>
        <el-sub-menu v-else :index="target" popper-class="mci-top-navigation-popup" :teleported="true">
            <template #title><item :icon="route.meta?.icon" :title="formatTitle(route.meta?.title || '')" :menu-id="route.meta?.Id" :badge-config="route.meta?.MenuBadgeConfig" /></template>
            <top-navigation-item v-for="child in children" :key="child.path || child.meta?.Id" :route="child" :base-path="target" />
        </el-sub-menu>
    </template>
</template>

<script setup>
import { computed, getCurrentInstance } from 'vue';
import Item from './Sidebar/Item.vue';
import AppLink from './Sidebar/Link.vue';
import path from '@/utils/path';
import { isExternal } from '@/utils/validate';
import { generateTitle } from '@/utils/i18n';
const props = defineProps({route:{type:Object,required:true},basePath:{type:String,default:''}});
const instance = getCurrentInstance();
const formatTitle = title => generateTitle.call(instance.proxy, title);
const visible = computed(() => props.route.Display !== 0 && props.route.Display !== '0' && !props.route.hidden && Boolean(props.route.meta));
const children = computed(() => (props.route.children || []).filter(child => child.Display !== 0 && child.Display !== '0' && !child.hidden));
const singleLeaf = computed(() => !props.route.alwaysShow && children.value.length === 1 && !(children.value[0].children || []).some(child => child.Display !== 0 && child.Display !== '0' && !child.hidden));
const leafMeta = computed(() => singleLeaf.value ? children.value[0].meta : props.route.meta);
const leafTarget = computed(() => {
    if (!singleLeaf.value) return target.value;
    const child = children.value[0];
    const value = isExternal(child.path) ? child.path : path.resolve(target.value, child.path || '');
    return value + (child.UrlParam ? (value.includes('?') ? '&' : '?') + child.UrlParam : '');
});
const target = computed(() => {
    const value = props.route.path || props.basePath;
    const query = props.route.UrlParam;
    if (isExternal(value)) return value + (query ? (value.includes('?') ? '&' : '?') + query : '');
    if (value.startsWith('/iframe')) return value;
    return path.resolve(props.basePath, value) + (query ? '?' + query : '');
});
</script>
