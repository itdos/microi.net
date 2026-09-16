<template>
    <div class="ai-connection-entry">
        <button type="button" class="runtime-version-button" data-testid="runtime-version" @click="visible = true">{{ text }}</button>
        <button v-if="!hideEdition" type="button" class="runtime-version-button platform-edition-button" data-testid="platform-edition" @click="router.push('/license')">{{ edition || '授权版本' }}</button>
    </div>
    <el-dialog v-model="visible" title="开发工具连接" width="min(760px, 92vw)" class="ai-connection-dialog" append-to-body draggable destroy-on-close>
        <div class="ai-connection-details">
            <div><span>ApiBase</span><code>{{ apiBase }}</code></div>
            <div><span>OsClient</span><code>{{ osClient }}</code></div>
        </div>
        <p class="ai-connection-intro">将下面这段说明复制给 Codex、WorkBuddy 等 AI 工具，即可安装 CLI 并初始化 MCP 和工作区 AI 配置。</p>
        <pre class="ai-connection-prompt">{{ promptPreview }}</pre>
        <p class="ai-connection-note">复制时生成独立开发工具 Token，权限与当前账号一致，按服务器的开发终端期限有效。可在在线终端中单独踢下线；账号密码无需提供给 AI。</p>
        <template #footer>
            <el-button @click="visible = false">关闭</el-button>
            <el-button type="primary" :loading="copying" @click="copyConnection">一键复制给 AI</el-button>
        </template>
    </el-dialog>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useDiyStore } from '@/pinia/modules/diy';
import { ElMessage } from 'element-plus';
import { DiyCommon } from '@/utils/diy.common';
import { buildAiConnectionPrompt, copyConnectionText } from '@/utils/ai-connection.js';
import { platformEditionLabel, hideSystemLicenseVersion } from '@/utils/platform-edition.js';
defineProps({ text: { type: String, required: true } });
const visible = ref(false), copying = ref(false), sessionEdition = ref('');
const diyStore = useDiyStore(), router = useRouter();
const edition = computed(() => platformEditionLabel(diyStore.SysConfig?.PlatformEdition) || sessionEdition.value);
const hideEdition = computed(() => hideSystemLicenseVersion(diyStore.SysConfig));
let editionRetry, editionAttempts = 0, disposed = false;
const apiBase = computed(() => DiyCommon.GetApiBase());
const osClient = computed(() => DiyCommon.GetOsClient());
const promptPreview = computed(() => buildAiConnectionPrompt({ ApiBase: apiBase.value, OsClient: osClient.value, Token: '<复制时生成的独立 Token>' }));
async function sessionAction(Action) {
    const response = await DiyCommon.Http.Post({ Url: '/apiengine/platform-sys-user-session', PostParam: { Action } });
    if (typeof response !== 'string') return response;
    try { return JSON.parse(response); } catch { throw new Error('平台返回格式无效，请重试。'); }
}
async function loadEdition() {
    if (disposed || platformEditionLabel(diyStore.SysConfig?.PlatformEdition)) return;
    editionAttempts++;
    try {
        const result = await sessionAction('GetConnectionInfo');
        if (!disposed && result?.Code === 1 && result.Data) sessionEdition.value = platformEditionLabel(result.Data.ProductType);
    } catch { /* 版本查询失败不影响业务页面。 */ }
    // 旧后端短暂失败时有界重试，不能永久消失或把未知授权冒充开源版。
    if (!disposed && !edition.value && editionAttempts < 3) editionRetry = setTimeout(loadEdition, editionAttempts * 3000);
}
onMounted(loadEdition);
onBeforeUnmount(() => { disposed = true; clearTimeout(editionRetry); });
async function copyConnection() {
    if (copying.value) return;
    copying.value = true;
    try {
        const result = await sessionAction('CreateCliSession');
        if (result?.Code !== 1 || !result.Data?.Token) throw new Error(result?.Msg || '请更新平台与 SaaS 应用后重试。');
        await copyConnectionText(buildAiConnectionPrompt({ ApiBase: apiBase.value, OsClient: osClient.value, Token: result.Data.Token, Did: result.Data.Did }));
        ElMessage.success('已复制，可粘贴给 AI。此开发工具会话可单独撤销。');
    } catch (error) { ElMessage.error(error.message || '复制失败，请重试。'); }
    finally { copying.value = false; }
}
</script>

<style scoped>
.ai-connection-entry { display:flex; align-items:center; gap:6px; flex:none; margin:0 18px 0 12px; }
.runtime-version-button { cursor:pointer; color:var(--el-color-primary); border:1px solid var(--el-color-primary-light-7); border-radius:999px; background:var(--el-color-primary-light-9); font:inherit; font-size:11px; padding:2px 9px; white-space:nowrap; }
.runtime-version-button:hover { background:var(--el-color-primary-light-8); }
.runtime-version-button:focus-visible { outline:2px solid var(--el-color-primary); outline-offset:3px; }
.ai-connection-details { display:grid; grid-template-columns:2fr 1fr; gap:12px; }
.ai-connection-details>div { padding:14px 16px; border-radius:14px; background:var(--el-fill-color-light); min-width:0; }
.ai-connection-details span { display:block; color:var(--el-text-color-secondary); margin-bottom:6px; font-size:12px; }
.ai-connection-details code { overflow-wrap:anywhere; color:var(--el-text-color-primary); }
.ai-connection-intro { line-height:1.8; margin:20px 0 12px; }
.ai-connection-prompt { white-space:pre-wrap; overflow-wrap:anywhere; padding:18px; border:1px solid var(--el-border-color-light); border-radius:16px; line-height:1.8; font:inherit; background:var(--el-fill-color-lighter); }
.ai-connection-note { color:var(--el-text-color-secondary); font-size:12px; line-height:1.8; }
</style>
<style>
.el-dialog.ai-connection-dialog { border-radius:24px; padding:24px; }
</style>
