<template>
    <transition name="api-service-fade">
        <section v-if="state.active" class="api-service-unavailable" role="alert" aria-live="assertive">
            <div class="api-service-unavailable__mesh" aria-hidden="true"></div>
            <div class="api-service-unavailable__shell">
                <div class="api-service-unavailable__visual">
                    <div class="api-service-unavailable__orbit api-service-unavailable__orbit--outer" aria-hidden="true"></div>
                    <div class="api-service-unavailable__orbit api-service-unavailable__orbit--inner" aria-hidden="true"></div>
                    <div class="api-service-unavailable__node api-service-unavailable__node--one" aria-hidden="true"></div>
                    <div class="api-service-unavailable__node api-service-unavailable__node--two" aria-hidden="true"></div>
                    <div class="api-service-unavailable__brand">
                        <div class="api-service-unavailable__icon">
                            <img
                                v-if="tenantLogoUrl && !logoLoadFailed"
                                :src="tenantLogoUrl"
                                :alt="`${tenantTitle} Logo`"
                                @error="logoLoadFailed = true"
                            />
                            <el-icon v-else aria-hidden="true"><Connection /></el-icon>
                        </div>
                        <strong>{{ tenantTitle }}</strong>
                        <span v-if="state.osClient">OsClient：{{ state.osClient }}</span>
                    </div>
                </div>

                <div class="api-service-unavailable__content" :class="{ 'is-security-blocked': isSecurity }">
                    <div class="api-service-unavailable__eyebrow">
                        <span class="api-service-unavailable__status-dot"></span>
                        {{ isSecurity ? "安全防护临时拦截" : "服务连接异常" }}
                    </div>
                    <h1>{{ isSecurity ? state.message : "后端 API 服务暂时不可用" }}</h1>
                    <p class="api-service-unavailable__summary">
                        <template v-if="isSecurity">
                            {{ state.reason || "当前出口 IP 的请求频率触发了平台安全阈值。" }}
                        </template>
                        <template v-else>
                            前端界面已正常启动，但当前无法与后端服务建立连接。请检查 API 服务、
                            反向代理、HTTPS 证书或跨域配置是否正常。
                        </template>
                    </p>

                    <dl v-if="isSecurity" class="api-service-unavailable__details is-security-details">
                        <div>
                            <dt>被拦截 IP</dt>
                            <dd>{{ state.ip || "-" }}</dd>
                        </div>
                        <div>
                            <dt>保护状态</dt>
                            <dd>{{ formatStateBackend(state.stateBackend) }}</dd>
                        </div>
                        <div>
                            <dt>请求方法</dt>
                            <dd>{{ state.requestMethod || "-" }}</dd>
                        </div>
                        <div>
                            <dt>当前租户</dt>
                            <dd>{{ tenantTitle }}（OsClient：{{ state.osClient || "未识别" }}）</dd>
                        </div>
                        <div>
                            <dt>当前站点</dt>
                            <dd>{{ state.clientOrigin || "-" }}</dd>
                        </div>
                        <div>
                            <dt>当前租户 ApiBase</dt>
                            <dd>{{ state.apiBase || "-" }}</dd>
                        </div>
                        <div class="api-service-unavailable__details-wide api-service-unavailable__request-url">
                            <dt>实际请求目标（完整地址）</dt>
                            <dd>{{ state.requestUrl || "-" }}</dd>
                        </div>
                        <div>
                            <dt>拦截开始时间</dt>
                            <dd>{{ formatUtc(state.blockedAtUtc) }}</dd>
                        </div>
                        <div>
                            <dt>自动解除时间</dt>
                            <dd>{{ formatUtc(state.expiresAtUtc) }}</dd>
                        </div>
                        <div>
                            <dt>剩余等待</dt>
                            <dd>{{ formatRetryAfter(state.retryAfterSeconds) }}</dd>
                        </div>
                        <div>
                            <dt>自动解除</dt>
                            <dd>{{ state.autoUnblock ? "是" : "否" }}</dd>
                        </div>
                        <div>
                            <dt>原因标识</dt>
                            <dd>{{ state.reasonKey || "-" }}</dd>
                        </div>
                        <div>
                            <dt>安全范围</dt>
                            <dd>{{ state.securityScope || "-" }}</dd>
                        </div>
                        <div class="api-service-unavailable__details-wide">
                            <dt>完整拦截原因</dt>
                            <dd>{{ state.reason || "-" }}</dd>
                        </div>
                    </dl>
                    <dl v-else class="api-service-unavailable__details">
                        <div>
                            <dt>ApiBase</dt>
                            <dd :title="state.apiBase">{{ state.apiBase || "-" }}</dd>
                        </div>
                        <div>
                            <dt>OsClient</dt>
                            <dd>{{ state.osClient || "-" }}</dd>
                        </div>
                        <div>
                            <dt>故障原因</dt>
                            <dd>{{ state.reason || "连接失败" }}</dd>
                        </div>
                        <div>
                            <dt>请求方法</dt>
                            <dd>{{ state.requestMethod || "-" }}</dd>
                        </div>
                        <div class="api-service-unavailable__details-wide">
                            <dt>实际请求目标（完整地址）</dt>
                            <dd>{{ state.requestUrl || "-" }}</dd>
                        </div>
                    </dl>

                    <div class="api-service-unavailable__actions">
                        <el-button
                            type="primary"
                            size="large"
                            :loading="state.checking"
                            @click="retry"
                        >
                            <el-icon><RefreshRight /></el-icon>
                            {{ isSecurity ? "检测是否已解除" : "重新连接" }}
                        </el-button>
                        <el-button v-if="isSecurity" size="large" @click="openDocumentation">
                            查看解除说明
                        </el-button>
                        <el-button size="large" @click="copyDiagnostic">
                            <el-icon><DocumentCopy /></el-icon>
                            复制诊断信息
                        </el-button>
                    </div>

                    <div class="api-service-unavailable__hint">
                        <el-icon><Monitor /></el-icon>
                        <span v-if="isSecurity">
                            {{ state.unblockAdvice || "到期后会自动解除；需立即解除时请联系平台超级管理员。" }}
                        </span>
                        <span v-else>服务恢复后刷新页面即可继续使用，当前页面不会提交任何业务数据。</span>
                    </div>
                </div>
            </div>
        </section>
    </transition>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { Connection, DocumentCopy, Monitor, RefreshRight } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { useDiyStore } from "@/pinia";
