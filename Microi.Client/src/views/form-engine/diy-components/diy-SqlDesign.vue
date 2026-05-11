<template>
    <div class="diy-sql-design-compat">
        <el-button style="margin-bottom: 10px" type="primary" @click="show">SQL/V8代码设计器</el-button>
        <DiyCodeDesign
            ref="designerRef"
            v-model:model="innerModel"
            default-tab="sql"
            @insert-code="insertCode"
        />
    </div>
</template>

<script setup>
import { ref, watch } from "vue";
import DiyCodeDesign from "./diy-code-design.vue";

defineOptions({
    name: "DiySqlDesign"
});

const props = defineProps({
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
    designerRef.value?.open({ tab: "sql", resetPreview: true });
}

defineExpose({
    show
});
</script>
