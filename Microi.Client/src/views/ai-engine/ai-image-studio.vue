<template>
    <section class="image-studio" data-testid="ai-image-studio">
        <header class="studio-hero">
            <div>
                <span class="studio-kicker">IMAGE LAB · MiniMax image-01 + V8.Image</span>
                <h1>AI 图像工作台</h1>
                <p>生成、重绘与精确处理放在同一处。先选工具，再上传参考图和描述目标；高级参数只在需要时出现。</p>
            </div>
            <div class="studio-trust">
                <span>参考图私有存储</span>
                <span>结果写入 HDFS</span>
                <span>RequestId 防重复计费</span>
            </div>
        </header>

        <div class="studio-shell">
            <nav class="tool-browser" aria-label="AI 图片工具">
                <div class="tool-category-tabs">
                    <button
                        v-for="category in categories"
                        :key="category.id"
                        type="button"
                        :class="{ active: activeCategory === category.id }"
                        @click="activeCategory = category.id"
                    >
                        {{ category.label }}
                        <small>{{ toolCount(category.id) }}</small>
                    </button>
                </div>
                <div class="tool-list">
                    <button
                        v-for="tool in visibleTools"
                        :key="tool.id"
                        type="button"
                        class="tool-row"
                        :class="{ active: selectedToolId === tool.id }"
                        :data-testid="`ai-image-tool-${tool.id}`"
                        @click="selectTool(tool)"
                    >
                        <span class="tool-badge">{{ tool.badge }}</span>
                        <span>
                            <strong>{{ tool.label }}</strong>
                            <small>{{ tool.short }}</small>
                        </span>
                        <em>{{ tool.engine === "exact" ? "精确" : (tool.engine === "hybrid" ? "混合" : "AI") }}</em>
                    </button>
                </div>
            </nav>

            <div class="tool-editor">
                <div class="tool-title-row">
                    <div>
                        <span>{{ selectedTool.categoryLabel }}</span>
                        <h2>{{ selectedTool.label }}</h2>
                        <p>{{ selectedTool.description }}</p>
                    </div>
                    <span class="engine-pill">{{ selectedTool.engineLabel }}</span>
                </div>

                <div v-if="selectedTool.notice" class="tool-notice">
                    <el-icon><InfoFilled /></el-icon>
                    <span>{{ selectedTool.notice }}</span>
                </div>

                <div v-if="selectedTool.maxFiles > 0" class="reference-section">
                    <div class="field-heading">
                        <label>参考图片</label>
                        <span>{{ selectedTool.minFiles }}–{{ selectedTool.maxFiles }} 张 · JPEG / PNG / WebP · 单张不超过 10MB</span>
                    </div>
                    <input
                        ref="studioFileInputRef"
                        class="hidden-file-input"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        :multiple="selectedTool.maxFiles > 1"
                        @change="handleFiles"
                    />
                    <button
                        v-if="!sourceFiles.length"
                        type="button"
                        class="upload-dropzone"
                        data-testid="ai-image-upload"
                        @click="studioFileInputRef?.click()"
                    >
                        <el-icon><UploadFilled /></el-icon>
                        <strong>上传{{ selectedTool.maxFiles > 1 ? "一张或多张" : "一张" }}参考图</strong>
                        <small>{{ selectedTool.uploadHint }}</small>
                    </button>
                    <div v-else class="source-grid">
                        <figure v-for="(item, index) in sourceFiles" :key="item.key">
                            <img :src="item.previewUrl" :alt="item.file.name" />
                            <figcaption>{{ item.file.name }}</figcaption>
                            <button type="button" aria-label="移除图片" @click="removeFile(index)">
                                <el-icon><CircleClose /></el-icon>
                            </button>
                        </figure>
                        <button
                            v-if="sourceFiles.length < selectedTool.maxFiles"
                            type="button"
                            class="source-add"
                            @click="studioFileInputRef?.click()"
                        >
                            <el-icon><Plus /></el-icon>
                            <span>继续添加</span>
                        </button>
                    </div>
                </div>

                <div v-if="selectedTool.engine !== 'exact'" class="prompt-section">
                    <div class="field-heading">
                        <label for="ai-image-prompt">创作描述</label>
                        <span>{{ promptText.length }}/1200</span>
                    </div>
                    <el-input
                        id="ai-image-prompt"
                        v-model="promptText"
                        data-testid="ai-image-prompt"
                        type="textarea"
                        :rows="5"
                        maxlength="1200"
                        resize="none"
                        :placeholder="selectedTool.placeholder"
                    />
                    <div class="prompt-suggestions">
                        <button
                            v-for="suggestion in selectedTool.suggestions"
                            :key="suggestion"
                            type="button"
                            @click="promptText = suggestion"
                        >{{ suggestion }}</button>
                    </div>
                </div>

                <div class="studio-options">
                    <template v-if="selectedTool.engine !== 'exact'">
                        <label>
                            <span>画面比例</span>
                            <el-select v-model="settings.aspectRatio" data-testid="ai-image-aspect">
                                <el-option v-for="ratio in ratios" :key="ratio" :label="ratio" :value="ratio" />
                            </el-select>
                        </label>
                        <label v-if="selectedTool.id !== 'upscale'">
                            <span>生成数量</span>
                            <el-select v-model="settings.count">
                                <el-option v-for="count in [1, 2, 3, 4]" :key="count" :label="`${count} 张`" :value="count" />
                            </el-select>
                        </label>
                    </template>
                    <template v-if="selectedTool.operation === 'resize'">
                        <label><span>目标宽度</span><el-input-number v-model="settings.width" :min="1" :max="8192" controls-position="right" /></label>
                        <label><span>目标高度</span><el-input-number v-model="settings.height" :min="1" :max="8192" controls-position="right" /></label>
                        <label><span>适配方式</span><el-select v-model="settings.fit"><el-option label="完整保留" value="contain" /><el-option label="铺满裁切" value="cover" /><el-option label="拉伸" value="fill" /></el-select></label>
                    </template>
                    <template v-else-if="selectedTool.operation === 'crop'">
                        <label><span>裁剪比例</span><el-select v-model="settings.aspectRatio"><el-option v-for="ratio in ratios.slice(0, 7)" :key="ratio" :label="ratio" :value="ratio" /></el-select></label>
                    </template>
                    <template v-else-if="selectedTool.operation === 'rotate'">
                        <label><span>旋转角度</span><el-input-number v-model="settings.degrees" :min="-360" :max="360" :step="90" controls-position="right" /></label>
                    </template>
                    <template v-else-if="selectedTool.operation === 'flip'">
                        <label><span>翻转方向</span><el-select v-model="settings.flip"><el-option label="水平" value="horizontal" /><el-option label="垂直" value="vertical" /></el-select></label>
                    </template>
                    <template v-else-if="selectedTool.operation === 'convert'">
                        <label><span>输出格式</span><el-select v-model="settings.format"><el-option label="PNG" value="png" /><el-option label="JPEG" value="jpeg" /><el-option label="WebP" value="webp" /><el-option label="BMP" value="bmp" /></el-select></label>
                        <label><span>输出质量</span><el-input-number v-model="settings.quality" :min="1" :max="100" controls-position="right" /></label>
                    </template>
                    <template v-else-if="selectedTool.operation === 'merge'">
                        <label><span>拼图布局</span><el-select v-model="settings.mergeMode"><el-option label="宫格" value="grid" /><el-option label="横向" value="horizontal" /><el-option label="纵向" value="vertical" /><el-option label="图层覆盖" value="overlay" /></el-select></label>
                        <label v-if="settings.mergeMode === 'grid'"><span>每行列数</span><el-input-number v-model="settings.columns" :min="1" :max="4" controls-position="right" /></label>
                        <label><span>图片间距</span><el-input-number v-model="settings.gap" :min="0" :max="128" controls-position="right" /></label>
                    </template>
                    <template v-else-if="selectedTool.operation === 'grayscale'">
                        <label><span>黑白强度</span><el-slider v-model="settings.grayscaleStrength" :min="0" :max="100" /></label>
                    </template>
                    <template v-else-if="selectedTool.operation === 'remove-solid-background'">
                        <label><span>背景容差</span><el-slider v-model="settings.tolerance" :min="0" :max="100" /></label>
                        <label><span>边缘羽化</span><el-slider v-model="settings.feather" :min="0" :max="100" /></label>
                    </template>
                </div>

                <div class="studio-submit-row">
                    <el-button
                        type="primary"
                        size="large"
                        :icon="MagicStick"
                        :loading="running"
                        data-testid="ai-image-run"
                        @click="runSelectedTool"
                    >{{ running ? "正在处理" : selectedTool.actionLabel }}</el-button>
                    <el-button :icon="RefreshLeft" :disabled="running" @click="resetEditor">重置</el-button>
                    <small v-if="selectedTool.engine !== 'exact'">生成式编辑会重绘画面，不承诺逐像素保持；精确工具不会调用模型。</small>
                </div>
            </div>

            <aside class="result-panel" data-testid="ai-image-results">
                <div class="result-heading">
                    <div><span>OUTPUT</span><h2>生成结果</h2></div>
                    <small>{{ resultImages.length ? `${resultImages.length} 张` : "等待创作" }}</small>
                </div>
                <div v-if="running" class="result-loading">
                    <span></span><span></span><span></span>
                    <strong>{{ selectedTool.engine === "exact" ? "正在处理并写入 HDFS" : "MiniMax 正在创作" }}</strong>
                    <small>请勿重复提交，本次 RequestId 已锁定</small>
                </div>
                <div v-else-if="resultImages.length" class="result-grid">
                    <figure v-for="image in resultImages" :key="image.FileUrl">
                        <el-image :src="image.FileUrl" :preview-src-list="resultPreviewList" fit="contain" preview-teleported />
                        <figcaption>
                            <div><strong>{{ image.FileName }}</strong><small>{{ image.Width && image.Height ? `${image.Width} × ${image.Height}` : selectedTool.label }}</small></div>
                            <button type="button" aria-label="下载图片" @click="downloadResult(image)"><el-icon><Download /></el-icon></button>
                        </figcaption>
                    </figure>
                </div>
                <div v-else class="result-empty">
                    <div class="empty-canvas"><el-icon><Picture /></el-icon></div>
                    <strong>结果会出现在这里</strong>
                    <p>生成式结果和精确处理结果都会先写入当前租户 HDFS，再提供预览与下载。</p>
                </div>
                <div class="rights-note">
                    <el-icon><Lock /></el-icon>
                    <span>仅处理你拥有或已获授权的素材；“去水印”不应用于移除他人权利标识。</span>
                </div>
            </aside>
        </div>
    </section>
