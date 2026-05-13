<template>
    <div class="diy-v8design-compat">
        <el-button class="edit" type="primary" @click="show">代码设计器</el-button>
        <DiyCodeDesign
            ref="designerRef"
            v-model:model="innerModel"
            :fields="fields"
            default-tab="v8"
            @insert-code="insertCode"
        />
    </div>
</template>

<script setup>
import { ref, watch } from "vue";
import DiyCodeDesign from "./diy-code-design.vue";

defineOptions({
    name: "DiyV8Design"
});

const props = defineProps({
    fields: {
        type: Array,
        default: () => []
    },
    model: {
        type: [String, Number, Object, Array],
        default: ""
    }
});

const emit = defineEmits(["update:model"]);
const designerRef = ref(null);
const innerModel = ref(normalizeCode(props.model));

watch(
    () => props.model,
    (value) => {
        const nextValue = normalizeCode(value);
        if (nextValue !== innerModel.value) innerModel.value = nextValue;
    }
);

watch(innerModel, (value) => {
    emit("update:model", value);
});

function normalizeCode(value) {
    if (value == null) return "";
    if (typeof value === "object") {
        try {
            return JSON.stringify(value, null, 2);
        } catch (error) {
            return "";
        }
    }
    return String(value);
}

function insertCode(code) {
    if (!code) return;
    innerModel.value = innerModel.value ? innerModel.value + "\n" + code : code;
}

function show() {
    designerRef.value?.open({ tab: "v8", resetPreview: true });
}

defineExpose({
    show
});
</script>
