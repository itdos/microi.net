<template>
    <div class="access-login-page">
        <el-card class="access-login-card" shadow="always">
            <div class="access-login-icon" :class="{ error: state === 'error' }">
                <el-icon v-if="state === 'loading'" class="is-loading"><Loading /></el-icon>
                <el-icon v-else-if="state === 'error'"><WarningFilled /></el-icon>
                <el-icon v-else><CircleCheckFilled /></el-icon>
            </div>
            <h2>{{ title }}</h2>
            <p>{{ message }}</p>
            <el-button v-if="state === 'error'" type="primary" @click="$router.replace('/login')">
                返回登录页
            </el-button>
        </el-card>
    </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { CircleCheckFilled, Loading, WarningFilled } from "@element-plus/icons-vue";
import { useDiyStore, useUserStore } from "@/pinia";
import { DiyCommon } from "@/utils/microi.net.import";

const route = useRoute();
const router = useRouter();
const diyStore = useDiyStore();
const userStore = useUserStore();
const state = ref("loading");
const message = ref("正在安全验证访问密钥，请稍候…");
const title = computed(() => state.value === "error"
    ? "无法进入页面"
    : state.value === "success"
        ? "验证成功"
        : "正在自动登录");

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

function normalizeRoutePath(value) {
    let path = String(value || "").trim();
    if (!path) return "";
    try {
        path = decodeURIComponent(path);
    } catch (_) {}
    if (!path.startsWith("/")) path = "/" + path;
    path = path.split("?")[0].replace(/\/+$/, "") || "/";
    return path;
}

onMounted(async () => {
    const accessKey = String(route.query.access_key || route.query.secret || "").trim();
    const requestedRedirect = normalizeRoutePath(route.query.redirect);
    scrubAccessKeyFromAddressBar();
    if (!accessKey) {
        state.value = "error";
        message.value = "链接中没有可用的访问密钥。";
        return;
    }

    try {
        const result = await DiyCommon.PostAsync(
            "/api/SysUserAccessKey/Exchange",
            {
                AccessKey: accessKey,
                OsClient: DiyCommon.GetOsClient()
            },
            null,
            null,
            "json"
        );
        if (result?.Code !== 1 || !result.Data) {
            state.value = "error";
            message.value = result?.Msg || "访问密钥无效、已过期或已被吊销。";
            return;
        }

        diyStore.setState("SystemStyle", "Classic");
        diyStore.setCurrentUser(result.Data);
        userStore.setRoles(["access-key"]);
        const allowedRoutes = Array.isArray(result.Data._AccessKeyAllowedRoutes)
            ? result.Data._AccessKeyAllowedRoutes.map(normalizeRoutePath)
            : [];
        const serverRedirect = normalizeRoutePath(result.DataAppend?.RedirectPath);
        const destination = allowedRoutes.includes(requestedRedirect)
            ? requestedRedirect
            : serverRedirect || allowedRoutes[0];
        if (!destination) {
            state.value = "error";
            message.value = "该访问密钥没有配置可访问页面。";
            return;
        }
        state.value = "success";
        message.value = "即将进入已授权页面…";
        await router.replace(destination);
    } catch (error) {
        state.value = "error";
        message.value = error?.message || "访问密钥验证失败，请联系管理员。";
    }
});
</script>

<style scoped>
.access-login-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: linear-gradient(135deg, #f4fbf8 0%, #edf4ff 100%);
}

.access-login-card {
    width: min(440px, 100%);
    text-align: center;
    border: 0;
    border-radius: 16px;
}

.access-login-icon {
    margin: 12px auto 18px;
    font-size: 52px;
    color: var(--el-color-primary);
}

.access-login-icon.error {
    color: var(--el-color-danger);
}

h2 {
    margin: 0 0 12px;
    color: var(--el-text-color-primary);
}

p {
    margin: 0 0 22px;
    color: var(--el-text-color-secondary);
    line-height: 1.7;
}
</style>
