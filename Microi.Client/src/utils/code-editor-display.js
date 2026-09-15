export const DEFAULT_CODE_BUTTON_TEXT = '编辑代码（{{charCount}}字）';

// 显式字段配置优先；Mini 属性只兼容设计器临时构造的未配置编辑器。
export function isCodeEditorDialog(config = {}, mini = false) {
    const mode = String(config.DisplayMode || '').trim().toLowerCase();
    if (mode === 'inline') return false;
    if (['dialog', 'button', 'mini'].includes(mode)) return true;
    return mode ? false : mini === true;
}

export function codeEditorButtonText(value, template) {
    const code = String(value ?? '');
    const variables = { charCount: Array.from(code).length, lineCount: code ? code.split(/\r\n|\r|\n/).length : 0 };
    // 只做两个文本变量替换，不执行表达式，也不把用户文案作为 HTML。
    return (typeof template === 'string' && template.trim() ? template : DEFAULT_CODE_BUTTON_TEXT)
        .replace(/\{\{\s*(charCount|lineCount)\s*\}\}/g, (_, key) => variables[key]);
}
