<template>
    <main
        class="mci-ai-developing"
        :class="{ 'mci-ai-developing--paused': motionPaused || !pageVisible }"
        data-mci-ui-root
        data-ai-developing-page
        :data-menu-id="menu.menuId"
        aria-labelledby="mci-ai-developing-title"
    >
        <div class="mci-ai-developing__ambient" aria-hidden="true"></div>
        <div class="mci-ai-developing__grid" aria-hidden="true"></div>

        <div class="mci-ai-developing__content">
            <header class="mci-ai-developing__header">
                <span class="mci-ai-developing__brand"><span aria-hidden="true">✦</span> Microi 吾码</span>
                <span class="mci-ai-developing__label">AI 工作空间</span>
            </header>

            <section class="mci-ai-developing__stage">
                <div class="mci-ai-developing__copy">
                    <span class="mci-ai-developing__eyebrow">让需求，逐步成为现实</span>
                    <h1 id="mci-ai-developing-title">AI 正在开发中<span class="mci-ai-developing__ellipsis" aria-hidden="true">…</span></h1>
                    <h2 :title="menu.title">{{ menu.title }}</h2>
                    <p class="mci-ai-developing__description">您的新功能正在建设。完成开发与验收后，这里将呈现可以使用的正式页面。</p>
                    <div class="mci-ai-developing__actions">
                        <button class="mci-ai-developing__button mci-ai-developing__button--primary" type="button" @click="reloadPage">
                            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 7v5h-5M4 17v-5h5M6.1 7a7 7 0 0 1 11.5-1.6L20 8M4 16l2.4 2.6A7 7 0 0 0 17.9 17" /></svg>
                            刷新查看
                        </button>
                        <button class="mci-ai-developing__button" type="button" :aria-pressed="motionPaused" @click="motionPaused = !motionPaused">
                            <svg v-if="motionPaused" aria-hidden="true" viewBox="0 0 24 24"><path d="m9 5 11 7-11 7Z" /></svg>
                            <svg v-else aria-hidden="true" viewBox="0 0 24 24"><path d="M8 5v14M16 5v14" /></svg>
                            {{ motionPaused ? "继续动效" : "暂停动效" }}
                        </button>
                    </div>
                </div>

                <div class="mci-ai-developing__visual" aria-hidden="true">
                    <div class="mci-ai-developing__orbit mci-ai-developing__orbit--outer"><span></span></div>
                    <div class="mci-ai-developing__orbit mci-ai-developing__orbit--inner"><span></span></div>
                    <div class="mci-ai-developing__halo"></div>
                    <div class="mci-ai-developing__core">
                        <svg viewBox="0 0 64 64"><path d="m32 8 6.8 17.2L56 32l-17.2 6.8L32 56l-6.8-17.2L8 32l17.2-6.8Z" /></svg>
                        <span>AI</span>
                    </div>
                    <span class="mci-ai-developing__spark mci-ai-developing__spark--one">✦</span>
                    <span class="mci-ai-developing__spark mci-ai-developing__spark--two">✧</span>
                    <div class="mci-ai-developing__signal"><i></i><i></i><i></i><i></i><i></i></div>
                </div>
            </section>

            <footer class="mci-ai-developing__footer">
                <span class="mci-ai-developing__preview">功能开发预览</span>
                <p>您可以先浏览其它菜单，稍后刷新查看新页面。</p>
            </footer>
        </div>
    </main>
</template>

<script>
import { resolveDevelopingMenu } from "./developing-runtime.js";

export default {
    name: "MciAiDevelopingPage",
    data() {
        return { motionPaused: false, pageVisible: true, pageActive: true };
    },
    computed: {
        // 路由是菜单身份的唯一来源；共享组件或 keep-alive 切换时不缓存上一菜单标题。
        menu() { return resolveDevelopingMenu(this.$route); }
    },
    mounted() {
        this.syncVisibility();
        document.addEventListener("visibilitychange", this.syncVisibility);
    },
    activated() { this.pageActive = true; this.syncVisibility(); },
    deactivated() { this.pageActive = false; this.syncVisibility(); },
    beforeUnmount() { document.removeEventListener("visibilitychange", this.syncVisibility); },
    methods: {
        syncVisibility() { this.pageVisible = this.pageActive && !document.hidden; },
        reloadPage() {
            // 仅重新加载当前地址，让框架按现有身份重新读取菜单和最终组件。
            // 不轮询、不写业务数据，也不根据占位动画推断 AI 实际进度或自动切换未知路由。
            window.location.reload();
        }
    }
};
</script>

