<template>
    <div class="mci-generation" :class="{ 'is-paused': paused }" data-testid="ai-generation-loading" role="status" aria-live="polite" aria-busy="true">
        <div class="mci-generation__canvas" aria-hidden="true">
            <img v-if="preview" :src="preview" alt="" />
            <div v-else class="mci-generation__drawing"><i></i><b></b><em></em></div>
            <div class="mci-generation__grid"></div>
            <div class="mci-generation__scan"></div>
            <span class="mci-generation__corner"></span>
            <span class="mci-generation__corner"></span>
            <span class="mci-generation__corner"></span>
            <span class="mci-generation__corner"></span>
            <div class="mci-generation__badge"><i></i> {{ exact ? 'IMAGE PROCESSING' : 'CREATING' }}</div>
        </div>
        <div class="mci-generation__copy">
            <span class="mci-generation__eyebrow">{{ modelName || 'AI IMAGE' }}</span>
            <strong>{{ title }}</strong>
            <p>{{ exact ? '正在处理图像并保存结果' : '灵感正在成像，完成后会自动呈现' }}</p>
        </div>
        <div class="mci-generation__activity" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><span>已等待 {{ elapsed }} 秒</span></div>
        <small>{{ exact ? '请稍候，结果即将呈现' : (submitted ? '任务已提交，可离开后返回查看' : '正在安全提交，请稍候') }}</small>
    </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
const props = defineProps({ modelName: String, preview: String, exact: Boolean, submitted: Boolean, status: String });
const elapsed = ref(0);
const startedAt = Date.now();
let timer;
const paused = ref(false);
function visibilityChanged() { paused.value = document.hidden; }
onMounted(() => { visibilityChanged(); document.addEventListener('visibilitychange', visibilityChanged); timer = setInterval(() => { if (!paused.value) elapsed.value = Math.floor((Date.now() - startedAt) / 1000); }, 1000); });
onBeforeUnmount(() => { clearInterval(timer); document.removeEventListener('visibilitychange', visibilityChanged); });
const title = computed(() => props.exact ? '精细处理每一处像素' : props.status === 'Pending' ? '已进入创作队列' : '正在让画面成为现实');
</script>

