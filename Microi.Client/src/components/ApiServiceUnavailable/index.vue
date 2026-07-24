<template>
    <transition name="api-service-fade">
        <section v-if="state.active" class="api-service-unavailable" role="alert" aria-live="assertive">
            <div class="api-service-unavailable__mesh" aria-hidden="true"></div>
            <div class="api-service-unavailable__shell">
                <div class="api-service-unavailable__visual" aria-hidden="true">
                    <div class="api-service-unavailable__orbit api-service-unavailable__orbit--outer"></div>
                    <div class="api-service-unavailable__orbit api-service-unavailable__orbit--inner"></div>
                    <div class="api-service-unavailable__node api-service-unavailable__node--one"></div>
                    <div class="api-service-unavailable__node api-service-unavailable__node--two"></div>
                    <div class="api-service-unavailable__icon">
                        <el-icon><Connection /></el-icon>
                    </div>
                </div>

                <div class="api-service-unavailable__content">
                    <div class="api-service-unavailable__eyebrow">
                        <span class="api-service-unavailable__status-dot"></span>
                        服务连接异常
                    </div>
                    <h1>后端 API 服务暂时不可用</h1>
                    <p class="api-service-unavailable__summary">
                        前端界面已正常启动，但当前无法与后端服务建立连接。请检查 API 服务、
                        反向代理、HTTPS 证书或跨域配置是否正常。
                    </p>

                    <dl class="api-service-unavailable__details">
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
                            <dt>请求位置</dt>
                            <dd :title="state.requestPath">{{ state.requestPath || "-" }}</dd>
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
                            重新连接
                        </el-button>
                        <el-button size="large" @click="copyDiagnostic">
                            <el-icon><DocumentCopy /></el-icon>
                            复制诊断信息
                        </el-button>
                    </div>

                    <div class="api-service-unavailable__hint">
                        <el-icon><Monitor /></el-icon>
                        <span>服务恢复后刷新页面即可继续使用，当前页面不会提交任何业务数据。</span>
                    </div>
                </div>
            </div>
        </section>
    </transition>
</template>

<script setup>
import { Connection, DocumentCopy, Monitor, RefreshRight } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import {
    apiServiceState as state,
    checkApiServiceNow,
    getApiServiceDiagnostic,
} from "@/utils/api-service-status.js";

async function retry() {
    const reachable = await checkApiServiceNow();
    if (reachable) {
        window.location.reload();
        return;
    }
    ElMessage.warning("后端 API 服务仍不可用，请稍后重试");
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
    place-items: center;
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
    grid-template-columns: 300px minmax(0, 640px);
    width: min(1040px, 100%);
    min-height: 520px;
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
    width: 92px;
    height: 92px;
    place-items: center;
    border: 1px solid rgba(255, 255, 255, 0.28);
    border-radius: 50%;
    color: #fff;
    background: #d95735;
    box-shadow: 0 0 0 12px rgba(217, 87, 53, 0.12), 0 18px 40px rgba(0, 0, 0, 0.22);
}

.api-service-unavailable__icon .el-icon {
    font-size: 44px;
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
    padding: 54px 58px;
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
    overflow: hidden;
    margin: 0;
    color: #344054;
    font-size: 14px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
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
        width: 70px;
        height: 70px;
    }

    .api-service-unavailable__icon .el-icon {
        font-size: 34px;
    }

    .api-service-unavailable__content {
        padding: 30px 24px;
    }

    .api-service-unavailable h1 {
        font-size: 24px;
    }

    .api-service-unavailable__details {
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
