<template>
    <div class="menu-item-wrapper">
        <el-icon v-if="resolvedIcon" class="sub-el-icon svg-icon">
            <component :is="resolvedIcon" />
        </el-icon>
        <el-icon v-else class="sub-el-icon svg-icon">
            <List />
        </el-icon>
        <span v-if="title" class="menu-title">{{ title }}</span>
    </div>
</template>

<script>
import { computed } from "vue";
import { useDiyStore } from "@/pinia";
import * as ElementPlusIcons from "@element-plus/icons-vue";
import { convertIconName } from "@/utils/icon-compat";

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
    },
    setup(props) {
        const diyStore = useDiyStore();
        const SysConfig = computed(() => diyStore.SysConfig);

        // 解析图标名称
        const resolvedIcon = computed(() => {
            if (!props.icon) return null;
            const iconName = convertIconName(props.icon);
            return ElementPlusIcons[iconName] || null;
        });

        return {
            diyStore,
            SysConfig,
            resolvedIcon
        };
    },
    computed: {},
    methods: {
        
    }
};
</script>

<style scoped lang="scss">
.menu-item-wrapper {
    display: inline-flex;
    align-items: center;
    gap: 3px;
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
        background: radial-gradient(circle, color-mix(in srgb, currentColor 15%, transparent) 0%, transparent 70%);
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
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
</style>

