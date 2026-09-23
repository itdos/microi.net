// 子应用只能声明纯文本标题/标签/动作标识；不接收跨 iframe 的函数或 HTML。
export function normalizeDialogHeader(value) {
    const input = value && typeof value === "object" ? value : {};
    const text = (item, length) => String(item == null ? "" : item).trim().slice(0, length);
    const tags = Array.isArray(input.tags || input.Tags) ? (input.tags || input.Tags) : [];
    const actions = Array.isArray(input.actions || input.Actions) ? (input.actions || input.Actions) : [];
    return {
        title: text(input.title || input.Title, 160),
        tags: tags.slice(0, 6).map((tag) => ({
            text: text(typeof tag === "string" ? tag : tag?.text || tag?.Text, 50),
            tone: ["success", "warning", "danger", "info"].includes(tag?.tone || tag?.Tone) ? (tag.tone || tag.Tone) : "info"
        })).filter((tag) => tag.text),
        actions: actions.slice(0, 8).map((action) => ({
            id: text(action?.id || action?.Id, 80),
            text: text(action?.text || action?.Text || action?.name || action?.Name, 50),
            tone: ["primary", "success", "danger", "default"].includes(action?.tone || action?.Tone) ? (action.tone || action.Tone) : "default",
            disabled: action?.disabled === true || action?.Disabled === true
        })).filter((action) => /^[A-Za-z][A-Za-z0-9_-]*$/.test(action.id) && action.text)
    };
}
