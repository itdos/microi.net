<template>
    <div class="micro-app-skeleton" :class="{ 'micro-app-skeleton--compact': compact }" aria-busy="true" aria-label="正在加载微应用">
        <div class="micro-app-skeleton__hero">
            <i></i>
            <div><b></b><span></span></div>
        </div>
        <div class="micro-app-skeleton__body">
            <div v-for="item in (compact ? 2 : 6)" :key="item" class="micro-app-skeleton__field">
                <b></b><span></span>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    name: "MicroAppLoadingSkeleton",
    props: { compact: { type: Boolean, default: false } }
};
</script>

<style lang="scss" scoped>
.micro-app-skeleton { width: 100%; min-height: 360px; padding: 20px; background: var(--el-bg-color-page); }
.micro-app-skeleton__hero, .micro-app-skeleton__body { border: 1px solid var(--el-border-color-lighter); border-radius: 10px; background: var(--el-bg-color); }
.micro-app-skeleton__hero { display: flex; gap: 13px; margin-bottom: 16px; padding: 15px 16px; }
.micro-app-skeleton__hero > i { flex: 0 0 38px; height: 38px; border-radius: 9px; }
.micro-app-skeleton__hero > div { flex: 1; padding-top: 2px; }
.micro-app-skeleton__hero b, .micro-app-skeleton__hero span, .micro-app-skeleton__field b, .micro-app-skeleton__field span, .micro-app-skeleton__hero > i { display: block; background: linear-gradient(90deg,var(--el-fill-color-light) 20%,var(--el-fill-color-lighter) 38%,var(--el-fill-color-light) 62%); background-size: 300% 100%; animation: micro-app-skeleton-shimmer 1.35s ease infinite; }
.micro-app-skeleton__hero b { width: 30%; height: 15px; margin-bottom: 9px; border-radius: 5px; }
.micro-app-skeleton__hero span { width: 65%; height: 11px; border-radius: 5px; }
.micro-app-skeleton__body { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 16px; padding: 18px; }
.micro-app-skeleton__field b { width: 26%; height: 11px; margin-bottom: 8px; border-radius: 4px; }
.micro-app-skeleton__field span { height: 40px; border-radius: 7px; }
.micro-app-skeleton--compact { min-height: 100px; padding: 10px; }
.micro-app-skeleton--compact .micro-app-skeleton__hero { display: none; }
.micro-app-skeleton--compact .micro-app-skeleton__body { gap: 10px; padding: 12px; }
@keyframes micro-app-skeleton-shimmer { to { background-position: -150% 0; } }
@media (max-width: 640px) { .micro-app-skeleton { padding: 12px; } .micro-app-skeleton__body { grid-template-columns: 1fr; } }
@media (prefers-reduced-motion: reduce) { .micro-app-skeleton * { animation-duration: .01ms !important; } }
</style>
