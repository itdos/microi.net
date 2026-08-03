<template>
    <el-dialog
        v-model="visible"
        align-center
        draggable
        destroy-on-close
        width="min(980px, calc(100vw - 32px))"
        :close-on-click-modal="false"
        :title="`访问密钥 - ${user?.Name || user?.Account || ''}`"
    >
        <UserAccessKeyPanel :user="user" />
    </el-dialog>
</template>

<script setup>
import { computed } from "vue";
import UserAccessKeyPanel from "./user-access-key-panel.vue";

const props = defineProps({
    modelValue: { type: Boolean, default: false },
    user: { type: Object, default: () => ({}) }
});
const emit = defineEmits(["update:modelValue"]);
const visible = computed({
    get: () => props.modelValue,
    set: (value) => emit("update:modelValue", value)
});
</script>
