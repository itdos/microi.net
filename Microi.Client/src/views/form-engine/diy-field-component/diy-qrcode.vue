<template>
    <div class="diy-qrcode">
        <el-button type="success" :loading="loading" :disabled="!imageDataUrl" @click="downloadQrCode">
            下载二维码
        </el-button>
        <img
            v-if="imageDataUrl"
            class="diy-qrcode__card"
            :src="imageDataUrl"
            :alt="payload.titleText || '二维码'"
        />
        <el-alert v-else-if="errorMessage" class="diy-qrcode__error" type="warning" :closable="false" :title="errorMessage" />
    </div>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import {
    createLegacyQrCodeCardDataUrl,
    downloadLegacyQrCode,
    normalizeLegacyQrCodePayload
} from "@/utils/legacy-qrcode.js";

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

const emit = defineEmits(["update:modelValue", "send-data"]);
const imageDataUrl = ref("");
const errorMessage = ref("");
const loading = ref(false);
let renderVersion = 0;

const payload = computed(() => normalizeLegacyQrCodePayload(props.field?.DataAppend || {}));

watch(
    () => props.field?.DataAppend,
    async (dataAppend) => {
        const currentVersion = ++renderVersion;
        imageDataUrl.value = "";
        errorMessage.value = "";
        loading.value = false;
        if (!dataAppend?.Code) return;

        loading.value = true;
        try {
            const value = await createLegacyQrCodeCardDataUrl(dataAppend);
            if (currentVersion !== renderVersion) return;
            imageDataUrl.value = value;
            emit("update:modelValue", value);
            emit("send-data", value);
        } catch (error) {
            if (currentVersion !== renderVersion) return;
            errorMessage.value = error?.message || "二维码生成失败";
        } finally {
            if (currentVersion === renderVersion) loading.value = false;
        }
    },
    { deep: true, immediate: true }
);

async function downloadQrCode() {
    try {
        await downloadLegacyQrCode(props.field?.DataAppend || {});
        ElMessage.success("二维码下载成功");
    } catch (error) {
        ElMessage.error(error?.message || "二维码下载失败");
    }
}
</script>

<style scoped>
.diy-qrcode {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;
}

.diy-qrcode__card {
    display: block;
    width: 400px;
    max-width: 100%;
    height: auto;
}

.diy-qrcode__error {
    max-width: 400px;
}
</style>