</template>

<script setup>
import { computed, getCurrentInstance, onBeforeUnmount, reactive, ref } from "vue";
import { CircleClose, Download, InfoFilled, Lock, MagicStick, Picture, Plus, RefreshLeft, UploadFilled } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";

const { proxy } = getCurrentInstance();
const DiyCommon = proxy.DiyCommon;

const categories = [
    { id: "create", label: "生成" },
    { id: "edit", label: "AI 编辑" },
    { id: "portrait", label: "人像商品" },
    { id: "exact", label: "精确处理" }
];
const baseTools = [
    { id: "text-to-image", category: "create", badge: "文", label: "文生图", short: "一句话生成画面", minFiles: 0, maxFiles: 0, engine: "minimax", operation: "text-to-image", description: "输入场景、主体、光线与风格，直接生成可下载图片。", placeholder: "例如：清晨薄雾中的未来东方城市，青绿色玻璃建筑，电影感光线，留出标题区域", suggestions: ["极简科技发布会主视觉，深蓝渐变背景，留出中文标题区域", "江南雨巷里的白色机器人，电影静帧，柔和体积光", "高端咖啡品牌产品海报，暖棕色调，真实摄影"] },
    { id: "sketch-to-image", category: "create", badge: "稿", label: "草图成图", short: "草图变完整设计", minFiles: 1, maxFiles: 1, engine: "minimax", operation: "sketch-to-image", description: "把草图或线稿作为主体参考，生成完整、干净的视觉方案。", placeholder: "说明材质、配色、场景和最终质感", promptPrefix: "参考上传的草图，保持核心构图和主体轮廓，生成完整成品。", suggestions: ["工业设计渲染，磨砂银金属与黑色玻璃", "扁平插画风，明亮配色，干净留白", "写实建筑效果图，傍晚暖光"] },
    { id: "poster", category: "create", badge: "报", label: "海报设计", short: "营销与活动主视觉", minFiles: 0, maxFiles: 0, engine: "minimax", operation: "poster", description: "生成带清晰视觉层级和可继续排版留白的海报底图。", placeholder: "活动主题、受众、颜色、构图与需要留白的位置", promptPrefix: "设计一张专业海报底图，不生成乱码文字，保留清晰标题和信息留白。", suggestions: ["AI 开发者大会，蓝紫霓虹，竖版海报", "夏季新品发布，清透浅绿，产品居中", "企业培训课程，稳重蓝灰，现代网格"] },
    { id: "logo", category: "create", badge: "标", label: "Logo 灵感", short: "品牌标志方向稿", minFiles: 0, maxFiles: 0, engine: "minimax", operation: "logo", description: "生成简洁的品牌标志方向稿，便于后续矢量重制。", placeholder: "品牌名称含义、行业、气质、偏好图形；建议不要求模型直接写文字", promptPrefix: "生成简洁、可识别、适合矢量重制的品牌标志图形，不包含乱码文字。", suggestions: ["低代码 AI 平台，模块与光束意象，蓝绿色", "自然护肤品牌，叶片与水滴，极简线条", "工业物联网，六边形与数据节点，稳重"] },
    { id: "image-to-image", category: "edit", badge: "图", label: "图生图", short: "参考主体生成新画面", minFiles: 1, maxFiles: 4, engine: "minimax", operation: "image-to-image", description: "基于一张或多张主体参考图生成新场景，适合人物/角色一致性创作。", placeholder: "描述希望保留的主体，以及新的场景、动作、服装、光线和风格", promptPrefix: "保留参考图中的主体身份与关键外观特征，", suggestions: ["置于现代图书馆窗边，柔和日光，纪实摄影", "改为东方赛博朋克夜景，半身构图", "户外品牌广告风，山地清晨，真实摄影"] },
    { id: "redraw", category: "edit", badge: "绘", label: "AI 重绘", short: "重做风格与质感", minFiles: 1, maxFiles: 1, engine: "minimax", operation: "redraw", description: "保留主体信息并重做画面质感、材质与视觉风格。", placeholder: "说明要保留什么、重绘成什么风格", promptPrefix: "保留参考主体和核心构图，重新绘制整张画面，", suggestions: ["吉卜力式温暖手绘动画质感", "高端商业摄影，真实皮肤与自然光", "中国传统工笔画，淡雅设色"] },
    { id: "upscale", category: "edit", badge: "清", label: "AI 高清放大", short: "细节增强到 2K", minFiles: 1, maxFiles: 1, engine: "minimax", operation: "upscale", description: "用参考重绘补充纹理和清晰度，并请求最高 2048 像素输出。", placeholder: "可补充希望重点增强的细节；留空则执行自然高清修复", promptPrefix: "保持参考图主体、构图、颜色和内容不变，进行高保真高清重绘，恢复细节、降低噪点和压缩痕迹。", suggestions: ["增强人物五官、发丝与服装纹理，保持自然", "增强商品边缘、材质与标签清晰度", "修复风景远处细节与天空层次"] },
    { id: "erase", category: "edit", badge: "消", label: "AI 消除", short: "移除指定对象", minFiles: 1, maxFiles: 1, engine: "minimax", operation: "erase", description: "描述需要消除的对象，模型会参考原主体重新生成自然背景。", placeholder: "例如：移除右下角的路人和桌面上的红色杯子，其余保持不变", promptPrefix: "参考原图重新生成画面，彻底移除用户指定对象并用自然背景补全，其余主体尽量保持。", suggestions: ["移除背景中的路人，保持主体人物不变", "移除桌面的杂物和线缆", "移除天空中的电线"] },
    { id: "outpaint", category: "edit", badge: "扩", label: "AI 扩图", short: "改变比例并补全画面", minFiles: 1, maxFiles: 1, engine: "minimax", operation: "outpaint", description: "选择新比例，让模型向画面外延展合理场景。", placeholder: "说明向外扩展后希望出现的环境与留白方向", promptPrefix: "保留参考图主体与中心内容，向画面边缘自然扩展完整场景，透视、光线和纹理连续。", suggestions: ["扩展为横版，主体位于左侧，右侧留出标题空间", "扩展为竖版，上方增加天空与留白", "四周扩展室内环境，保持原光线"] },
    { id: "remove-watermark", category: "edit", badge: "净", label: "AI 去水印", short: "授权素材清理", minFiles: 1, maxFiles: 1, engine: "minimax", operation: "remove-watermark", description: "对你拥有版权或已获授权的素材进行参考重绘，移除覆盖文字或标记。", placeholder: "说明水印/覆盖文字的位置，并确认你拥有处理权", promptPrefix: "仅针对已获授权素材参考重绘，移除画面上的水印、覆盖文字和标记，用周围纹理自然补全，", notice: "只可处理自有或已授权素材；生成式重绘并非取证级像素修复。", suggestions: ["移除右下角半透明标记，其余构图保持", "移除画面中部覆盖文字并补全背景纹理", "清理四周模板文字和辅助线"] },
    { id: "background-replace", category: "edit", badge: "景", label: "AI 换背景", short: "主体放入新场景", minFiles: 1, maxFiles: 2, engine: "minimax", operation: "background-replace", description: "保留主体并替换成指定环境、光线与氛围。", placeholder: "例如：换成明亮极简办公室，窗外城市晨景，光线方向与人物一致", promptPrefix: "保留参考图主体身份、姿态和关键细节，只替换背景为：", suggestions: ["纯净浅灰摄影棚，自然柔光", "现代办公室落地窗，清晨城市景观", "户外森林小径，黄金时刻逆光"] },
    { id: "style-transfer", category: "edit", badge: "风", label: "风格迁移", short: "转换艺术风格", minFiles: 1, maxFiles: 2, engine: "minimax", operation: "style-transfer", description: "第一张作为主体，第二张可作为额外风格/角色参考。", placeholder: "描述目标画风、笔触、色板与媒介", promptPrefix: "保留第一张参考图的主体与构图，将视觉语言转换为：", suggestions: ["法国印象派油画，厚涂笔触，柔和高光", "日系赛璐璐动画，清晰线条，明亮色块", "黏土定格动画，微缩模型质感"] },
    { id: "colorize", category: "edit", badge: "彩", label: "AI 黑白上色", short: "老照片自然着色", minFiles: 1, maxFiles: 1, engine: "minimax", operation: "colorize", description: "依据场景语义为黑白照片生成自然、克制的颜色。", placeholder: "可说明年代、地点、服装或希望使用的色调", promptPrefix: "保留参考黑白照片的主体、构图、时代细节和面部特征，自然上色，避免过饱和，", suggestions: ["符合 1980 年代中国城市真实色彩", "自然肤色与复古胶片色调", "低饱和纪实色彩，修复轻微划痕"] },
    { id: "restore", category: "edit", badge: "修", label: "老照片修复", short: "降噪、补损与清晰化", minFiles: 1, maxFiles: 1, engine: "minimax", operation: "restore", description: "参考重绘破损、划痕、褪色与模糊区域，尽量保持人物身份。", placeholder: "说明主要问题和要保留的时代质感", promptPrefix: "高保真修复参考老照片，保持人物身份、姿态和时代特征，去除划痕、折痕、噪点并恢复自然细节，", suggestions: ["修复面部划痕和整体褪色，保留胶片颗粒", "提升清晰度但不要过度磨皮", "补全破损边角，保持原始构图"] },
    { id: "remove-background", category: "edit", badge: "抠", label: "AI 抠图", short: "主体隔离并透明化", minFiles: 1, maxFiles: 1, engine: "hybrid", operation: "remove-background", postProcess: "remove-solid-background", description: "先由 AI 把主体隔离到纯白背景，再用 V8.Image 做透明化收尾，输出 PNG。", placeholder: "说明要保留的主体以及容易混淆的边缘（头发、透明物、细线等）", promptPrefix: "只保留参考图主要主体，完整保留轮廓和细节，移除所有背景、阴影和文字，主体居中置于绝对纯白背景，边缘清晰，", suggestions: ["保留人物及发丝边缘，移除全部背景", "保留商品和自然投影以外的主体轮廓", "保留宠物毛发细节，背景完全纯白"] },
    { id: "id-photo", category: "portrait", badge: "证", label: "AI 证件照", short: "规范人像与底色", minFiles: 1, maxFiles: 1, engine: "minimax", operation: "id-photo", description: "保持人物身份特征，生成端正、自然、符合常见证件照构图的人像。", placeholder: "选择背景色、服装、尺寸用途；例如蓝底、深色西装、一寸构图", promptPrefix: "严格保持参考人物身份和自然五官，生成正面证件照：双肩水平、目视镜头、表情自然、均匀布光、清晰边缘，", notice: "结果适合设计预览；正式证照请按办证机构规范人工复核尺寸、背景色和真实性。", suggestions: ["浅蓝纯色背景，深色西装白衬衫，一寸构图", "纯白背景，商务休闲服，头肩居中", "红色纯色背景，衬衫整洁，自然肤色"] },
    { id: "portrait-retouch", category: "portrait", badge: "颜", label: "人像精修", short: "自然肤质与光线", minFiles: 1, maxFiles: 1, engine: "minimax", operation: "portrait-retouch", description: "改善肤色、光线和小瑕疵，同时避免塑料感和身份漂移。", placeholder: "说明希望改善的细节和保留的特征", promptPrefix: "保持参考人物身份、五官比例和真实肤质，进行克制自然的人像精修，", suggestions: ["均匀肤色、减淡黑眼圈，保留皮肤纹理", "修正偏色与逆光，保持自然轮廓", "商务头像质感，干净但不过度磨皮"] },
    { id: "avatar", category: "portrait", badge: "头", label: "AI 头像", short: "多风格个人头像", minFiles: 1, maxFiles: 1, engine: "minimax", operation: "avatar", description: "基于人物参考生成适合社交、团队或品牌使用的方形头像。", placeholder: "说明职业、背景、服装、风格和气质", promptPrefix: "保持参考人物身份，生成方形高质量头像，面部清晰、构图干净，", suggestions: ["科技公司创始人风格，深蓝背景，柔和侧光", "友好产品经理头像，浅灰背景，自然微笑", "3D 黏土风头像，简洁纯色背景"] },
    { id: "product-scene", category: "portrait", badge: "商", label: "商品场景图", short: "商品融入商业布景", minFiles: 1, maxFiles: 4, engine: "minimax", operation: "product-scene", description: "保持商品关键外观，生成电商主图、生活方式或广告场景。", placeholder: "说明商品、目标场景、材质、光线和构图", promptPrefix: "保持参考商品的形状、颜色、标识位置和关键材质，生成专业商业摄影场景，", suggestions: ["纯白电商主图，柔和投影，正面居中", "高级石材台面，晨光，护肤品广告", "户外露营生活方式场景，真实自然光"] },
    { id: "multi-composite", category: "portrait", badge: "合", label: "多图合成", short: "多个主体进入同一画面", minFiles: 2, maxFiles: 4, engine: "minimax", operation: "multi-composite", description: "把多张参考图中的主体组织到一个统一场景，统一透视、光线和色调。", placeholder: "说明每个主体的位置、关系、动作与最终场景", promptPrefix: "同时保留多张参考图中的主要主体，把它们自然合成到同一个画面，统一透视、尺度、光线和色调，", suggestions: ["两个人并肩站在现代办公室，半身合影，自然光", "把三件商品摆在同一摄影台，主次清晰", "角色共同出现在未来城市街道，电影构图"] },
    { id: "relight", category: "portrait", badge: "光", label: "AI 布光", short: "重做光线和氛围", minFiles: 1, maxFiles: 1, engine: "minimax", operation: "relight", description: "保留主体，重新设计光源方向、软硬度、色温和背景氛围。", placeholder: "例如：左侧柔和窗光，暖色轮廓光，背景稍暗", promptPrefix: "保留参考主体和构图，只重新设计专业灯光与色调：", suggestions: ["左侧大面积柔光，右侧轻微轮廓光，电影感", "明亮自然窗光，干净商业摄影", "蓝橙双色舞台光，背景低调"] },
    { id: "exact-upscale", category: "exact", badge: "倍", label: "精确放大", short: "不重绘的尺寸放大", minFiles: 1, maxFiles: 1, engine: "exact", operation: "resize", description: "使用跨平台高质量缩放，像素内容不经模型重绘，适合尺寸交付。", uploadHint: "上传要精确缩放的图片", suggestions: [] },
    { id: "grayscale", category: "exact", badge: "黑", label: "彩色转黑白", short: "可调黑白强度", minFiles: 1, maxFiles: 1, engine: "exact", operation: "grayscale", description: "按标准亮度矩阵转换黑白并保留透明通道。", uploadHint: "上传彩色图片", suggestions: [] },
    { id: "solid-cutout", category: "exact", badge: "透", label: "纯色背景抠图", short: "透明 PNG 快速输出", minFiles: 1, maxFiles: 1, engine: "exact", operation: "remove-solid-background", description: "识别四角主色并透明化，适合纯白、纯灰或棚拍纯色背景。复杂背景请用“AI 抠图”。", uploadHint: "上传纯色背景图片", suggestions: [] },
    { id: "smart-crop", category: "exact", badge: "裁", label: "居中裁剪", short: "按比例安全裁切", minFiles: 1, maxFiles: 1, engine: "exact", operation: "crop", description: "按目标比例从中心裁切，服务端回读真实尺寸并防止越界。", uploadHint: "上传要裁剪的图片", suggestions: [] },
    { id: "rotate", category: "exact", badge: "转", label: "旋转图片", short: "画布自动扩展", minFiles: 1, maxFiles: 1, engine: "exact", operation: "rotate", description: "按指定角度旋转并自动扩展画布，避免内容被裁掉。", uploadHint: "上传要旋转的图片", suggestions: [] },
    { id: "flip", category: "exact", badge: "翻", label: "镜像翻转", short: "水平或垂直", minFiles: 1, maxFiles: 1, engine: "exact", operation: "flip", description: "执行水平或垂直镜像，不调用模型、不改变主体细节。", uploadHint: "上传要翻转的图片", suggestions: [] },
    { id: "convert", category: "exact", badge: "格", label: "格式转换", short: "PNG / JPEG / WebP / BMP", minFiles: 1, maxFiles: 1, engine: "exact", operation: "convert", description: "转换编码格式与质量；透明图片转 JPEG 时使用白色背景。", uploadHint: "上传要转换的图片", suggestions: [] },
    { id: "collage", category: "exact", badge: "拼", label: "多图拼接", short: "宫格、横向、纵向或覆盖", minFiles: 2, maxFiles: 12, engine: "exact", operation: "merge", description: "最多 12 张图片，按明确布局、间距和画布规则生成一张成品。", uploadHint: "按显示顺序选择多张图片", suggestions: [] }
];
const categoryName = Object.fromEntries(categories.map((item) => [item.id, item.label]));
const tools = baseTools.map((tool) => ({
    uploadHint: "上传主体清晰、无遮挡的参考图片",
    promptPrefix: "",
    suggestions: [],
    actionLabel: tool.engine === "exact" ? "开始精确处理" : "开始 AI 创作",
    engineLabel: tool.engine === "exact" ? "V8.Image · 不消耗模型额度" : (tool.engine === "hybrid" ? "MiniMax + V8.Image" : "MiniMax image-01"),
    categoryLabel: categoryName[tool.category],
    ...tool
}));

