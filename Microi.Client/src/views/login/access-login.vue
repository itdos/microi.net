<template>
    <main class="access-login-page">
        <span class="access-login-orb orb-one" aria-hidden="true"></span>
        <span class="access-login-orb orb-two" aria-hidden="true"></span>

        <section class="access-login-panel" role="status" aria-live="polite">
            <header class="access-login-brand">
                <span class="brand-mark">M</span>
                <span class="brand-name">Microi 吾码</span>
                <span class="brand-badge">安全访问</span>
            </header>

            <div class="access-login-icon" :class="state">
                <el-icon v-if="state === 'loading'" class="is-loading"><Loading /></el-icon>
                <el-icon v-else-if="state === 'error'"><WarningFilled /></el-icon>
                <el-icon v-else><CircleCheckFilled /></el-icon>
            </div>

            <p class="access-login-eyebrow">{{ eyebrow }}</p>
            <h1>{{ title }}</h1>
            <p class="access-login-message">{{ message }}</p>

            <div v-if="state !== 'error'" class="access-login-steps">
                <div
                    v-for="(item, index) in steps"
                    :key="item"
                    class="access-login-step"
                    :class="{ done: phase > index + 1, active: phase === index + 1 }"
                >
                    <span class="step-dot">
                        <el-icon v-if="phase > index + 1"><CircleCheckFilled /></el-icon>
                        <span v-else>{{ index + 1 }}</span>
                    </span>
                    <span>{{ item }}</span>
                </div>
            </div>

            <div v-if="state === 'success' && accountLabel" class="access-login-account">
                <span>已授权身份</span>
                <strong>{{ accountLabel }}</strong>
            </div>

            <div class="access-login-security-note">
                <span class="security-dot"></span>
                密钥已从地址栏移除，不会保存在页面历史中
            </div>

            <el-button v-if="state === 'error'" type="primary" round @click="goToLogin">
                返回登录页
            </el-button>
        </section>

        <p class="access-login-footer">由访问密钥授权 · 权限不会超过所属帐号</p>
    </main>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { CircleCheckFilled, Loading, WarningFilled } from "@element-plus/icons-vue";
import { useDiyStore, useUserStore } from "@/pinia";
import { DiyCommon } from "@/utils/microi.net.import";
import {
    isAccessRouteAllowed,
    isWildcardAccessScope,
    normalizeAccessRoute
} from "@/views/system/components/user-access-key-utils";

const route = useRoute();
const router = useRouter();
const diyStore = useDiyStore();
const userStore = useUserStore();
const state = ref("loading");
const phase = ref(1);
const accountLabel = ref("");
const message = ref("正在建立加密连接，请稍候…");
const steps = ["建立安全连接", "验证密钥与权限", "打开授权页面"];
const title = computed(() => state.value === "error"
    ? "无法完成自动登录"
    : state.value === "success"
        ? "授权登录成功"
        : "正在为您自动登录");
const eyebrow = computed(() => state.value === "error"
    ? "验证未通过"
    : state.value === "success"
        ? "安全会话已建立"
        : "无需输入帐号密码");

function scrubAccessKeyFromAddressBar() {
    try {
        const rawHash = window.location.hash || "";
        const queryIndex = rawHash.indexOf("?");
        if (queryIndex < 0) return;
        const hashPath = rawHash.substring(0, queryIndex);
        const hashQuery = new URLSearchParams(rawHash.substring(queryIndex + 1));
        hashQuery.delete("access_key");
        hashQuery.delete("secret");
        const nextHash = hashPath + (hashQuery.toString() ? "?" + hashQuery.toString() : "");
        window.history.replaceState(
            window.history.state,
            document.title,
            window.location.pathname + window.location.search + nextHash
        );
    } catch (_) {
        // Address-bar cleanup is best-effort; the credential is never persisted by the app.
    }
}

function endAuthTransition() {
    if (typeof DiyCommon.EndAuthTransition === "function") {
        DiyCommon.EndAuthTransition();
    }
}

