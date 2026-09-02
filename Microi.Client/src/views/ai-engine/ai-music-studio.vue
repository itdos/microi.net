<template>
    <section class="music-studio" data-testid="ai-music-studio">
        <div class="music-workbench">
            <div class="music-copy">
                <span>AI MUSIC · MiniMax Music 3</span>
                <h1>一句灵感，生成可直接试听的配乐</h1>
                <p>选择方向、补充情绪和乐器。优先使用正式 music-3.0；账号受官方退役策略限制时，自动切换官方开源 MiniMax-Music3，成品永久写入当前租户 HDFS。公开算力可能排队或限额，生产环境可在服务端配置 Hugging Face Token。</p>
                <div class="music-signal" aria-hidden="true">
                    <i v-for="index in 32" :key="index" :style="{ height: `${18 + ((index * 17) % 58)}px` }"></i>
                </div>
            </div>

            <div class="music-form-panel">
                <div class="music-section-heading">
                    <div><span>STYLE</span><strong>选择音乐方向</strong></div>
                    <small>单击后仍可继续修改描述</small>
                </div>
                <div class="music-presets">
                    <button
                        v-for="preset in presets"
                        :key="preset.id"
                        type="button"
                        :class="{ active: activePreset === preset.id }"
                        @click="applyPreset(preset)"
                    >
                        <span>{{ preset.icon }}</span>
                        <strong>{{ preset.label }}</strong>
                        <small>{{ preset.desc }}</small>
                    </button>
                </div>

                <div class="music-prompt">
                    <label for="ai-music-prompt">音乐描述</label>
                    <el-input
                        id="ai-music-prompt"
                        v-model="prompt"
                        data-testid="ai-music-prompt"
                        type="textarea"
                        :rows="6"
                        maxlength="1800"
                        show-word-limit
                        resize="none"
                        placeholder="例如：轻快但克制的科技发布会开场配乐，电子脉冲与钢琴，逐步推进，适合 30 秒品牌视频"
                    />
                </div>

                <div class="music-duration">
                    <div><strong>开源回退时长</strong><small>正式接口时以实际音轨为准</small></div>
                    <el-select v-model="durationSeconds" aria-label="开源回退时长" style="width: 132px">
                        <el-option v-for="seconds in [10, 20, 30, 60]" :key="seconds" :label="`${seconds} 秒`" :value="seconds" />
                    </el-select>
                </div>

                <div class="music-specs">
                    <span><strong>music-3.0</strong><small>优先模型</small></span>
                    <span><strong>Music3</strong><small>官方开源回退</small></span>
                    <span><strong>纯音乐</strong><small>安全边界</small></span>
                    <span><strong>HDFS</strong><small>永久保存</small></span>
                </div>

                <el-button
                    class="music-generate"
                    type="primary"
                    size="large"
                    :icon="Headset"
                    :loading="loading"
                    data-testid="ai-music-run"
                    @click="generateMusic"
                >{{ loading ? "正在作曲" : "生成 AI 配乐" }}</el-button>
                <p class="music-rights">请勿要求模仿在世艺术家或未经授权复刻受保护作品；发布前仍需人工试听与版权复核。</p>
            </div>
        </div>

        <div class="music-output">
            <div class="music-section-heading">
                <div><span>OUTPUT</span><strong>本次生成</strong></div>
                <small>{{ result ? "已永久保存" : "暂无音轨" }}</small>
            </div>
            <div v-if="result" class="audio-result">
                <div class="audio-cover"><el-icon><Headset /></el-icon></div>
                <div class="audio-info">
                    <strong>{{ result.FileName || "AI 生成配乐.mp3" }}</strong>
                    <span>{{ result.Model || "music-3.0" }} · {{ durationText }} · {{ String(result.Format || "audio").toUpperCase() }}</span>
                    <small v-if="result.ModelFallbackUsed" class="fallback-note">{{ result.ModelFallbackReason }}</small>
                    <audio :src="result.FileUrl" controls preload="metadata">当前浏览器不支持在线播放音频。</audio>
                </div>
                <a :href="result.FileUrl" :download="result.FileName || 'ai-music.mp3'" target="_blank" rel="noopener noreferrer" aria-label="下载音乐">
                    <el-icon><Download /></el-icon>
                </a>
            </div>
            <div v-else class="audio-empty"><el-icon><Headset /></el-icon><span>生成后可在这里试听和下载</span></div>
        </div>
    </section>
</template>

<script setup>
import { computed, getCurrentInstance, ref } from "vue";
import { Download, Headset } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";

