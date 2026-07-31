<template>
    <div class="menu-item-wrapper">
        <el-icon v-if="resolvedIcon" class="sub-el-icon svg-icon">
            <component :is="resolvedIcon" />
        </el-icon>
        <el-icon v-else class="sub-el-icon svg-icon">
            <List />
        </el-icon>
        <span v-if="title" class="menu-title" :title="title" :aria-label="title">{{ title }}</span>
        <span
            v-if="badgeText !== null"
            class="menu-stat-badge"
            :class="'is-' + badgeConfigModel.Tone"
            :style="badgeConfigModel.Color ? { backgroundColor: badgeConfigModel.Color } : undefined"
            :title="`${title}：${badgeRawValue}`"
            :aria-label="`${title}统计 ${badgeRawValue}`"
        >{{ badgeText }}</span>
    </div>
</template>

<script>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useDiyStore } from "@/pinia";
import { DiyCommon } from "@/utils/diy.common";
import * as ElementPlusIcons from "@element-plus/icons-vue";
import { convertIconName } from "@/utils/icon-compat";
import {
    formatBadgeValue,
    getValueByPath,
    normalizeMenuBadgeConfig
} from "@/views/form-engine/form-view-blocks/module-presentation-runtime";

const menuBadgeCache = new Map();

export default {
    name: "MenuItem",
    components: {
        ...ElementPlusIcons
    },
    props: {
        icon: {
            type: String,
            default: ""
        },
        title: {
            type: String,
            default: ""
        },
        menuId: {
            type: String,
            default: ""
        },
        badgeConfig: {
            type: [String, Object],
            default: ""
        }
    },
    setup(props) {
        const diyStore = useDiyStore();
        const SysConfig = computed(() => diyStore.SysConfig);
        const badgeRawValue = ref(null);
        let refreshTimer = null;
        let requestGeneration = 0;

        const badgeConfigModel = computed(() => normalizeMenuBadgeConfig(props.badgeConfig));
        const badgeText = computed(() => formatBadgeValue(badgeRawValue.value, badgeConfigModel.value));

        // 解析图标名称
        const resolvedIcon = computed(() => {
            if (!props.icon) return null;
            const iconName = convertIconName(props.icon);
            return ElementPlusIcons[iconName] || null;
        });

        const scheduleRefresh = () => {
            if (refreshTimer) window.clearTimeout(refreshTimer);
            if (!badgeConfigModel.value.Enabled) return;
            refreshTimer = window.setTimeout(loadBadge, badgeConfigModel.value.RefreshSeconds * 1000);
        };

        const loadBadge = async (force = false) => {
            const config = badgeConfigModel.value;
            const generation = ++requestGeneration;
            if (!config.Enabled || !props.menuId) {
                badgeRawValue.value = null;
                return;
            }
            const userId = diyStore.GetCurrentUser?.Id || diyStore.GetCurrentUser?.Account || "anonymous";
            const cacheKey = [DiyCommon.GetOsClient(), userId, props.menuId, config.ApiEngineKey, config.ValuePath].join(":");
            const cached = menuBadgeCache.get(cacheKey);
            const maxAge = config.RefreshSeconds * 1000;
            if (!force && cached && Date.now() - cached.time < maxAge) {
                badgeRawValue.value = cached.value;
                scheduleRefresh();
                return;
            }
            try {
                const result = await DiyCommon.ApiEngine.Run(config.ApiEngineKey, {
                    ...config.ParamMap,
                    _SysMenuId: props.menuId,
                    SysMenuId: props.menuId,
                    OsClient: DiyCommon.GetOsClient()
                });
                if (result && typeof result === "object" && Object.prototype.hasOwnProperty.call(result, "Code") && Number(result.Code) !== 1) {
                    throw new Error(result.Msg || "菜单统计接口返回失败");
                }
                if (generation !== requestGeneration) return;
                let value = getValueByPath(result, config.ValuePath);
                // 官方约定为 Data.Value；同时兼容常见的 Data.Count 和标量 Data 返回。
                if (value === undefined) value = getValueByPath(result, "Data.Count");
                if (value === undefined) {
                    const dataValue = getValueByPath(result, "Data");
                    if (dataValue === null || typeof dataValue !== "object") value = dataValue;
                }
                badgeRawValue.value = value;
                menuBadgeCache.set(cacheKey, { time: Date.now(), value });
            } catch (error) {
                if (generation === requestGeneration && !cached) badgeRawValue.value = null;
            } finally {
                if (generation === requestGeneration) scheduleRefresh();
            }
        };

        watch(() => [props.menuId, props.badgeConfig], () => loadBadge(true), { deep: true });
        onMounted(() => loadBadge());
        onBeforeUnmount(() => {
            requestGeneration++;
            if (refreshTimer) window.clearTimeout(refreshTimer);
        });

        return {
            diyStore,
            SysConfig,
            resolvedIcon,
            badgeConfigModel,
            badgeRawValue,
            badgeText
        };
    },
    computed: {},
    methods: {
        
    }
};
</script>

<style scoped lang="scss">
.menu-item-wrapper {
    display: flex;
    align-items: center;
    gap: 3px;
    width: 100%;
    min-width: 0;
}

.sub-el-icon {
    color: currentColor;
    width: 20px;
    height: 20px;
    min-width: 20px;
    min-height: 20px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: relative;
    
    // 图标容器背景效果
    &::before {
        content: '';
        position: absolute;
        inset: -4px;
        border-radius: 6px;
        background: radial-gradient(circle, rgba(255, 255, 255, 0.15) 0%, transparent 70%);
        opacity: 0;
        transition: opacity 0.3s ease;
    }
}

// 悬停时图标背景发光
.el-menu-item:hover .sub-el-icon::before,
.el-sub-menu__title:hover .sub-el-icon::before {
    opacity: 1;
}

// 活动状态图标特效
.el-menu-item.is-active .sub-el-icon {
    animation: icon-pulse 2s ease-in-out infinite;
}

@keyframes icon-pulse {
    0%, 100% {
        transform: scale(1);
    }
    50% {
        transform: scale(1.05);
    }
}

.menu-title {
    min-width: 0;
    flex: 1;
    font-size: 12px;
    // font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.menu-stat-badge {
    flex: 0 0 auto;
    min-width: 20px;
    max-width: 52px;
    height: 20px;
    padding: 0 6px;
    border-radius: 10px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    background: var(--el-color-primary, #409eff);
    font-size: 11px;
    font-weight: 700;
    line-height: 1;
    font-variant-numeric: tabular-nums;

    &.is-danger { background: var(--el-color-danger, #f56c6c); }
    &.is-warning { background: var(--el-color-warning, #e6a23c); color: #302100; }
    &.is-success { background: var(--el-color-success, #67c23a); }
    &.is-info { background: var(--el-color-info, #909399); }
}
</style>

