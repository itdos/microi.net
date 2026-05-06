import fs from 'node:fs';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express from 'express';
import { MicroiClient } from './microi-client.js';
import { createMcpServer } from './server.js';
/** 从 VS Code 扩展写入的 token 文件中读取指定服务器的 token */
function readTokenFromFile(filePath, apiUrl, osClient) {
    try {
        const tokens = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (osClient) {
            return tokens[`${apiUrl}|${osClient}`] || undefined;
        }
        return tokens[apiUrl] || undefined;
    }
    catch {
        return undefined;
    }
}
async function main() {
    const config = {
        apiBaseUrl: (process.env.MICROI_API_URL || '').replace(/\/+$/, ''),
        username: process.env.MICROI_USERNAME || '',
        password: process.env.MICROI_PASSWORD || '',
        osClient: process.env.MICROI_OS_CLIENT || '',
        rsaPublicKey: process.env.MICROI_RSA_PUBLIC_KEY || undefined,
        token: process.env.MICROI_TOKEN || undefined,
    };
    // 本地开发服务器（localhost / 127.0.0.1）使用自签证书，允许 Node.js 跳过 TLS 验证
    if (/^https:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(config.apiBaseUrl)) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
        console.error('[microi-mcp] Detected localhost HTTPS, disabled TLS certificate verification');
    }
    // Token 文件优先级最高（VS Code 扩展持续刷新写入）
    const tokenFilePath = process.env.MICROI_TOKEN_FILE;
    if (tokenFilePath) {
        config.tokenFilePath = tokenFilePath;
        const fileToken = readTokenFromFile(tokenFilePath, config.apiBaseUrl, config.osClient || '');
        if (fileToken) {
            config.token = fileToken;
        }
    }
    const transport = process.env.MCP_TRANSPORT || 'stdio';
    if (transport === 'sse') {
        // SSE 模式：每个连接独立认证，env 凭据作为可选默认值
        if (!config.apiBaseUrl) {
            console.error('Missing required: MICROI_API_URL (Microi backend API URL)');
            process.exit(1);
        }
        await startSSE(parseInt(process.env.MCP_PORT || '3000', 10), config);
    }
    else {
        // stdio 模式：Token 文件 > MICROI_TOKEN > username/password
        if (!config.apiBaseUrl) {
            console.error('Missing required: MICROI_API_URL');
            process.exit(1);
        }
        if (!config.token && (!config.username || !config.password)) {
            console.error('Missing required environment variables:');
            console.error('  MICROI_API_URL      - Microi backend API URL (e.g. https://api.example.com)');
            console.error('  MICROI_TOKEN_FILE   - Token file path (preferred, auto-managed by VS Code extension)');
            console.error('  MICROI_TOKEN        - JWT token (fallback)');
            console.error('  MICROI_USERNAME     - Login username (fallback if no token)');
            console.error('  MICROI_PASSWORD     - Login password (fallback if no token)');
            console.error('Optional:');
            console.error('  MICROI_OS_CLIENT    - OsClient identifier');
            process.exit(1);
        }
        const client = new MicroiClient(config);
        await client.login();
        const serverContext = { osClient: config.osClient || '', apiBaseUrl: config.apiBaseUrl, label: process.env.MICROI_LABEL || '' };
        const server = createMcpServer(client, serverContext);
        await startStdio(server);
        // 监听 token 文件变化（VS Code 扩展每 14 分钟刷新 token 并写入文件）
        if (tokenFilePath) {
            fs.watchFile(tokenFilePath, { interval: 5000 }, () => {
                const newToken = readTokenFromFile(tokenFilePath, config.apiBaseUrl, config.osClient || '');
                if (newToken) {
                    client.updateToken(newToken);
                    console.error('[microi-mcp] Token updated from file');
                }
            });
        }
        const cleanup = () => {
            if (tokenFilePath) {
                fs.unwatchFile(tokenFilePath);
            }
            client.destroy();
            process.exit(0);
        };
        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);
    }
}
/** stdio 模式：适用于 VS Code / Cursor 本地启动 */
async function startStdio(server) {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('[microi-mcp] Server started (stdio mode)');
}
/**
 * SSE 模式：每个连接独立认证
 *
 * 认证方式（按优先级）：
 * 1. 请求头 X-Microi-Username / X-Microi-Password / X-Microi-OsClient
 * 2. 环境变量 MICROI_USERNAME / MICROI_PASSWORD / MICROI_OS_CLIENT（兜底默认值）
 * 3. 均无 → 拒绝连接 (401)
 */
async function startSSE(port, defaultConfig) {
    const app = express();
    app.use(express.json());
    const sessions = new Map();
    app.get('/sse', async (req, res) => {
        const username = req.headers['x-microi-username'] || defaultConfig.username;
        const password = req.headers['x-microi-password'] || defaultConfig.password;
        const osClient = req.headers['x-microi-osclient'] || defaultConfig.osClient || '';
        if (!username || !password) {
            res.status(401).json({
                error: 'Authentication required',
                message: 'Provide X-Microi-Username and X-Microi-Password in request headers, or set MICROI_USERNAME / MICROI_PASSWORD environment variables.',
            });
            return;
        }
        try {
            // 每个连接创建独立的 MicroiClient，独立登录、独立 Token 刷新
            const client = new MicroiClient({
                apiBaseUrl: defaultConfig.apiBaseUrl,
                username,
                password,
                osClient,
                rsaPublicKey: defaultConfig.rsaPublicKey,
            });
            await client.login();
            const sseContext = { osClient: osClient || '', apiBaseUrl: defaultConfig.apiBaseUrl, label: '' };
            const server = createMcpServer(client, sseContext);
            const sseTransport = new SSEServerTransport('/messages', res);
            sessions.set(sseTransport.sessionId, { transport: sseTransport, client });
            res.on('close', () => {
                const session = sessions.get(sseTransport.sessionId);
                if (session) {
                    session.client.destroy();
                    sessions.delete(sseTransport.sessionId);
                    console.error(`[microi-mcp] Session ${sseTransport.sessionId} disconnected (user: ${username})`);
                }
            });
            console.error(`[microi-mcp] New session ${sseTransport.sessionId} (user: ${username}, osClient: ${osClient || 'default'})`);
            await server.connect(sseTransport);
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error(`[microi-mcp] SSE auth failed (user: ${username}): ${msg}`);
            if (!res.headersSent) {
                res.status(401).json({ error: 'Authentication failed', message: msg });
            }
        }
    });
    app.post('/messages', async (req, res) => {
        const sessionId = req.query.sessionId;
        const session = sessions.get(sessionId);
        if (!session) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }
        await session.transport.handlePostMessage(req, res);
    });
    app.get('/health', (_req, res) => {
        res.json({ status: 'ok', server: 'microi-mcp-server', version: '1.0.0', activeSessions: sessions.size });
    });
    // 优雅退出：清理所有会话
    const cleanup = () => {
        for (const [id, session] of sessions) {
            session.client.destroy();
            sessions.delete(id);
        }
        process.exit(0);
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    app.listen(port, () => {
        console.error(`[microi-mcp] Server started (SSE mode) on http://localhost:${port}`);
        console.error(`[microi-mcp] SSE endpoint: http://localhost:${port}/sse`);
        console.error(`[microi-mcp] Auth: ${defaultConfig.username ? 'env defaults available' : 'headers required'}`);
    });
}
main().catch((e) => {
    console.error('[microi-mcp] Fatal error:', e instanceof Error ? e.message : e);
    process.exit(1);
});
//# sourceMappingURL=index.js.map