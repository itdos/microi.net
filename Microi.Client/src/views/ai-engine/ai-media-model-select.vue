<template>
    <div class="mci-media-model" :data-testid="`ai-${capability}-model-picker`">
        <div class="mci-media-model__label"><span>{{ { image: '图片', music: '音乐', video: '视频', speech: '配音' }[capability] }}引擎与模型</span><button type="button" :disabled="loading || disabled" @click="refresh(true)">刷新模型</button></div>
        <el-select :model-value="modelValue?.key || ''" :loading="loading" :disabled="disabled || loading" filterable placeholder="选择支持此功能的模型" :aria-label="`${capability} AI 引擎与模型`" @change="choose">
            <el-option v-for="item in options" :key="item.key" :value="item.key" :label="item.label" />
        </el-select>
        <small v-if="error" class="mci-media-model__error" role="alert">{{ error }}</small>
        <small v-else-if="!loading && !options.length" role="status">{{ requiresImageEditing(imageOperation) ? '当前中转站没有支持此编辑操作的模型。请在 AI 引擎中配置图像编辑模型；人物参考重绘不适用于此操作。' : 'AI 引擎中暂无已启用的对应媒体模型，请先配置。' }}</small>
        <small v-else-if="modelValue?.ReferenceMode === 'character-redraw'">人物参考重绘：适合创意再生成；局部编辑可能改变原图细节。</small>
        <small v-else-if="modelValue?.ModelIdentity === 'provider-tool'">MiniMax Code 图像编辑工具，支持原图编辑；供应商未公开底层图像模型名称。</small>
        <div v-for="engine in connections" :key="engine.AiModelId" class="mci-media-model__connection">
            <span>{{ engine.Name }} · {{ engine.AuthorizationStatus === 'Connected' ? '已连接' : '需要独立授权' }}</span>
            <el-button size="small" :disabled="disabled" @click="connect(engine)">{{ engine.AuthorizationStatus === 'Connected' ? '重新连接' : '连接账户' }}</el-button>
        </div>
        <el-dialog v-model="authorizationVisible" title="连接 MiniMax Code" width="420px" append-to-body @closed="stopPolling">
            <p>在 MiniMax 官方页面确认下方代码，授权仅用于当前 AI 引擎。桌面客户端登录态保持独立。</p>
            <p v-if="authorization.UserCode" class="mci-media-model__code">{{ authorization.UserCode }}</p>
            <a v-if="authorization.VerificationUrl" :href="authorization.VerificationUrl" target="_blank" rel="noopener noreferrer">打开官方授权页面</a>
            <p role="status">{{ authorizationMessage }}</p>
        </el-dialog>
    </div>
</template>
<script setup>
import { getCurrentInstance, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { useDiyStore } from '@/pinia';
import { loadMediaModels, mediaModelOptions, selectMediaModel, requiresImageEditing } from './media-models.js';
const props = defineProps({ modelValue: Object, capability: { type: String, required: true }, disabled: Boolean, engineId: String, imageOperation: String });
const emit = defineEmits(['update:modelValue']);
const { proxy } = getCurrentInstance();
const store = useDiyStore();
const options = ref([]), loading = ref(false), error = ref('');
const connections = ref([]), authorizationVisible = ref(false), authorization = ref({}), authorizationMessage = ref('');
let pollTimer, connectionGeneration = 0;
function stopPolling() { connectionGeneration++; clearTimeout(pollTimer); }
async function authorizationRequest(action, body) {
    const diy = proxy.DiyCommon;
    const token = diy.getToken();
    const response = await fetch(`${diy.GetApiBase()}/api/Ai/${action}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', authorization: token ? `Bearer ${token}` : '',
            did: diy.GetDiyTokenHeaderDId?.() || 'MicroiMedia', OsClient: diy.GetOsClient() },
        body: JSON.stringify(body), signal: AbortSignal.timeout(30000)
    });
    diy.ApplyAuthorizationToken?.(response.headers.get('authorization'), token);
    const result = await response.json();
    if (!response.ok || Number(result.Code) !== 1) throw new Error(result.Msg || '媒体授权失败');
    return result.Data;
}
async function connect(engine) {
    stopPolling(); const generation = connectionGeneration;
    authorization.value = {}; authorizationMessage.value = '正在申请授权…'; authorizationVisible.value = true;
    try {
        const data = await authorizationRequest('BeginMediaOAuth', { AiModelId: engine.AiModelId });
        if (generation !== connectionGeneration) return;
        authorization.value = data; authorizationMessage.value = '等待官方页面确认，完成后会自动刷新连接。';
        const deadline = Date.now() + data.ExpiresIn * 1000;
        const poll = async () => {
            if (generation !== connectionGeneration) return;
            if (Date.now() > deadline) { authorizationMessage.value = '授权已过期，请关闭后重新连接。'; return; }
            try {
                const result = await authorizationRequest('PollMediaOAuth', { SessionId: data.SessionId });
                if (generation !== connectionGeneration) return;
                if (result.Status === 'Connected') { authorizationMessage.value = '连接成功'; await refresh(true); return; }
                pollTimer = setTimeout(poll, Math.max(5, data.Interval || 5) * 1000);
            } catch (e) { authorizationMessage.value = e.message; }
        };
        pollTimer = setTimeout(poll, Math.max(5, data.Interval || 5) * 1000);
    } catch (e) { authorizationMessage.value = e.message; }
}
async function refresh(force = false) {
    loading.value = true; error.value = '';
    try {
        const catalog = await loadMediaModels(proxy.DiyCommon, store.GetCurrentUser?.Id || '', force);
        const engines = props.engineId ? catalog.filter(x => x.AiModelId === props.engineId) : catalog;
        connections.value = engines.filter(x => x.CanConnectOAuth && Number(store.GetCurrentUser?.Level) >= 9999);
        options.value = mediaModelOptions(engines, props.capability, props.imageOperation);
        error.value = engines.filter(x => x.Error).map(x => `${x.Name}：${x.Error}`).join('；');
        // 已选中转站暂时不可用时保留空选项，禁止悄悄改用另一条直连账号。
        emit('update:modelValue', selectMediaModel(options.value, props.modelValue, engines.some(x => x.IsGateway)));
    } catch (e) { error.value = e.message; options.value = []; emit('update:modelValue', null); }
    finally { loading.value = false; }
}
function choose(key) { emit('update:modelValue', options.value.find(x => x.key === key) || null); }
onMounted(() => refresh());
onBeforeUnmount(stopPolling);
watch(() => [props.capability, props.engineId, props.imageOperation], () => refresh());
</script>
<style scoped>
.mci-media-model { display: flex; flex-direction: column; gap: 8px; min-width: 0; margin: 16px 0; }
.mci-media-model__label { display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: var(--el-text-color-primary); font-weight: 600; }
.mci-media-model__label button { padding: 3px 0; border: 0; background: transparent; color: var(--el-color-primary); font: inherit; font-weight: 400; cursor: pointer; }
.mci-media-model :deep(.el-select) { width: 100%; }.mci-media-model small { font-size: 11px; line-height: 1.6; color: var(--el-text-color-secondary); }
.mci-media-model .mci-media-model__error { color: var(--el-color-danger); }
.mci-media-model__connection { display: flex; gap: 8px; align-items: center; justify-content: space-between; font-size: 12px; }
.mci-media-model__code { font-size: 28px; letter-spacing: 3px; font-weight: 700; text-align: center; }
</style>