const ratios = ["1:1", "16:9", "4:3", "3:2", "2:3", "3:4", "9:16", "21:9"];
const activeCategory = ref("create");
const selectedToolId = ref("text-to-image");
const promptText = ref("");
const studioFileInputRef = ref(null);
const sourceFiles = ref([]);
const resultImages = ref([]);
const running = ref(false);
const settings = reactive({
    aspectRatio: "1:1",
    count: 1,
    width: 2048,
    height: 2048,
    fit: "contain",
    degrees: 90,
    flip: "horizontal",
    format: "png",
    quality: 92,
    mergeMode: "grid",
    columns: 2,
    gap: 12,
    grayscaleStrength: 100,
    tolerance: 36,
    feather: 24
});

const visibleTools = computed(() => tools.filter((tool) => tool.category === activeCategory.value));
const selectedTool = computed(() => tools.find((tool) => tool.id === selectedToolId.value) || tools[0]);
const resultPreviewList = computed(() => resultImages.value.map((item) => item.FileUrl).filter(Boolean));

function toolCount(categoryId) {
    return tools.filter((tool) => tool.category === categoryId).length;
}

function selectTool(toolOrId) {
    const tool = typeof toolOrId === "string" ? tools.find((item) => item.id === toolOrId) : toolOrId;
    if (!tool) return;
    selectedToolId.value = tool.id;
    activeCategory.value = tool.category;
    promptText.value = "";
    resultImages.value = [];
    trimFiles(tool.maxFiles);
}

