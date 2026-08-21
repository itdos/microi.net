<template>
    <main class="sso-authorize-page" role="main">
        <section class="sso-authorize-card" role="status" aria-live="polite">
            <div class="sso-authorize-mark" :class="state" aria-hidden="true">
                <span v-if="state === 'error'">!</span>
                <span v-else>↗</span>
            </div>
            <p class="sso-authorize-kicker">MICROI SSO</p>
            <h1>{{ title }}</h1>
            <p>{{ message }}</p>
            <div v-if="state === 'working'" class="sso-authorize-progress"><i /><i /><i /></div>
            <el-button v-if="state === 'error'" type="primary" round @click="retry">重新授权</el-button>
            <small>第三方系统不会获得您的吾码 DiyToken，授权仍受当前租户角色、菜单与数据权限约束。</small>
        </section>
    </main>
</template>

<script>
import { DiyCommon } from "@/utils/microi.net.import";

export default {
    name: "SsoAuthorize",
    data() {
        return { state: "working", title: "正在确认单点登录", message: "正在核验当前吾码会话与第三方应用注册信息…" };
    },
    mounted() {
        this.complete();
    },
    methods: {
        async complete() {
            const requestId = String(this.$route.query.request || "").trim();
            if (!requestId) return this.fail("授权请求缺失，请从第三方系统重新发起单点登录。");
            if (!DiyCommon.getToken()) {
                this.$router.replace({ path: "/login", query: { redirect: "/sso-authorize", request: requestId } });
                return;
            }
            this.state = "working";
            try {
                const result = await DiyCommon.PostAsync("/api/Sso/CompleteAuthorization", {
                    OsClient: DiyCommon.GetOsClient(),
                    RequestId: requestId
                }, null, null, "json");
                if (!result || result.Code !== 1 || !result.Data?.RedirectUrl) {
                    throw new Error(result?.Msg || "SSO 授权未完成。");
                }
                this.title = "授权成功";
                this.message = "正在安全返回第三方系统…";
                window.location.replace(result.Data.RedirectUrl);
            } catch (error) {
                this.fail(error?.message || "SSO 授权失败，请重新发起。");
            }
        },
        fail(message) {
            this.state = "error";
            this.title = "无法完成单点登录";
            this.message = message;
        },
        retry() {
            this.complete();
        }
    }
};
</script>

<style scoped>
.sso-authorize-page{min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 20% 10%,#245ee533,transparent 38%),linear-gradient(145deg,#07111f,#101d34);color:#edf5ff;font-family:Inter,"Microsoft YaHei",sans-serif}.sso-authorize-card{width:min(520px,100%);padding:46px 42px;border:1px solid #ffffff24;border-radius:28px;background:#ffffff0d;box-shadow:0 28px 90px #0008;text-align:center;backdrop-filter:blur(18px)}.sso-authorize-mark{width:70px;height:70px;margin:0 auto 22px;display:grid;place-items:center;border-radius:22px;background:linear-gradient(135deg,#477cff,#55d8c5);font-size:34px;font-weight:800;box-shadow:0 16px 42px #286cff55}.sso-authorize-mark.error{background:linear-gradient(135deg,#ef5f6f,#ff9f5b)}.sso-authorize-kicker{margin:0;color:#72c9ff;font-size:12px;font-weight:800;letter-spacing:.24em}.sso-authorize-card h1{margin:12px 0;font-size:26px}.sso-authorize-card>p:not(.sso-authorize-kicker){min-height:48px;margin:0;color:#afbdd2;line-height:1.7}.sso-authorize-card small{display:block;margin-top:28px;color:#7f91aa;line-height:1.65}.sso-authorize-progress{display:flex;justify-content:center;gap:8px;margin:24px 0}.sso-authorize-progress i{width:8px;height:8px;border-radius:50%;background:#67d8c8;animation:sso-pulse 1.2s infinite ease-in-out}.sso-authorize-progress i:nth-child(2){animation-delay:.16s}.sso-authorize-progress i:nth-child(3){animation-delay:.32s}@keyframes sso-pulse{0%,100%{opacity:.25;transform:translateY(0)}50%{opacity:1;transform:translateY(-6px)}}
@media(max-width:600px){.sso-authorize-card{padding:36px 24px;border-radius:22px}}
</style>