const { proxy } = getCurrentInstance();
const DiyCommon = proxy.DiyCommon;
const loading = ref(false);
const prompt = ref("");
const durationSeconds = ref(20);
const activePreset = ref("");
const result = ref(null);
const presets = [
    { id: "brand", icon: "✦", label: "品牌科技", desc: "电子 · 克制 · 推进", prompt: "现代科技品牌配乐，克制的电子脉冲、温暖钢琴与细腻合成器，节奏逐步推进，专业、可信、适合产品发布视频，无人声。" },
    { id: "film", icon: "◐", label: "电影叙事", desc: "弦乐 · 氛围 · 起伏", prompt: "电影叙事配乐，从安静钢琴和环境氛围开始，弦乐逐渐进入并形成有节制的情绪高潮，宽阔空间感，无人声。" },
    { id: "oriental", icon: "山", label: "东方意境", desc: "古琴 · 箫 · 现代氛围", prompt: "现代东方氛围音乐，古琴与箫的简洁旋律，融合柔和电子纹理与自然环境声，留白充足，宁静而有力量，无人声。" },
    { id: "light", icon: "☀", label: "轻快日常", desc: "吉他 · 鼓点 · 明亮", prompt: "轻快自然的日常短视频配乐，木吉他、清脆打击乐和轻柔贝斯，明亮但不过分活泼，循环友好，无人声。" },
    { id: "focus", icon: "⌁", label: "专注工作", desc: "Lo-fi · 平稳 · 低干扰", prompt: "适合专注工作的低干扰 Lo-fi 配乐，柔和鼓点、电钢琴与低饱和磁带质感，节奏稳定，没有突兀变化，无人声。" },
    { id: "energy", icon: "↗", label: "运动能量", desc: "鼓组 · 贝斯 · 节奏", prompt: "富有能量的运动宣传配乐，清晰鼓组、有力贝斯与现代电子层次，节奏紧凑，积极向上但不夸张，无人声。" }
];

const durationText = computed(() => {
    const seconds = Math.round(Number(result.value?.DurationMilliseconds || 0) / 1000);
    if (!seconds) return "时长以实际音轨为准";
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
});

function applyPreset(preset) {
    activePreset.value = preset.id;
    prompt.value = preset.prompt;
}

function unwrapDosResult(value) {
    let current = value || {};
    if (current?.Data && typeof current.Data === "object" && current.Data.Code !== undefined) current = current.Data;
    if (current?.data && typeof current.data === "object" && current.data.Code !== undefined) current = current.data;
    return current;
}

function requestId() {
    const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `music-studio:${random}`.replace(/[^a-zA-Z0-9._:-]/g, "-").slice(0, 160);
}

async function generateMusic() {
    if (!prompt.value.trim()) {
        ElMessage.warning("请先描述想要的音乐");
        return;
    }
    loading.value = true;
    result.value = null;
    try {
        const response = await fetch(`${DiyCommon.GetApiBase()}/api/Ai/GenerateMiniMaxMusic`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                authorization: DiyCommon.getToken() ? `Bearer ${DiyCommon.getToken()}` : ""
            },
            body: JSON.stringify({
                RequestId: requestId(),
                Prompt: prompt.value.trim(),
                Model: "music-3.0",
                IsInstrumental: true,
                SampleRate: 44100,
                Bitrate: 256000,
                Format: "mp3",
                DurationSeconds: durationSeconds.value
            })
        });
        let payload;
        try { payload = await response.json(); } catch { throw new Error(`音乐服务响应无法解析（HTTP ${response.status}）`); }
        const current = unwrapDosResult(payload);
        if (!response.ok || Number(current?.Code ?? current?.code) !== 1) throw new Error(current?.Msg || current?.msg || "AI 音乐生成失败");
        result.value = current.Data || current.data || null;
        if (!result.value?.FileUrl) throw new Error("音乐已生成，但没有获得可播放的 HDFS 地址");
        ElMessage.success(result.value.Replayed === true ? "已返回同一请求的既有音轨" : "配乐已生成并写入 HDFS");
    } catch (error) {
        ElMessage.error(error?.message || "AI 音乐生成失败");
    } finally {
        loading.value = false;
    }
}
</script>