function trimFiles(maxFiles) {
    while (sourceFiles.value.length > maxFiles) {
        const removed = sourceFiles.value.pop();
        URL.revokeObjectURL(removed.previewUrl);
    }
}

function handleFiles(event) {
    const candidates = Array.from(event.target.files || []);
    event.target.value = "";
    const remaining = selectedTool.value.maxFiles - sourceFiles.value.length;
    for (const file of candidates.slice(0, Math.max(0, remaining))) {
        if (!/^image\/(?:jpeg|png|webp)$/i.test(file.type)) {
            ElMessage.warning(`${file.name} 不是支持的图片格式`);
            continue;
        }
        if (file.size > 10 * 1024 * 1024) {
            ElMessage.warning(`${file.name} 超过 10MB`);
            continue;
        }
        sourceFiles.value.push({
            key: `${file.name}:${file.size}:${file.lastModified}:${Math.random()}`,
            file,
            previewUrl: URL.createObjectURL(file)
        });
    }
    if (candidates.length > remaining) ElMessage.warning(`当前工具最多上传 ${selectedTool.value.maxFiles} 张图片`);
}

function removeFile(index) {
    const [removed] = sourceFiles.value.splice(index, 1);
    if (removed) URL.revokeObjectURL(removed.previewUrl);
}

