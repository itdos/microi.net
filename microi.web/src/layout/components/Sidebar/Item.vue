<template>
    <div class="menu-item-wrapper">
        <el-icon v-if="resolvedIcon" :style="wordcolor" class="sub-el-icon svg-icon">
            <component :is="resolvedIcon" />
        </el-icon>
        <el-icon v-else :style="wordcolor" class="sub-el-icon svg-icon">
            <List />
        </el-icon>
        <span v-if="title" :style="wordcolor" class="menu-title">{{ title }}</span>
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
        wordcolor: {
            type: Object,
            default: function () {
                return {
                    marginLeft: "5px"
                };
            }
        }
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
        GetMenuWordColor() {
            var self = this;
            if (self.SysConfig && self.SysConfig.MenuBg == "Custom" && self.SysConfig.MenuWordColor) {
                return { color: self.SysConfig.MenuWordColor };
            }
            return { color: "#909399" }; //#909399 图标
        }
    }
};
</script>

<style scoped>
.menu-item-wrapper {
    display: inline-flex;
    align-items: center;
}
.sub-el-icon {
    color: currentColor;
    width: 1em;
    height: 1em;
}
.menu-title {
    margin-left: 5px;
}
</style>