import { resolveLoginSystemLogoUrl } from "@/utils/login-branding.js";
import {
    apiServiceState as state,
    checkApiServiceNow,
    getApiServiceDiagnostic,
} from "@/utils/api-service-status.js";

const diyStore = useDiyStore();
const logoLoadFailed = ref(false);
const isSecurity = computed(function () {
    return state.mode === "security";
});
const tenantTitle = computed(function () {
    return diyStore.SysConfig?.SysTitle || diyStore.WebTitle || "Microi 吾码";
});
const tenantLogoUrl = computed(function () {
    return resolveLoginSystemLogoUrl(diyStore.SysConfig?.SysLogo, function (path) {
        const fileServer = String(diyStore.FileServer || diyStore.SysConfig?.FileServer || "").replace(/\/+$/, "");
        return fileServer ? `${fileServer}${path}` : path;
    });
});

watch(tenantLogoUrl, function () {
    logoLoadFailed.value = false;
});

function formatUtc(value) {
    if (!value) return "等待后端返回";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatStateBackend(value) {
    if (value === "SharedRedis") return "共享 Redis（跨节点）";
    if (value === "ProcessFallback") return "本节点安全降级";
    return value || "-";
}

function formatRetryAfter(value) {
    const seconds = Number(value || 0);
    if (!seconds) return "-";
    if (seconds < 60) return `${seconds} 秒`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds ? `${minutes} 分 ${remainingSeconds} 秒` : `${minutes} 分钟`;
}

async function retry() {
    const reachable = await checkApiServiceNow();
    if (reachable) {
        window.location.reload();
        return;
    }
    ElMessage.warning(isSecurity.value
        ? "当前 IP 仍在临时拦截期，请等待自动解除或联系平台超级管理员"
        : "后端 API 服务仍不可用，请稍后重试");
}

function openDocumentation() {
    window.open(state.documentationUrl || "https://microi.net/doc/more/security", "_blank", "noopener,noreferrer");
}

async function copyDiagnostic() {
    const text = getApiServiceDiagnostic();
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
        } else {
            const textarea = document.createElement("textarea");
            textarea.value = text;
            textarea.style.position = "fixed";
            textarea.style.opacity = "0";
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand("copy");
            textarea.remove();
        }
        ElMessage.success("诊断信息已复制");
    } catch (error) {
        ElMessage.warning("复制失败，请手动记录页面中的诊断信息");
    }
}
</script>