function resetEditor() {
    sourceFiles.value.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    sourceFiles.value = [];
    resultImages.value = [];
    promptText.value = "";
    settings.aspectRatio = "1:1";
    settings.count = 1;
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function makeRequestId() {
    const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `image-studio:${random}`.replace(/[^a-zA-Z0-9._:-]/g, "-").slice(0, 160);
}

function unwrapDosResult(result) {
    let current = result || {};
    if (current?.Data && typeof current.Data === "object" && current.Data.Code !== undefined) current = current.Data;
    if (current?.data && typeof current.data === "object" && current.data.Code !== undefined) current = current.data;
    return current;
}

function buildPrompt(tool) {
    const userPrompt = promptText.value.trim();
    return `${tool.promptPrefix || ""}${userPrompt || defaultPrompt(tool.id)}`.trim().slice(0, 1500);
}

function defaultPrompt(toolId) {
    const defaults = {
        upscale: "保持原画面内容，高保真增强纹理、边缘和自然细节。",
        "remove-background": "准确保留主要主体及细小边缘。",
        restore: "自然修复损伤并保持原始人物与时代质感。",
        redraw: "提升整体完成度与画面质感。"
    };
    return defaults[toolId] || "根据参考主体生成专业、自然、细节完整的画面。";
}

function upscaleDimensions(ratio) {
    const map = {
        "1:1": [2048, 2048], "16:9": [2048, 1152], "4:3": [2048, 1536], "3:2": [2048, 1368],
        "2:3": [1368, 2048], "3:4": [1536, 2048], "9:16": [1152, 2048], "21:9": [2048, 880]
    };
    return map[ratio] || map["1:1"];
}

async function runSelectedTool() {
    const tool = selectedTool.value;
    if (sourceFiles.value.length < tool.minFiles) {
        ElMessage.warning(`请先上传至少 ${tool.minFiles} 张参考图`);
        return;
    }
    if (tool.engine !== "exact" && tool.id === "text-to-image" && !promptText.value.trim()) {
        ElMessage.warning("请先描述你想生成的画面");
        return;
    }
    running.value = true;
    resultImages.value = [];
    try {
        const images = await Promise.all(sourceFiles.value.map(async (item) => ({
            FileName: item.file.name,
            DataUrl: await fileToDataUrl(item.file)
        })));
        if (tool.engine === "exact") await runExactTool(tool, images);
        else await runMiniMaxTool(tool, images);
    } catch (error) {
        ElMessage.error(error?.message || "图片处理失败");
    } finally {
        running.value = false;
    }
}

async function runMiniMaxTool(tool, images) {
    const body = {
        RequestId: makeRequestId(),
        Prompt: buildPrompt(tool),
        Model: "image-01",
        AspectRatio: settings.aspectRatio,
        Count: tool.id === "upscale" ? 1 : settings.count,
        Operation: tool.operation,
        ReferenceImages: images,
        PostProcess: tool.postProcess || ""
    };
    if (tool.id === "upscale") {
        [body.Width, body.Height] = upscaleDimensions(settings.aspectRatio);
    }
    const response = await fetch(`${DiyCommon.GetApiBase()}/api/Ai/GenerateMiniMaxImage`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            authorization: DiyCommon.getToken() ? `Bearer ${DiyCommon.getToken()}` : ""
        },
        body: JSON.stringify(body)
    });
    let result;
    try { result = await response.json(); } catch { throw new Error(`图片服务响应无法解析（HTTP ${response.status}）`); }
    const current = unwrapDosResult(result);
    if (!response.ok || Number(current?.Code ?? current?.code) !== 1) throw new Error(current?.Msg || current?.msg || "AI 图片生成失败");
    const data = current.Data || current.data || {};
    resultImages.value = (Array.isArray(data.Images) ? data.Images : []).map((item) => ({ ...item, Width: data.Width, Height: data.Height }));
    if (!resultImages.value.length) throw new Error("AI 已响应，但没有返回可展示的 HDFS 图片");
    ElMessage.success(data.Replayed === true ? "已返回同一请求的既有结果" : "图片已生成并写入 HDFS");
}

