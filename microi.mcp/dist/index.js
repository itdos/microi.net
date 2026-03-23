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
    if (!config.apiBaseUrl || !config.username || !config.password) {
        console.error('Missing required environment variables:');
        console.error('  MICROI_API_URL      - Microi backend API URL (e.g. https://api.example.com)');
        console.error('  MICROI_USERNAME     - Login username');
        console.error('  MICROI_PASSWORD     - Login password');
        console.error('Optional:');
        console.error('  MICROI_OS_CLIENT    - OsClient identifier');
        console.error('  MICROI_RSA_PUBLIC_KEY - Custom RSA public key (PEM format)');
        console.error('  MCP_TRANSPORT       - "stdio" (default) or "sse"');
        console.error('  MCP_PORT            - SSE server port (default: 3000)');
        process.exit(1);
    }
    // 1. 登录 Microi 后端
    const client = new MicroiClient(config);
    await client.login();
    // 2. 创建 MCP Server
    const server = createMcpServer(client);
    // 3. 根据传输模式启动
    const transport = process.env.MCP_TRANSPORT || 'stdio';
    if (transport === 'sse') {
        await startSSE(server, parseInt(process.env.MCP_PORT || '3000', 10));
    }
    else {
        await startStdio(server);
    }
    // 优雅退出
    const cleanup = () => {
        client.destroy();
        process.exit(0);
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
}
/** stdio 模式：适用于 VS Code / Cursor 本地启动 */
async function startStdio(server) {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('[microi-mcp] Server started (stdio mode)');
}
/** SSE 模式：适用于 Docker / 远程部署 */
async function startSSE(server, port) {
    const app = express();
    app.use(express.json());
    const sessions = new Map();
    app.get('/sse', async (_req, res) => {
        const sseTransport = new SSEServerTransport('/messages', res);
        sessions.set(sseTransport.sessionId, sseTransport);
        res.on('close', () => sessions.delete(sseTransport.sessionId));
        await server.connect(sseTransport);
    });
    app.post('/messages', async (req, res) => {
        const sessionId = req.query.sessionId;
        const sseTransport = sessions.get(sessionId);
        if (!sseTransport) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }
        await sseTransport.handlePostMessage(req, res);
    });
    app.get('/health', (_req, res) => {
        res.json({ status: 'ok', server: 'microi-mcp-server', version: '1.0.0' });
    });
    app.listen(port, () => {
        console.error(`[microi-mcp] Server started (SSE mode) on http://localhost:${port}`);
        console.error(`[microi-mcp] SSE endpoint: http://localhost:${port}/sse`);
    });
}
main().catch((e) => {
    console.error('[microi-mcp] Fatal error:', e instanceof Error ? e.message : e);
    process.exit(1);
});
//# sourceMappingURL=index.js.map