function showError(errorMessage) {
    endAuthTransition();
    state.value = "error";
    message.value = errorMessage || "访问密钥验证失败，请联系管理员。";
}

async function goToLogin() {
    endAuthTransition();
    await router.replace("/login");
}

onMounted(async () => {
    const accessKey = String(route.query.access_key || route.query.secret || "").trim();
    const requestedRedirect = normalizeAccessRoute(route.query.redirect);
    scrubAccessKeyFromAddressBar();
    if (!accessKey) {
        showError("链接中没有可用的访问密钥。");
        return;
    }

    const osClient = String(
        DiyCommon.GetOsClient()
        || new URLSearchParams(window.location.search).get("OsClient")
        || ""
    ).trim();
    if (!osClient) {
        showError("自动登录链接缺少 OsClient 租户参数，请重新生成链接。");
        return;
    }

    if (typeof DiyCommon.BeginAuthTransition === "function") {
        DiyCommon.BeginAuthTransition();
    }

    try {
        phase.value = 2;
        message.value = "正在验证访问密钥与帐号现有权限…";
        const result = await DiyCommon.PostAsync({
            url: "/api/SysUserAccessKey/Exchange",
            data: {
                AccessKey: accessKey,
                OsClient: osClient
            },
            dataType: "json",
            skipAuthorization: true,
            suppressAuthFailure: true,
            suppressErrorNotification: true,
            timeout: 20000
        });
        if (result?.Code !== 1 || !result.Data) {
            showError(result?.Msg || "访问密钥无效、已过期或已被吊销。");
            return;
        }

        diyStore.setState("SystemStyle", "Classic");
        diyStore.setCurrentUser(result.Data);
        userStore.setRoles(["access-key"]);
        const allowedRoutes = Array.isArray(result.Data._AccessKeyAllowedRoutes)
            ? result.Data._AccessKeyAllowedRoutes.map(normalizeAccessRoute).filter(Boolean)
            : [];
        const serverRedirect = normalizeAccessRoute(result.DataAppend?.RedirectPath);
        const allowAllPages = isWildcardAccessScope(allowedRoutes);
        const destination = requestedRedirect && isAccessRouteAllowed(allowedRoutes, requestedRedirect)
            ? requestedRedirect
            : serverRedirect || (allowAllPages ? "/" : allowedRoutes[0]);
        if (!destination) {
            showError("该访问密钥没有配置可访问页面。");
            return;
        }

        phase.value = 3;
        state.value = "success";
        accountLabel.value = String(result.Data.Name || result.Data.Account || "已授权帐号");
        message.value = "验证完成，即将进入已授权页面…";

        // Keep the success panel visible long enough to provide clear feedback
        // on kiosk/TV screens instead of flashing directly into the destination.
        await new Promise((resolve) => window.setTimeout(resolve, 900));
        await router.replace(destination);
        endAuthTransition();
    } catch (error) {
        const isTimeout = String(error?.message || "").toLowerCase().includes("timeout");
        showError(isTimeout
            ? "访问密钥验证超时，请检查 API 服务后重试。"
            : error?.message || "访问密钥验证失败，请联系管理员。");
    }
});
</script>

<style scoped>
.access-login-page {
    position: relative;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    padding: 28px 20px;
    background:
        radial-gradient(circle at 18% 18%, rgba(40, 191, 143, 0.14), transparent 34%),
        radial-gradient(circle at 84% 78%, rgba(56, 117, 246, 0.16), transparent 36%),
        linear-gradient(145deg, #f5fbf9 0%, #eef4ff 52%, #f8faff 100%);
}

.access-login-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(2px);
    pointer-events: none;
}

.orb-one {
    width: 210px;
    height: 210px;
    top: -82px;
    right: 9%;
    background: rgba(51, 196, 151, 0.12);
}

.orb-two {
    width: 280px;
    height: 280px;
    bottom: -150px;
    left: 4%;
    background: rgba(63, 111, 238, 0.11);
}