function exactOptions(tool) {
    const common = { OutputFormat: settings.format, Quality: settings.quality };
    if (tool.operation === "resize") return { ...common, Width: settings.width, Height: settings.height, Fit: settings.fit, AllowUpscale: true };
    if (tool.operation === "crop") return { ...common, AspectRatio: settings.aspectRatio };
    if (tool.operation === "rotate") return { ...common, Degrees: settings.degrees, Expand: true, BackgroundColor: "transparent" };
    if (tool.operation === "flip") return { ...common, Horizontal: settings.flip === "horizontal", Vertical: settings.flip === "vertical" };
    if (tool.operation === "merge") return { ...common, Mode: settings.mergeMode, Columns: settings.columns, Gap: settings.gap, Padding: settings.gap };
    if (tool.operation === "grayscale") return { ...common, Strength: settings.grayscaleStrength / 100 };
    if (tool.operation === "remove-solid-background") return { OutputFormat: "png", Tolerance: settings.tolerance, Feather: settings.feather };
    return common;
}

async function runExactTool(tool, images) {
    const response = await fetch(`${DiyCommon.GetApiBase()}/apiengine/platform-ai-runtime`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            authorization: DiyCommon.getToken() ? `Bearer ${DiyCommon.getToken()}` : ""
        },
        body: JSON.stringify({ Action: "ProcessImage", Operation: tool.operation, Images: images, Options: exactOptions(tool) })
    });
    let result;
    try { result = await response.json(); } catch { throw new Error(`图片处理响应无法解析（HTTP ${response.status}）`); }
    const current = unwrapDosResult(result);
    if (!response.ok || Number(current?.Code ?? current?.code) !== 1) throw new Error(current?.Msg || current?.msg || "精确图片处理失败");
    const data = current.Data || current.data || {};
    resultImages.value = [data];
    ElMessage.success("图片已处理并写入 HDFS");
}