<style scoped lang="scss">
.api-service-unavailable {
    position: fixed;
    z-index: 32000;
    inset: 0;
    display: grid;
    place-items: start center;
    overflow: auto;
    padding: 40px;
    color: #162033;
    background: #f2f6fa;
}

.api-service-unavailable__mesh {
    position: absolute;
    inset: 0;
    opacity: 0.42;
    background-image:
        linear-gradient(rgba(29, 124, 140, 0.08) 1px, transparent 1px),
        linear-gradient(90deg, rgba(29, 124, 140, 0.08) 1px, transparent 1px);
    background-size: 48px 48px;
    mask-image: radial-gradient(circle at center, #000 0, transparent 72%);
}

.api-service-unavailable__shell {
    position: relative;
    display: grid;
    grid-template-columns: 310px minmax(0, 850px);
    width: min(1160px, 100%);
    min-height: 600px;
    overflow: hidden;
    border: 1px solid rgba(30, 76, 92, 0.12);
    border-radius: 8px;
    background: #fff;
    box-shadow: 0 24px 70px rgba(29, 53, 67, 0.16);
}

.api-service-unavailable__visual {
    position: relative;
    display: grid;
    place-items: center;
    overflow: hidden;
    background: #082f3d;
}

.api-service-unavailable__visual::before,
.api-service-unavailable__visual::after {
    position: absolute;
    width: 220px;
    height: 1px;
    content: "";
    background: rgba(108, 231, 222, 0.3);
}

.api-service-unavailable__visual::before {
    transform: rotate(36deg);
}

.api-service-unavailable__visual::after {
    transform: rotate(-36deg);
}

.api-service-unavailable__orbit {
    position: absolute;
    border: 1px solid rgba(108, 231, 222, 0.28);
    border-radius: 50%;
    animation: api-service-pulse 3.2s ease-in-out infinite;
}

.api-service-unavailable__orbit--outer {
    width: 236px;
    height: 236px;
}

.api-service-unavailable__orbit--inner {
    width: 154px;
    height: 154px;
    animation-delay: -1.1s;
}

.api-service-unavailable__icon {
    position: relative;
    z-index: 2;
    display: grid;
    width: 116px;
    height: 116px;
    place-items: center;
    border: 1px solid rgba(255, 255, 255, 0.28);
    border-radius: 50%;
    color: #fff;
    background: #fff;
    box-shadow: 0 0 0 12px rgba(217, 87, 53, 0.12), 0 18px 40px rgba(0, 0, 0, 0.22);
}

.api-service-unavailable__icon .el-icon {
    color: #d95735;
    font-size: 44px;
}

.api-service-unavailable__icon img {
    display: block;
    width: 82%;
    height: 82%;
    object-fit: contain;
}

.api-service-unavailable__brand {
    position: relative;
    z-index: 4;
    display: flex;
    max-width: 250px;
    align-items: center;
    flex-direction: column;
    color: #fff;
    text-align: center;
}

.api-service-unavailable__brand strong {
    margin-top: 28px;
    font-size: 21px;
    line-height: 1.45;
    overflow-wrap: anywhere;
}

.api-service-unavailable__brand span {
    margin-top: 8px;
    color: rgba(255, 255, 255, 0.68);
    font-size: 12px;
    overflow-wrap: anywhere;
}

.api-service-unavailable__node {
    position: absolute;
    z-index: 3;
    width: 10px;
    height: 10px;
    border: 2px solid #082f3d;
    border-radius: 50%;
    background: #73e3d9;
    box-shadow: 0 0 18px rgba(115, 227, 217, 0.9);
}

.api-service-unavailable__node--one {
    top: 112px;
    left: 70px;
}

.api-service-unavailable__node--two {
    right: 60px;
    bottom: 118px;
    animation: api-service-node 2.6s ease-in-out infinite;
}

.api-service-unavailable__content {
    display: flex;
    min-width: 0;
    flex-direction: column;
    justify-content: center;
    padding: 42px 48px;
}

.api-service-unavailable__eyebrow {
    display: flex;
    align-items: center;
    margin-bottom: 14px;
    color: #1b7b88;
    font-size: 13px;
    font-weight: 700;
}

.api-service-unavailable__status-dot {
    width: 8px;
    height: 8px;
    margin-right: 8px;
    border-radius: 50%;
    background: #d95735;
    box-shadow: 0 0 0 5px rgba(217, 87, 53, 0.12);
}

.api-service-unavailable h1 {
    margin: 0;
    color: #162033;
    font-size: 30px;
    line-height: 1.25;
    letter-spacing: 0;
}

.api-service-unavailable__summary {
    max-width: 570px;
    margin: 18px 0 26px;
    color: #667085;
    font-size: 15px;
    line-height: 1.8;
}

.api-service-unavailable__details {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    margin: 0;
    border-top: 1px solid #e7edf2;
    border-left: 1px solid #e7edf2;
}

.api-service-unavailable__details.is-security-details {
    grid-template-columns: repeat(3, minmax(0, 1fr));
}

.api-service-unavailable__details > div {
    min-width: 0;
    padding: 14px 16px;
    border-right: 1px solid #e7edf2;
    border-bottom: 1px solid #e7edf2;
}

.api-service-unavailable__details dt {
    margin-bottom: 6px;
    color: #98a2b3;
    font-size: 12px;
}

.api-service-unavailable__details dd {
    margin: 0;
    color: #344054;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.55;
    overflow-wrap: anywhere;
    white-space: normal;
    word-break: break-word;
}

.api-service-unavailable__details-wide {
    grid-column: 1 / -1;
}

.api-service-unavailable__request-url dd {
    color: #175f70;
    font-family: Consolas, "SFMono-Regular", "Liberation Mono", monospace;
    font-size: 13px;
}

.api-service-unavailable__content.is-security-blocked h1 {
    font-size: 26px;
}

.api-service-unavailable__actions {
    display: flex;
    gap: 12px;
    margin-top: 26px;
}

.api-service-unavailable__actions .el-button {
    min-width: 132px;
    border-radius: 6px;
}

.api-service-unavailable__actions .el-button + .el-button {
    margin-left: 0;
}

.api-service-unavailable__hint {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 20px;
    color: #98a2b3;
    font-size: 12px;
}

.api-service-unavailable__hint span {
    overflow-wrap: anywhere;
}

.api-service-fade-enter-active,
.api-service-fade-leave-active {
    transition: opacity 0.22s ease;
}

.api-service-fade-enter-from,
.api-service-fade-leave-to {
    opacity: 0;
}

@keyframes api-service-pulse {
    0%,
    100% {
        opacity: 0.36;
        transform: scale(0.94);
    }
    50% {
        opacity: 1;
        transform: scale(1.04);
    }
}

@keyframes api-service-node {
    0%,
    100% {
        opacity: 0.45;
        transform: scale(0.8);
    }
    50% {
        opacity: 1;
        transform: scale(1.2);
    }
}

@media (max-width: 760px) {
    .api-service-unavailable {
        align-items: start;
        padding: 18px;
    }

    .api-service-unavailable__shell {
        grid-template-columns: 1fr;
        min-height: 0;
    }

    .api-service-unavailable__visual {
        min-height: 190px;
    }

    .api-service-unavailable__orbit--outer {
        width: 170px;
        height: 170px;
    }

    .api-service-unavailable__orbit--inner {
        width: 112px;
        height: 112px;
    }

    .api-service-unavailable__icon {
        width: 82px;
        height: 82px;
    }

    .api-service-unavailable__icon .el-icon {
        font-size: 34px;
    }

    .api-service-unavailable__content {
        padding: 30px 24px;
    }

    .api-service-unavailable__brand strong {
        margin-top: 18px;
        font-size: 18px;
    }

    .api-service-unavailable h1 {
        font-size: 24px;
    }

    .api-service-unavailable__details {
        grid-template-columns: 1fr;
    }

    .api-service-unavailable__details.is-security-details {
        grid-template-columns: 1fr;
    }

    .api-service-unavailable__actions {
        align-items: stretch;
        flex-direction: column;
    }

    .api-service-unavailable__actions .el-button {
        width: 100%;
    }
}

@media (prefers-reduced-motion: reduce) {
    .api-service-unavailable__orbit,
    .api-service-unavailable__node {
        animation: none;
    }
}
</style>
