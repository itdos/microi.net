import { z } from 'zod';
/** 部署凭据不进入通用表工具或 V8；只经过主租户管理员的专用控制面。 */
export function registerSaasMinioTools(server, client, tenant) {
    server.tool('microi_manage_saas_minio', 'Inspect, probe or save the CURRENT main tenant SaaS MinIO binding in sys_osclients. Interactive platform administrator only; child tenants/access keys are rejected by the backend. Credentials are write-only, omitted credentials are preserved, and HDFS/OSS settings never change. Inspect first; Save requires its expectedRevision and SAVE_MINIO:<tenant>:<revision>. The server probes the candidate public bucket before a transactional CAS save, reloads shared/runtime configuration and returns safe metadata only. On timeout Inspect; never blindly replay Save.', { action: z.enum(['Inspect', 'Probe', 'Save']), expectedRevision: z.string().regex(/^[a-f0-9]{64}$/).optional(),
        confirmExecution: z.string().optional(), configuration: z.object({
            endpoint: z.string().min(1).max(500).optional(), internetEndpoint: z.string().min(1).max(500).optional(),
            useSsl: z.boolean().optional(), privateUseSsl: z.boolean().optional(),
            publicBucket: z.string().min(3).max(63).optional(), privateBucket: z.string().min(3).max(63).optional(),
            region: z.string().max(100).optional(), accessKey: z.string().min(1).max(256).optional(),
            secretKey: z.string().min(1).max(1024).optional(),
        }).strict().optional() }, async (input) => {
        const failure = (message) => ({ content: [{ type: 'text', text: message }], isError: true });
        if (input.action === 'Save' && (!input.configuration || !input.expectedRevision
            || input.confirmExecution !== `SAVE_MINIO:${tenant}:${input.expectedRevision}`))
            return failure('先 Inspect；Save 必须提供 configuration、expectedRevision 和 SAVE_MINIO:<tenant>:<revision>。');
        if (input.action !== 'Save' && (input.configuration || input.expectedRevision || input.confirmExecution))
            return failure('Inspect/Probe 只读取已保存配置，不接受配置或写入参数。');
        try {
            const result = await client.manageSaasMinio(input);
            // 即使旧/异常服务端返回秘密，也不能原样透传正文或异常。
            const safe = {};
            const data = result.Data && typeof result.Data === 'object' ? result.Data : {};
            for (const key of ['Protocol', 'Tenant', 'OsClientType', 'OsClientNetwork', 'Revision', 'Endpoint',
                'InternetEndpoint', 'UseSsl', 'PrivateUseSsl', 'PublicBucket', 'PrivateBucket', 'Region',
                'HasAccessKey', 'HasSecretKey', 'HdfsProvider', 'Persisted', 'Idempotent', 'ProbeSucceeded',
                'RuntimeReloaded', 'RuntimeVerified', 'RuntimeCurrentNodeOnly', 'ReasonCode']) {
                const value = data[key];
                if (value === null || ['string', 'boolean', 'number'].includes(typeof value))
                    safe[key] = value;
            }
            return { content: [{ type: 'text', text: JSON.stringify({ Code: result.Code, Data: safe }, null, 2) }],
                ...(result.Code !== 1 ? { isError: true } : {}) };
        }
        catch {
            return failure('SaaS MinIO 操作未确认完成。请 Inspect 回读；不会重复保存或输出供应商异常、密钥。');
        }
    });
}
//# sourceMappingURL=saas-minio-tools.js.map