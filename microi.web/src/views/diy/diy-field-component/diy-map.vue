<template>
    <div class="form-amap">
        <div class="map-container" ref="mapContainer"></div>
    </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, getCurrentInstance } from "vue";

const props = defineProps({
    modelValue: {},
    field: {
        type: Object,
        required: true
    },
    FormMode: {
        type: String,
        default: ""
    },
    FormDiyTableModel: {
        type: Object,
        default: () => ({})
    }
});

const emit = defineEmits(["update:modelValue"]);

const { proxy } = getCurrentInstance();
const DiyCommon = proxy.DiyCommon;
const SysConfig = proxy.SysConfig;

const mapContainer = ref(null);
let mapInstance = null;

// 高德地图初始化逻辑
onMounted(() => {
    // 检查是否为高德地图
    if (props.field.Config && props.field.Config.MapCompany === 'AMap') {
        initAMap();
    }
});

const initAMap = () => {
    // 这里可以添加高德地图的初始化逻辑
    // 目前先保留占位容器
    // 完整的地图初始化代码可以根据需要后续添加
    
    // 示例：如果window.AMap可用
    if (window.AMap && mapContainer.value) {
        // mapInstance = new window.AMap.Map(mapContainer.value, {
        //     zoom: 11,
        //     center: [116.397428, 39.90923]
        // });
    }
};

onBeforeUnmount(() => {
    // 清理地图实例
    if (mapInstance) {
        try {
            if (mapInstance.destroy) {
                mapInstance.destroy();
            }
            mapInstance = null;
        } catch (e) {
            // ignore
        }
    }
    
    // 清理字段配置
    if (props.field.AmapConfig) {
        props.field.AmapConfig = null;
    }
});
</script>

<style scoped>
.form-amap {
    width: 100%;
}
.map-container {
    width: 100%;
    height: 400px;
    background-color: #f0f0f0;
}
</style>