.access-login-panel {
    position: relative;
    z-index: 1;
    width: min(520px, 100%);
    box-sizing: border-box;
    padding: 30px 36px 28px;
    text-align: center;
    border: 1px solid rgba(255, 255, 255, 0.9);
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.94);
    box-shadow: 0 22px 70px rgba(35, 58, 103, 0.16);
    backdrop-filter: blur(16px);
}

.access-login-brand {
    display: flex;
    align-items: center;
    gap: 9px;
    margin-bottom: 26px;
    color: #26354a;
}

.brand-mark {
    display: inline-flex;
    width: 30px;
    height: 30px;
    align-items: center;
    justify-content: center;
    border-radius: 9px;
    color: #fff;
    font-size: 16px;
    font-weight: 800;
    background: linear-gradient(135deg, #23b887, #3975ef);
    box-shadow: 0 6px 18px rgba(43, 158, 151, 0.24);
}

.brand-name {
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 0.02em;
}

.brand-badge {
    margin-left: auto;
    padding: 5px 10px;
    border: 1px solid #d8e8e3;
    border-radius: 999px;
    color: #29866a;
    font-size: 12px;
    background: #f1fbf7;
}

.access-login-icon {
    display: inline-flex;
    width: 74px;
    height: 74px;
    align-items: center;
    justify-content: center;
    margin: 2px auto 18px;
    border-radius: 24px;
    color: #3673ed;
    font-size: 38px;
    background: #eef4ff;
    box-shadow: inset 0 0 0 1px rgba(54, 115, 237, 0.08);
}

.access-login-icon.success {
    color: #1ca875;
    background: #ebfaf4;
}

.access-login-icon.error {
    color: var(--el-color-danger);
    background: #fff1f0;
}

.access-login-eyebrow {
    margin: 0 0 7px;
    color: #2f72e8;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.08em;
}

h1 {
    margin: 0;
    color: #1f2d3d;
    font-size: clamp(25px, 4vw, 31px);
    line-height: 1.3;
}

.access-login-message {
    margin: 12px 0 24px;
    color: #6f7f93;
    font-size: 15px;
    line-height: 1.7;
}

.access-login-steps {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin: 0 0 22px;
}

.access-login-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    min-width: 0;
    color: #9aa6b6;
    font-size: 12px;
}

.step-dot {
    display: inline-flex;
    width: 26px;
    height: 26px;
    align-items: center;
    justify-content: center;
    border: 1px solid #dbe2ec;
    border-radius: 50%;
    background: #fff;
    font-weight: 700;
}

.access-login-step.active {
    color: #326fe6;
    font-weight: 600;
}

.access-login-step.active .step-dot {
    border-color: #80a7f5;
    color: #fff;
    background: #3975ef;
    box-shadow: 0 0 0 5px rgba(57, 117, 239, 0.1);
}

.access-login-step.done {
    color: #339074;
}

.access-login-step.done .step-dot {
    border-color: #bfe8da;
    color: #1ca875;
    background: #ebfaf4;
}

.access-login-account {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: -5px 0 18px;
    padding: 11px 14px;
    border: 1px solid #dcebe7;
    border-radius: 12px;
    color: #718093;
    font-size: 13px;
    background: #f7fcfa;
}

.access-login-account strong {
    max-width: 65%;
    overflow: hidden;
    color: #284d42;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.access-login-security-note {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-top: 8px;
    color: #8a97a8;
    font-size: 12px;
}

.security-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #28b786;
    box-shadow: 0 0 0 4px rgba(40, 183, 134, 0.12);
}

.access-login-panel :deep(.el-button) {
    min-width: 132px;
    margin-top: 22px;
}

.access-login-footer {
    position: relative;
    z-index: 1;
    margin: 18px 0 0;
    color: rgba(73, 89, 111, 0.72);
    font-size: 12px;
}

@media (max-width: 560px) {
    .access-login-panel {
        padding: 24px 20px;
        border-radius: 20px;
    }

    .brand-badge {
        display: none;
    }

    .access-login-steps {
        gap: 2px;
    }
}
</style>
