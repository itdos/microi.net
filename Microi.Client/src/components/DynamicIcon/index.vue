<template>
    <el-icon :class="iconClass" :style="iconStyle">
        <component :is="currentIcon" />
    </el-icon>
</template>

<script>
/**
 * 动态图标兼容组件
 * 支持 Element UI 风格的动态图标切换
 *
 * 用法：
 * <dynamic-icon :name="loading ? 'loading' : 'search'" />
 * <dynamic-icon :name="active ? 'el-icon-check' : 'el-icon-close'" />
 */
import * as ElementPlusIcons from "@element-plus/icons-vue";

// 图标名称映射表
const iconMapping = {
    loading: "Loading",
    search: "Search",
    edit: "Edit",
    delete: "Delete",
    close: "Close",
    check: "Check",
    plus: "Plus",
    minus: "Minus",
    refresh: "Refresh",
    setting: "Setting",
    "s-help": "QuestionFilled",
    "s-grid": "Grid",
    "s-operation": "Operation",
    document: "Document",
    "full-screen": "FullScreen",
    upload: "Upload",
    upload2: "UploadFilled"
};

export default {
    name: "DynamicIcon",
    props: {
        name: {
            type: String,
            required: true
        },
        iconClass: {
            type: [String, Object, Array],
            default: ""
        },
        iconStyle: {
            type: [String, Object],
            default: ""
        }
    },
    computed: {
        currentIcon() {
            const iconName = this.convertIconName(this.name);
            return ElementPlusIcons[iconName] || ElementPlusIcons.QuestionFilled;
        }
    },
    methods: {
        convertIconName(name) {
            if (!name) return "QuestionFilled";

            // 移除 el-icon- 前缀
            const cleanName = name.replace(/^el-icon-/, "");

            // 查找映射
            if (iconMapping[cleanName]) {
                return iconMapping[cleanName];
            }

            // 自动转换 xxx-yyy -> XxxYyy
            return cleanName
                .split("-")
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join("");
        }
    }
};
</script>