function downloadResult(image) {
    const link = document.createElement("a");
    link.href = image.FileUrl;
    link.download = image.FileName || "ai-image";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
}

onBeforeUnmount(() => sourceFiles.value.forEach((item) => URL.revokeObjectURL(item.previewUrl)));

defineExpose({ selectTool });
</script>

<style scoped>
.image-studio { min-height: 100%; padding: 24px; background: var(--el-bg-color-page, #f4f6f8); color: var(--el-text-color-primary, #162033); }
.studio-hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; max-width: 1540px; margin: 0 auto 18px; }
.studio-hero h1 { margin: 5px 0 7px; font-size: clamp(25px, 2.4vw, 36px); line-height: 1.15; letter-spacing: -.03em; }
.studio-hero p { max-width: 720px; margin: 0; color: var(--el-text-color-secondary); font-size: 14px; line-height: 1.65; }
.studio-kicker { color: var(--el-color-primary); font-size: 11px; font-weight: 800; letter-spacing: .13em; }
.studio-trust { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 7px; }
.studio-trust span { padding: 6px 10px; border: 1px solid var(--el-border-color-light); border-radius: 999px; background: var(--el-bg-color); color: var(--el-text-color-secondary); font-size: 11px; }
.studio-shell { display: grid; grid-template-columns: 260px minmax(440px, 1fr) minmax(300px, 390px); min-height: 640px; max-width: 1540px; margin: 0 auto; overflow: hidden; border: 1px solid var(--el-border-color-lighter); border-radius: 18px; background: var(--el-bg-color); box-shadow: 0 18px 45px rgba(15, 23, 42, .07); }
.tool-browser { min-width: 0; border-right: 1px solid var(--el-border-color-lighter); background: color-mix(in srgb, var(--el-bg-color-page, #f4f6f8) 60%, var(--el-bg-color)); }
.tool-category-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 14px; border-bottom: 1px solid var(--el-border-color-lighter); }
.tool-category-tabs button { display: flex; align-items: center; justify-content: space-between; min-height: 34px; padding: 0 9px; border: 0; border-radius: 8px; background: transparent; color: var(--el-text-color-secondary); cursor: pointer; font-size: 12px; }
.tool-category-tabs button small { color: var(--el-text-color-placeholder); }
.tool-category-tabs button:hover, .tool-category-tabs button.active { background: var(--el-color-primary-light-9); color: var(--el-color-primary); }
.tool-list { max-height: 670px; overflow: auto; padding: 8px; }
.tool-row { display: grid; grid-template-columns: 30px minmax(0, 1fr) auto; align-items: center; width: 100%; gap: 9px; padding: 9px 8px; border: 0; border-radius: 9px; background: transparent; color: inherit; text-align: left; cursor: pointer; }
.tool-row:hover { background: color-mix(in srgb, var(--el-color-primary-light-9) 58%, transparent); }
.tool-row.active { background: var(--el-color-primary-light-9); box-shadow: inset 2px 0 var(--el-color-primary); }
.tool-badge { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 8px; background: var(--el-bg-color); color: var(--el-color-primary); font-size: 12px; font-weight: 800; box-shadow: inset 0 0 0 1px var(--el-border-color-lighter); }
.tool-row strong, .tool-row small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tool-row strong { font-size: 13px; line-height: 1.5; }
.tool-row small { color: var(--el-text-color-placeholder); font-size: 10px; line-height: 1.4; }
.tool-row em { color: var(--el-text-color-placeholder); font-size: 9px; font-style: normal; }
.tool-editor { min-width: 0; padding: 24px 26px; }
.tool-title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; padding-bottom: 18px; border-bottom: 1px solid var(--el-border-color-lighter); }
.tool-title-row span { color: var(--el-color-primary); font-size: 11px; font-weight: 700; }
.tool-title-row h2 { margin: 4px 0 6px; font-size: 23px; }
.tool-title-row p { margin: 0; color: var(--el-text-color-secondary); font-size: 13px; line-height: 1.6; }
.tool-title-row .engine-pill { flex: none; padding: 6px 9px; border-radius: 999px; background: var(--el-fill-color-light); color: var(--el-text-color-secondary); font-size: 10px; }
.tool-notice { display: flex; align-items: flex-start; gap: 8px; margin-top: 14px; padding: 10px 12px; border-radius: 9px; background: var(--el-color-warning-light-9); color: var(--el-color-warning-dark-2); font-size: 12px; line-height: 1.55; }
.reference-section, .prompt-section { margin-top: 20px; }
.field-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 8px; }
.field-heading label { font-size: 13px; font-weight: 700; }
.field-heading span { color: var(--el-text-color-placeholder); font-size: 10px; }
.hidden-file-input { display: none; }
.upload-dropzone { display: grid; place-items: center; width: 100%; min-height: 132px; padding: 20px; border: 1px dashed var(--el-border-color); border-radius: 12px; background: var(--el-fill-color-extra-light); color: var(--el-text-color-secondary); cursor: pointer; }
.upload-dropzone:hover { border-color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
.upload-dropzone .el-icon { margin-bottom: 8px; color: var(--el-color-primary); font-size: 26px; }
.upload-dropzone strong { font-size: 13px; }
.upload-dropzone small { margin-top: 5px; color: var(--el-text-color-placeholder); font-size: 10px; }
.source-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 9px; }
.source-grid figure { position: relative; min-width: 0; margin: 0; overflow: hidden; border: 1px solid var(--el-border-color-lighter); border-radius: 10px; background: var(--el-fill-color-light); }
.source-grid img { display: block; width: 100%; height: 88px; object-fit: cover; }
.source-grid figcaption { overflow: hidden; padding: 6px 7px; color: var(--el-text-color-secondary); font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.source-grid figure > button { position: absolute; top: 5px; right: 5px; display: grid; place-items: center; width: 24px; height: 24px; border: 0; border-radius: 50%; background: rgba(15, 23, 42, .72); color: white; cursor: pointer; }
.source-add { min-height: 116px; border: 1px dashed var(--el-border-color); border-radius: 10px; background: transparent; color: var(--el-text-color-secondary); cursor: pointer; }
.source-add .el-icon, .source-add span { display: block; margin: 3px auto; }
.prompt-suggestions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.prompt-suggestions button { max-width: 100%; overflow: hidden; padding: 5px 8px; border: 1px solid var(--el-border-color-lighter); border-radius: 6px; background: transparent; color: var(--el-text-color-secondary); cursor: pointer; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.prompt-suggestions button:hover { border-color: var(--el-color-primary-light-5); color: var(--el-color-primary); }
.studio-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 18px; }
.studio-options label { min-width: 0; }
.studio-options label > span { display: block; margin-bottom: 6px; color: var(--el-text-color-regular); font-size: 11px; font-weight: 600; }
.studio-options :deep(.el-select), .studio-options :deep(.el-input-number) { width: 100%; }
.studio-submit-row { display: flex; align-items: center; gap: 9px; margin-top: 24px; padding-top: 18px; border-top: 1px solid var(--el-border-color-lighter); }
.studio-submit-row small { margin-left: auto; max-width: 260px; color: var(--el-text-color-placeholder); font-size: 10px; line-height: 1.5; text-align: right; }
.result-panel { display: flex; min-width: 0; flex-direction: column; padding: 20px; border-left: 1px solid var(--el-border-color-lighter); background: #111722; color: #eef3fb; }
.result-heading { display: flex; align-items: center; justify-content: space-between; }
.result-heading span { color: #73a7ff; font-size: 10px; font-weight: 800; letter-spacing: .14em; }
.result-heading h2 { margin: 3px 0 0; font-size: 18px; }
.result-heading small { color: #8f9db1; font-size: 10px; }
.result-empty, .result-loading { display: grid; place-items: center; flex: 1; min-height: 360px; padding: 24px; text-align: center; }
.empty-canvas { display: grid; place-items: center; width: 150px; height: 150px; border: 1px dashed #435067; border-radius: 20px; background: radial-gradient(circle at 50% 30%, rgba(73, 128, 226, .24), transparent 66%); }
.empty-canvas .el-icon { color: #7fa5de; font-size: 36px; }
.result-empty strong { margin-top: -30px; font-size: 13px; }
.result-empty p { max-width: 250px; margin: -45px 0 0; color: #8f9db1; font-size: 11px; line-height: 1.65; }
.result-loading { align-content: center; grid-template-columns: repeat(3, 7px); column-gap: 6px; }
.result-loading > span { width: 7px; height: 7px; border-radius: 50%; background: #73a7ff; animation: studioPulse 1.2s infinite ease-in-out; }
.result-loading > span:nth-child(2) { animation-delay: .15s; }.result-loading > span:nth-child(3) { animation-delay: .3s; }
.result-loading strong, .result-loading small { grid-column: 1 / -1; }
.result-loading strong { margin-top: 16px; font-size: 13px; }.result-loading small { margin-top: 7px; color: #8f9db1; font-size: 10px; }
.result-grid { display: grid; align-content: start; gap: 12px; flex: 1; max-height: 590px; margin-top: 16px; overflow: auto; }
.result-grid figure { margin: 0; overflow: hidden; border: 1px solid #303a49; border-radius: 12px; background: #0a0f17; }
.result-grid :deep(.el-image) { display: block; width: 100%; min-height: 230px; max-height: 380px; background: linear-gradient(45deg, #121a26 25%, #192331 25%, #192331 50%, #121a26 50%, #121a26 75%, #192331 75%); background-size: 20px 20px; }
.result-grid figcaption { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; }
.result-grid figcaption strong, .result-grid figcaption small { display: block; max-width: 230px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.result-grid figcaption strong { font-size: 11px; }.result-grid figcaption small { margin-top: 2px; color: #8f9db1; font-size: 9px; }
.result-grid figcaption button { display: grid; place-items: center; width: 30px; height: 30px; border: 1px solid #3a4658; border-radius: 8px; background: transparent; color: #d7e3f5; cursor: pointer; }
.rights-note { display: flex; align-items: flex-start; gap: 7px; margin-top: 14px; padding-top: 13px; border-top: 1px solid #293344; color: #78869a; font-size: 9px; line-height: 1.5; }
@keyframes studioPulse { 0%, 80%, 100% { transform: scale(.72); opacity: .45; } 40% { transform: scale(1); opacity: 1; } }
@media (max-width: 1180px) { .studio-shell { grid-template-columns: 230px minmax(430px, 1fr); }.result-panel { grid-column: 1 / -1; min-height: 430px; border-top: 1px solid var(--el-border-color-lighter); border-left: 0; }.result-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }.result-empty, .result-loading { min-height: 260px; } }
@media (max-width: 760px) { .image-studio { padding: 14px; }.studio-hero { align-items: flex-start; flex-direction: column; }.studio-trust { justify-content: flex-start; }.studio-shell { display: block; border-radius: 14px; }.tool-browser { border-right: 0; border-bottom: 1px solid var(--el-border-color-lighter); }.tool-category-tabs { grid-template-columns: repeat(4, minmax(0, 1fr)); }.tool-category-tabs button { justify-content: center; padding: 0 4px; }.tool-category-tabs button small { display: none; }.tool-list { display: flex; max-height: none; overflow-x: auto; padding: 7px; }.tool-row { flex: 0 0 170px; }.tool-editor { padding: 20px 16px; }.tool-title-row { flex-direction: column; }.studio-options { grid-template-columns: 1fr; }.studio-submit-row { align-items: stretch; flex-direction: column; }.studio-submit-row small { margin: 4px 0 0; text-align: left; }.result-panel { min-height: 420px; }.result-grid { grid-template-columns: 1fr; } }
</style>
