import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express from 'express';
import { MicroiClient } from './microi-client.js';
import { createMcpServer } from './server.js';
async function main() {
    const config = {
        apiBaseUrl: (process.env.MICROI_API_URL || '').replace(/\/+$/, ''),
        username: process.env.MICROI_USERNAME || '',
        password: process.env.MICROI_PASSWORD || '',
        osClient: process.env.MICROI_OS_CLIENT || '',
        rsaPublicKey: process.env.MICROI_RSA_PUBLIC_KEY || undefined,
    };
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
        // stdio 模式：凭据必须来自 env（本地单用户）
        if (!config.apiBaseUrl || !config.username || !config.password) {
            console.error('Missing required environment variables:');
            console.error('  MICROI_API_URL      - Microi backend API URL (e.g. https://api.example.com)');
            console.error('  MICROI_USERNAME     - Login username');
            console.error('  MICROI_PASSWORD     - Login password');
            console.error('Optional:');
            console.error('  MICROI_OS_CLIENT    - OsClient identifier');
            console.error('  MICROI_RSA_PUBLIC_KEY - Custom RSA public key (PEM format)');
            process.exit(1);
        }
        const client = new MicroiClient(config);
        await client.login();
        const server = createMcpServer(client);
        await startStdio(server);
        const cleanup = () => {
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
            const server = createMcpServer(client);
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