<style scoped>
.mci-generation { --mci-generation-accent: var(--el-color-primary, #5d91fa); --mci-generation-ink: #edf4ff; --mci-generation-muted: #acbcd1; display: flex; flex: 1; flex-direction: column; align-items: center; justify-content: center; gap: 20px; width: 100%; min-width: 0; min-height: 380px; padding: 36px 18px; box-sizing: border-box; text-align: center; overflow: hidden; }
.mci-generation__canvas { position: relative; width: min(240px, 84%); aspect-ratio: 4 / 3; border: 1px solid color-mix(in srgb, var(--mci-generation-accent) 40%, transparent); border-radius: 16px; background: linear-gradient(145deg, color-mix(in srgb, var(--mci-generation-accent) 17%, #101721), #111e30); isolation: isolate; }
.mci-generation__canvas img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: .52; border-radius: inherit; }
.mci-generation__grid { position: absolute; inset: 0; border-radius: inherit; background-image: linear-gradient(#ffffff09 1px, transparent 1px), linear-gradient(90deg, #ffffff09 1px, transparent 1px); background-size: 24px 24px; }
.mci-generation__scan { position: absolute; inset: 0; overflow: hidden; border-radius: inherit; }
.mci-generation__scan::after { content: ''; position: absolute; left: 0; right: 0; height: 35%; top: -35%; background: linear-gradient(transparent, color-mix(in srgb, var(--mci-generation-accent) 35%, transparent)); border-bottom: 1px solid color-mix(in srgb, var(--mci-generation-accent) 70%, white); animation: mci-image-scan 3.4s ease-in-out infinite; }
.mci-generation__drawing { position: absolute; inset: 24% 22%; overflow: hidden; border: 1px solid #a8caff80; border-radius: 9px; transform: rotate(-4deg); }
.mci-generation__drawing i { position: absolute; width: 14px; height: 14px; border-radius: 50%; right: 19%; top: 17%; background: #b5d5ffb0; }
.mci-generation__drawing b, .mci-generation__drawing em { position: absolute; width: 75%; height: 100%; top: 68%; left: -10%; transform: rotate(-40deg); background: linear-gradient(120deg, color-mix(in srgb, var(--mci-generation-accent) 40%, #183152), #28476b); border: 1px solid #9cc7f750; border-radius: 8px; }
.mci-generation__drawing em { width: 70%; left: 48%; top: 70%; transform: rotate(-46deg); }
.mci-generation__corner { position: absolute; width: 14px; height: 14px; border-color: #91bafd; border-style: solid; opacity: .8; }
.mci-generation__corner:nth-of-type(1) { left: -5px; top: -5px; border-width: 2px 0 0 2px; border-radius: 10px 0 0; }
.mci-generation__corner:nth-of-type(2) { right: -5px; top: -5px; border-width: 2px 2px 0 0; border-radius: 0 10px 0 0; }
.mci-generation__corner:nth-of-type(3) { left: -5px; bottom: -5px; border-width: 0 0 2px 2px; border-radius: 0 0 0 10px; }
.mci-generation__corner:nth-of-type(4) { right: -5px; bottom: -5px; border-width: 0 2px 2px 0; border-radius: 0 0 10px; }
.mci-generation__badge { position: absolute; bottom: -12px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 7px; white-space: nowrap; background: #18283e; border: 1px solid #5d82b266; padding: 6px 10px; border-radius: 7px; font-size: 9px; letter-spacing: 1.6px; color: #cbe2ff; }
.mci-generation__badge i { width: 5px; height: 5px; background: #7bd9c5; border-radius: 50%; animation: mci-image-pulse 1.8s ease-in-out infinite; }
.mci-generation__copy { display: flex; flex-direction: column; gap: 9px; width: 100%; margin-top: 6px; }
.mci-generation__eyebrow { color: #a0c9ff; font-size: 11px; letter-spacing: 1.2px; overflow-wrap: anywhere; }
.mci-generation__copy strong { color: var(--mci-generation-ink); font-size: clamp(17px, 1.4vw, 22px); line-height: 1.5; font-weight: 600; }
.mci-generation__copy p { margin: 0; color: var(--mci-generation-muted); font-size: 12px; line-height: 1.7; }
.mci-generation__activity { display: flex; height: 22px; align-items: center; gap: 3px; color: var(--mci-generation-muted); }
.mci-generation__activity i { display: block; width: 3px; height: 16px; border-radius: 2px; background: var(--mci-generation-accent); transform-origin: center; animation: mci-image-wave 1.4s ease-in-out infinite; }
.mci-generation__activity i:nth-child(2n) { animation-delay: -.4s; }.mci-generation__activity i:nth-child(3n) { animation-delay: -.8s; }
.mci-generation__activity span { margin-left: 10px; font-size: 11px; font-variant-numeric: tabular-nums; }
.mci-generation > small { color: var(--mci-generation-muted); font-size: 11px; line-height: 1.6; }
@keyframes mci-image-scan { 0% { transform: translateY(0); opacity: 0; } 15% { opacity: 1; } 85% { opacity: 1; } 100% { transform: translateY(385%); opacity: 0; } }
@keyframes mci-image-wave { 0%,100% { transform: scaleY(.25); opacity: .5; } 50% { transform: scaleY(1); opacity: 1; } }
@keyframes mci-image-pulse { 50% { opacity: .35; } }
.mci-generation.is-paused *, .mci-generation.is-paused *::after { animation-play-state: paused !important; }
@media (prefers-reduced-motion: reduce) { .mci-generation *, .mci-generation *::after { animation: none !important; }.mci-generation__scan::after { top: 30%; opacity: .4; } }
@media (max-width: 600px) { .mci-generation { min-height: 360px; padding: 30px 12px; gap: 18px; }.mci-generation__copy strong { font-size: 18px; } }
</style>
