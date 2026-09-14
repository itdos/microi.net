export function buildAiConnectionPrompt(connection) {
    return '请在当前工作目录安装或更新 npm 包 @microi.net/cli（npm install -g @microi.net/cli@latest），然后执行 microi auth import --session-stdin，将以下 JSON 通过标准输入传给该命令；导入成功后执行 microi ai init 初始化 MCP 和工作区 AI 配置，再执行 microi doctor，并通过 initialize、tools/list、microi_get_status 验证连接。连接信息为：' + JSON.stringify(connection) + '。Token 是本次独立开发工具会话的凭据，不需要平台账号密码；不要把 Token 放入命令行参数、源码、日志或公开输出，使用 CLI 自带的系统加密存储。已有其他服务器连接应保留。模型服务与计费账号独立，保留 AI 工具已有的模型配置；尚未配置模型服务时，由用户通过 AI 工具自身的授权流程完成登录，平台 Token 不能替代模型服务凭据。';
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
