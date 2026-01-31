<template>
    <div class="form-amap">
        <div class="map-container" ref="mapContainer"></div>

        <!-- 配置弹窗 - 设计模式下可用 -->
        <el-dialog
            v-if="configDialogVisible"
            v-model="configDialogVisible"
            title="地图配置"
            width="500px"
            :close-on-click-modal="false"
            destroy-on-close
            append-to-body
        >
            <el-form label-width="100px" label-position="top" size="small">
                <el-form-item label="地图公司">
                    <el-radio-group v-model="configForm.MapCompany">
                        <el-radio value="Baidu">百度地图</el-radio>
                        <el-radio value="AMap">高德地图</el-radio>
                    </el-radio-group>
                    <div class="form-item-tip">选择使用的地图服务提供商</div>
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="configDialogVisible = false">取消</el-button>
                <el-button type="primary" @click="saveConfig">确定</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, getCurrentInstance } from "vue";

// 禁用属性继承
defineOptions({
    inheritAttrs: false
});

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

// 配置弹窗相关
const configDialogVisible = ref(false);
const configForm = ref({
    MapCompany: 'Baidu'
});

// 打开配置弹窗
const openConfig = () => {
    // 初始化配置表单
    if (!props.field.Config) {
        props.field.Config = {};
    }
    configForm.value = {
        MapCompany: props.field.Config.MapCompany || 'Baidu'
    };
    configDialogVisible.value = true;
};

// 保存配置
const saveConfig = () => {
    // 保存配置到 field.Config
    if (!props.field.Config) {
        props.field.Config = {};
    }
    props.field.Config.MapCompany = configForm.value.MapCompany;
    
    configDialogVisible.value = false;
    DiyCommon.Tips('配置已保存', true);
};

// 暴露方法给父组件
defineExpose({
    openConfig
});

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
.form-item-tip {
    font-size: 12px;
    color: #909399;
    line-height: 1.5;
    margin-top: 4px;
}
</style>