<style scoped>
.mci-ai-developing {
    --mci-developing-accent: var(--mci-color-primary-readable, var(--mci-color-primary, var(--el-color-primary, #6c2bd9)));
    position: relative;
    isolation: isolate;
    display: grid;
    align-items: safe center;
    justify-items: center;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    min-height: 100%;
    padding: clamp(24px, 4vw, 64px);
    overflow-x: hidden;
    overflow-y: auto;
    color: var(--mci-text-primary, var(--el-text-color-primary, #0f172a));
    background: var(--mci-bg-page, var(--el-bg-color-page, #f7f9fc));
}
.mci-ai-developing__ambient,
.mci-ai-developing__grid { position: absolute; inset: 0; z-index: -1; pointer-events: none; }
.mci-ai-developing__ambient {
    background: radial-gradient(ellipse at 78% 40%, color-mix(in srgb, var(--mci-color-primary, #6c2bd9) 10%, transparent), transparent 60%);
}
.mci-ai-developing__grid {
    opacity: .35;
    background-image: linear-gradient(var(--mci-border-color, #e2e8f0) 1px, transparent 1px), linear-gradient(90deg, var(--mci-border-color, #e2e8f0) 1px, transparent 1px);
    background-size: 48px 48px;
    mask-image: radial-gradient(ellipse at 76% 45%, black, transparent 65%);
}
.mci-ai-developing__content { width: min(100%, 1080px); min-width: 0; animation: mci-developing-enter .55s ease both; }
.mci-ai-developing__header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.mci-ai-developing__brand { display: inline-flex; align-items: center; gap: 9px; font-size: 15px; font-weight: 700; letter-spacing: .02em; }
.mci-ai-developing__brand > span { color: var(--mci-developing-accent); font-size: 22px; }
.mci-ai-developing__label { color: var(--mci-text-secondary, #334155); font-size: 12px; letter-spacing: .08em; }
.mci-ai-developing__stage { display: grid; grid-template-columns: 1.15fr 1fr; align-items: center; gap: clamp(12px, 4vw, 64px); padding: 60px 0 52px; }
.mci-ai-developing__copy { min-width: 0; }
.mci-ai-developing__eyebrow { color: var(--mci-developing-accent); font-size: 13px; font-weight: 600; letter-spacing: .1em; }
.mci-ai-developing h1 { margin: 18px 0 24px; font-size: clamp(28px, 3.3vw, 46px); font-weight: 750; line-height: 1.3; letter-spacing: -.035em; }
.mci-ai-developing__ellipsis { display: inline-block; animation: mci-developing-breathe 4s ease-in-out infinite; }
.mci-ai-developing h2 { margin: 0 0 13px; max-width: 100%; font-size: 20px; font-weight: 650; line-height: 1.6; overflow-wrap: anywhere; }
.mci-ai-developing__description { max-width: 400px; margin: 0; color: var(--mci-text-secondary, var(--el-text-color-regular, #334155)); font-size: 14px; line-height: 1.9; }
.mci-ai-developing__actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 28px; }
.mci-ai-developing__button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 11px 18px; border: 1px solid var(--mci-border-color, #e2e8f0); border-radius: var(--mci-shape-button, var(--mci-radius-md, 12px)); color: var(--mci-text-secondary, #334155); background: var(--mci-bg-card, var(--el-bg-color, #fff)); font: inherit; font-size: 13px; font-weight: 600; line-height: 1; cursor: pointer; transition: transform .18s ease, background-color .18s ease; }
.mci-ai-developing__button--primary { border-color: transparent; color: var(--mci-text-on-primary, #fff); background: var(--mci-color-primary, var(--el-color-primary, #6c2bd9)); }
.mci-ai-developing__button svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.mci-ai-developing__button:hover { transform: translateY(-2px); }
.mci-ai-developing__button:active { transform: translateY(0) scale(.98); }
.mci-ai-developing__button:focus-visible { outline: 2px solid var(--mci-developing-accent); outline-offset: 4px; }
.mci-ai-developing__visual { position: relative; justify-self: center; width: min(100%, 360px); aspect-ratio: 1; pointer-events: none; }
.mci-ai-developing__orbit { position: absolute; border: 1px solid color-mix(in srgb, var(--mci-color-primary, #6c2bd9) 18%, var(--mci-border-color, #e2e8f0)); border-radius: 50%; animation: mci-developing-orbit 26s linear infinite; }
.mci-ai-developing__orbit--outer { inset: 6%; }
.mci-ai-developing__orbit--inner { inset: 18%; animation-duration: 18s; animation-direction: reverse; }
.mci-ai-developing__orbit > span { position: absolute; top: calc(50% - 4px); left: -4px; width: 8px; height: 8px; border-radius: 50%; background: var(--mci-color-primary, #6c2bd9); box-shadow: 0 0 0 6px color-mix(in srgb, var(--mci-color-primary, #6c2bd9) 10%, transparent); }
.mci-ai-developing__orbit--inner > span { width: 6px; height: 6px; left: -3px; background: var(--mci-color-accent-cyan, #06b6d4); }
.mci-ai-developing__halo { position: absolute; inset: 25%; border-radius: 50%; background: color-mix(in srgb, var(--mci-color-primary, #6c2bd9) 8%, transparent); animation: mci-developing-halo 6s ease-in-out infinite; }
.mci-ai-developing__core { position: absolute; inset: 31%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; border: 1px solid color-mix(in srgb, var(--mci-color-primary, #6c2bd9) 22%, var(--mci-border-color, #e2e8f0)); border-radius: 30%; color: var(--mci-developing-accent); background: var(--mci-bg-card, #fff); box-shadow: 0 16px 48px color-mix(in srgb, var(--mci-color-primary, #6c2bd9) 12%, transparent); animation: mci-developing-float 6s ease-in-out infinite; }
.mci-ai-developing__core svg { width: 43%; height: 43%; fill: currentColor; }
.mci-ai-developing__core > span { font-size: 16px; font-weight: 750; letter-spacing: .12em; }
.mci-ai-developing__spark { position: absolute; color: var(--mci-developing-accent); font-size: 24px; animation: mci-developing-float 7s ease-in-out infinite; }
.mci-ai-developing__spark--one { top: 10%; right: 18%; }
.mci-ai-developing__spark--two { bottom: 18%; left: 11%; font-size: 18px; animation-delay: -3s; }
.mci-ai-developing__signal { position: absolute; bottom: 10%; left: 50%; display: flex; align-items: center; gap: 4px; transform: translateX(-50%); }
.mci-ai-developing__signal i { width: 4px; height: 15px; border-radius: 4px; background: var(--mci-color-primary, #6c2bd9); animation: mci-developing-signal 4s ease-in-out infinite; }
.mci-ai-developing__signal i:nth-child(2), .mci-ai-developing__signal i:nth-child(4) { animation-delay: -.5s; }
.mci-ai-developing__signal i:nth-child(3) { animation-delay: -1s; }
.mci-ai-developing__footer { display: flex; align-items: center; flex-wrap: wrap; gap: 14px; padding-top: 22px; border-top: 1px solid var(--mci-border-color, #e2e8f0); color: var(--mci-text-secondary, #334155); font-size: 12px; }
.mci-ai-developing__preview { padding: 5px 9px; border-radius: var(--mci-shape-panel, var(--mci-radius-sm, 8px)); background: var(--mci-bg-surface, #f1f5f9); white-space: nowrap; }
.mci-ai-developing__footer p { margin: 0; line-height: 1.8; }
/* 静态占位不拥有真实任务进度；所有装饰仅在可见时运行，也允许用户主动暂停。 */
.mci-ai-developing--paused *, .mci-ai-developing--paused *::before, .mci-ai-developing--paused *::after { animation-play-state: paused !important; }
@keyframes mci-developing-enter { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes mci-developing-orbit { to { transform: rotate(360deg); } }
@keyframes mci-developing-breathe { 0%, 100% { opacity: .5; } 50% { opacity: 1; } }
@keyframes mci-developing-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
@keyframes mci-developing-halo { 0%, 100% { transform: scale(1); opacity: .65; } 50% { transform: scale(1.12); opacity: 1; } }
@keyframes mci-developing-signal { 0%, 100% { transform: scaleY(.45); opacity: .45; } 50% { transform: scaleY(1); opacity: 1; } }
@media (max-width: 600px) {
    .mci-ai-developing { padding: 24px 22px max(24px, env(safe-area-inset-bottom)); min-height: calc(100dvh - 60px); }
    .mci-ai-developing__stage { display: flex; flex-direction: column-reverse; gap: 24px; padding: 30px 0; }
    .mci-ai-developing__copy { width: 100%; text-align: center; }
    .mci-ai-developing__visual { width: min(65%, 220px); }
    .mci-ai-developing h1 { margin: 12px 0 18px; font-size: 30px; }
    .mci-ai-developing h2 { font-size: 18px; }
    .mci-ai-developing__eyebrow { font-size: 12px; }
    .mci-ai-developing__description { margin-inline: auto; font-size: 13px; }
    .mci-ai-developing__actions { justify-content: center; gap: 10px; margin-top: 22px; }
    .mci-ai-developing__footer { justify-content: center; gap: 8px; padding-top: 18px; text-align: center; }
}
@media (prefers-reduced-motion: reduce) {
    .mci-ai-developing *, .mci-ai-developing *::before, .mci-ai-developing *::after { animation: none !important; transition: none !important; }
}
</style>