<style scoped>
.music-studio { min-height: 100%; padding: 28px; background: linear-gradient(140deg, #0c1119, #151c29 55%, #101722); color: #eef4ff; }
.music-workbench { display: grid; grid-template-columns: minmax(300px, .82fr) minmax(520px, 1.18fr); max-width: 1240px; margin: 0 auto; overflow: hidden; border: 1px solid rgba(151, 170, 201, .17); border-radius: 20px; background: rgba(17, 24, 36, .88); box-shadow: 0 28px 70px rgba(0, 0, 0, .28); }
.music-copy { position: relative; min-height: 570px; overflow: hidden; padding: 54px 44px; background: radial-gradient(circle at 20% 15%, rgba(74, 125, 226, .27), transparent 35%), linear-gradient(155deg, #131d2d, #0a1019); }
.music-copy > span, .music-section-heading span { color: #77a8ff; font-size: 10px; font-weight: 800; letter-spacing: .15em; }
.music-copy h1 { max-width: 420px; margin: 14px 0 16px; font-size: clamp(31px, 3.4vw, 48px); line-height: 1.08; letter-spacing: -.045em; }
.music-copy p { max-width: 430px; margin: 0; color: #9cabc0; font-size: 13px; line-height: 1.8; }
.music-signal { position: absolute; right: 36px; bottom: 70px; left: 36px; display: flex; align-items: center; justify-content: center; gap: 5px; height: 110px; opacity: .72; }
.music-signal i { width: 4px; border-radius: 99px; background: linear-gradient(to top, #467ee0, #8fc1ff); }
.music-form-panel { padding: 36px 40px; background: #f7f9fc; color: #1b2638; }
.music-section-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; }
.music-section-heading div > * { display: block; }.music-section-heading strong { margin-top: 4px; font-size: 19px; }
.music-section-heading small { color: #8793a5; font-size: 10px; }
.music-presets { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 15px; }
.music-presets button { min-height: 92px; padding: 12px; border: 1px solid #e1e6ee; border-radius: 10px; background: #fff; color: #253147; text-align: left; cursor: pointer; }
.music-presets button:hover, .music-presets button.active { border-color: #6c9ced; background: #eef5ff; box-shadow: inset 0 0 0 1px #6c9ced; }
.music-presets button > span { display: block; margin-bottom: 7px; color: #4c82dc; font-size: 17px; }
.music-presets strong, .music-presets small { display: block; }.music-presets strong { font-size: 12px; }.music-presets small { margin-top: 3px; color: #8a96a8; font-size: 9px; }
.music-prompt { margin-top: 22px; }.music-prompt label { display: block; margin-bottom: 8px; font-size: 12px; font-weight: 700; }
.music-duration { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 14px; }.music-duration strong, .music-duration small { display: block; }.music-duration strong { font-size: 11px; }.music-duration small { margin-top: 3px; color: #8a96a8; font-size: 9px; }
.music-specs { display: grid; grid-template-columns: repeat(4, 1fr); margin-top: 18px; border: 1px solid #e3e8ef; border-radius: 10px; background: #fff; }
.music-specs span { padding: 11px 12px; border-right: 1px solid #edf0f4; }.music-specs span:last-child { border-right: 0; }
.music-specs strong, .music-specs small { display: block; }.music-specs strong { color: #253147; font-size: 11px; }.music-specs small { margin-top: 2px; color: #96a1b1; font-size: 9px; }
.music-generate { width: 100%; margin-top: 20px; }.music-rights { margin: 9px 0 0; color: #909bac; font-size: 9px; line-height: 1.5; text-align: center; }
.music-output { max-width: 1240px; margin: 16px auto 0; padding: 20px 24px; border: 1px solid rgba(151, 170, 201, .17); border-radius: 16px; background: rgba(17, 24, 36, .88); }
.music-output .music-section-heading strong { color: #edf4ff; }.music-output .music-section-heading small { color: #7f8ca0; }
.audio-result { display: grid; grid-template-columns: 64px minmax(0, 1fr) 42px; align-items: center; gap: 16px; margin-top: 14px; padding: 12px; border: 1px solid #2c3748; border-radius: 12px; background: #0c121c; }
.audio-cover { display: grid; place-items: center; width: 64px; height: 64px; border-radius: 10px; background: linear-gradient(135deg, #3978e5, #9a68ee); font-size: 25px; }
.audio-info { min-width: 0; }.audio-info strong, .audio-info span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.audio-info strong { font-size: 12px; }.audio-info span { margin: 3px 0 8px; color: #8391a5; font-size: 9px; }.audio-info audio { width: min(100%, 620px); height: 32px; }
.audio-info .fallback-note { display: block; margin: -4px 0 8px; color: #77a8ff; font-size: 9px; white-space: normal; }
.audio-result > a { display: grid; place-items: center; width: 38px; height: 38px; border: 1px solid #344257; border-radius: 9px; color: #d9e8ff; }
.audio-empty { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 86px; color: #6f7c90; font-size: 11px; }
@media (max-width: 900px) { .music-studio { padding: 14px; }.music-workbench { grid-template-columns: 1fr; }.music-copy { min-height: 300px; padding: 34px 26px; }.music-signal { bottom: 25px; height: 70px; }.music-form-panel { padding: 28px 22px; } }
@media (max-width: 620px) { .music-presets { grid-template-columns: repeat(2, 1fr); }.music-specs { grid-template-columns: repeat(2, 1fr); }.music-specs span:nth-child(2) { border-right: 0; }.music-specs span:nth-child(-n+2) { border-bottom: 1px solid #edf0f4; }.audio-result { grid-template-columns: 52px minmax(0, 1fr); }.audio-cover { width: 52px; height: 52px; }.audio-result > a { display: none; } }
</style>
