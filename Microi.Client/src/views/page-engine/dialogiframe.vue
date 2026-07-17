<template>
    <div class="open-iframe-dialog">
        <PrintEngineView
            v-if="IsPrintDialog"
            :DataAppend="PrintDataAppend"
        />
        <iframe
            v-else
            class="open-iframe-dialog__frame"
            :src="IframeUrl"
            frameborder="0"
        />
    </div>
</template>

<script>
import { defineAsyncComponent } from "vue";

const PrintEngineView = defineAsyncComponent(() => import("@/views/print-engine/renderer.vue"));

function NormalizeHttpUrl(url) {
    return String(url || "").trim().replace(/^(https?):\/(?!\/)/i, "$1://");
}

export default {
    name: "OpenIframe",
    components: {
        PrintEngineView,
    },
    props: {
        DataAppend: {
            type: Object,
            default: () => ({}),
        },
    },
    computed: {
        IsPrintDialog() {
            return !!this.DataAppend?.PrintId;
        },
        IframeUrl() {
            return this.DataAppend?.Url || "";
        },
        PrintDataAppend() {
            const dataAppend = { ...(this.DataAppend || {}) };
            if (dataAppend.DataApi) {
                dataAppend.DataApi = NormalizeHttpUrl(dataAppend.DataApi);
            }
            return dataAppend;
        },
    },
};
</script>

<style scoped>
.open-iframe-dialog,
.open-iframe-dialog__frame {
    width: 100%;
    height: calc(100vh - 120px);
    min-height: 480px;
}
</style>
