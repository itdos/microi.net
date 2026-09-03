export const AI_IMAGE_TOOL_CATEGORIES = Object.freeze({
    create: "创意生成",
    edit: "AI 编辑",
    portrait: "人像商品",
    exact: "精确处理"
});

// 首屏能力目录只保存导航所需的稳定元数据；具体参数、提示词和执行规则
// 仍由 ai-image-studio.vue 负责。测试会校验两端工具 Id 完整一致。
export const AI_IMAGE_TOOL_DIRECTORY = Object.freeze([
    { id: "text-to-image", category: "create", badge: "文", label: "文生图", short: "文字生成画面" },
    { id: "sketch-to-image", category: "create", badge: "稿", label: "草图成图", short: "线稿变成品" },
    { id: "poster", category: "create", badge: "报", label: "海报设计", short: "营销主视觉" },
    { id: "logo", category: "create", badge: "标", label: "Logo 灵感", short: "品牌方向稿" },
    { id: "image-to-image", category: "edit", badge: "图", label: "图生图", short: "参考图创作" },
    { id: "redraw", category: "edit", badge: "绘", label: "AI 重绘", short: "重做风格质感" },
    { id: "upscale", category: "edit", badge: "清", label: "AI 高清放大", short: "智能补充细节" },
    { id: "erase", category: "edit", badge: "消", label: "AI 消除", short: "移除指定对象" },
    { id: "outpaint", category: "edit", badge: "扩", label: "AI 扩图", short: "补全画面边界" },
    { id: "remove-watermark", category: "edit", badge: "净", label: "AI 去水印", short: "授权素材清理" },
    { id: "background-replace", category: "edit", badge: "景", label: "AI 换背景", short: "主体融入新场景" },
    { id: "style-transfer", category: "edit", badge: "风", label: "风格迁移", short: "转换艺术风格" },
    { id: "colorize", category: "edit", badge: "彩", label: "黑白上色", short: "老照片自然着色" },
    { id: "restore", category: "edit", badge: "修", label: "老照片修复", short: "补损降噪清晰化" },
    { id: "remove-background", category: "edit", badge: "抠", label: "AI 抠图", short: "复杂背景透明化" },
    { id: "id-photo", category: "portrait", badge: "证", label: "AI 证件照", short: "规范人像与底色" },
    { id: "portrait-retouch", category: "portrait", badge: "颜", label: "人像精修", short: "自然肤质与光线" },
    { id: "avatar", category: "portrait", badge: "头", label: "AI 头像", short: "多风格个人头像" },
    { id: "product-scene", category: "portrait", badge: "商", label: "商品场景图", short: "商业布景生成" },
    { id: "multi-composite", category: "portrait", badge: "合", label: "多图合成", short: "多主体统一画面" },
    { id: "relight", category: "portrait", badge: "光", label: "AI 布光", short: "重做光线氛围" },
    { id: "exact-upscale", category: "exact", badge: "倍", label: "精确放大", short: "不重绘改尺寸" },
    { id: "grayscale", category: "exact", badge: "黑", label: "彩色转黑白", short: "可调黑白强度" },
    { id: "solid-cutout", category: "exact", badge: "透", label: "纯色背景抠图", short: "快速透明 PNG" },
    { id: "smart-crop", category: "exact", badge: "裁", label: "居中裁剪", short: "按比例安全裁切" },
    { id: "rotate", category: "exact", badge: "转", label: "旋转图片", short: "画布自动扩展" },
    { id: "flip", category: "exact", badge: "翻", label: "镜像翻转", short: "水平或垂直" },
    { id: "convert", category: "exact", badge: "格", label: "格式转换", short: "PNG / JPEG / WebP" },
    { id: "collage", category: "exact", badge: "拼", label: "多图拼接", short: "宫格横向与纵向" }
]);

export const AI_IMAGE_PRIMARY_TOOLS = Object.freeze([
    "text-to-image",
    "image-to-image",
    "redraw",
    "upscale",
    "erase",
    "outpaint",
    "remove-background",
    "id-photo"
]);
