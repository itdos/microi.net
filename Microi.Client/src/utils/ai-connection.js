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
