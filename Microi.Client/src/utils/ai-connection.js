// 与官网 ai-apiengine.md 的推荐提示词保持一致；详细规则仍以工作区 Skills 为准。
// 这是开发需求模板，不含会话凭据，复制时不创建新的开发工具 Token。
export const AI_DEVELOPMENT_PROMPT = [
    '请使用 MCP【连接名】，完整开发【需求描述】，需求文档为【路径，可选】。',
    '开工前完整读取 `microi.skills/workspace-conventions/SKILL.md`、`microi.skills/microi-system-delivery/SKILL.md` 及其必读参考 `microi.skills/microi-system-delivery/references/progressive-01-标准工作流.md`，逐项执行 Skills 默认交付要求 1–10：原 1–8 项、第 9 项“基于界面引擎的业务统计、老板经营和领导管理报表”、第 10 项“先创建完整菜单骨架，再逐项验收并切换真实功能”，并按任务读取相关 Skills。',
    '先报告实际读取的文件和 1–10 项交付计划；文件缺失时先完成吾码 AI 工作区初始化，不得凭摘要声称已读。收尾逐项提供实现位置、验收证据和未完成项。',
    '允许在指定开发租户创建/更新需求内资源和验收数据，并完成业务与截图验收。'
].join('\n');

export function buildAiConnectionPrompt(connection) {
    return '连接当前工作区的 MCP：\n1. npm install -g @microi.net/cli@latest\n2. 将以下 JSON 通过标准输入交给 microi auth import --session-stdin：\n'
        + JSON.stringify(connection)
        + '\n3. 执行 microi ai init、microi doctor，再调用 MCP microi_get_status 验证。\n保留已有连接与模型配置；Token 仅存 CLI 加密存储，不写入命令参数、源码或日志，无需账号密码。';
}

export async function copyConnectionText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    const input = document.createElement('textarea');
    input.value = text;
    input.setAttribute('readonly', '');
    input.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(input);
    try { input.select(); if (!document.execCommand('copy')) throw new Error('当前浏览器不允许复制。'); }
    finally { input.value = ''; input.remove(); }
}
