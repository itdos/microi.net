import { createHash, randomUUID } from 'node:crypto';
/** 规范化只排序对象键，保留数组顺序和文本原字节；不执行用户自定义 toJSON。 */
export function canonicalManifestJson(value) {
    const seen = new Set();
    const canonical = (item, depth) => {
        if (depth > 128)
            throw new Error('Manifest 嵌套超过 128 层，请拆分为可独立验收的阶段。');
        if (item === null || typeof item === 'string' || typeof item === 'boolean')
            return item;
        if (typeof item === 'number' && Number.isFinite(item))
            return item;
        if (!item || typeof item !== 'object')
            throw new Error('Manifest 必须为有限 JSON 值，不能包含 undefined、函数或非有限数字。');
        if (seen.has(item))
            throw new Error('Manifest 不能包含循环引用。');
        seen.add(item);
        try {
            if (Array.isArray(item))
                return item.map(child => canonical(child, depth + 1));
            if (Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null)
                throw new Error('Manifest 只能包含普通 JSON 对象。');
            return Object.fromEntries(Object.keys(item).sort().map(key => [key, canonical(item[key], depth + 1)]));
        }
        finally {
            seen.delete(item);
        }
    };
    return JSON.stringify(canonical(value, 0));
}
export function manifestSha256(manifest) {
    return createHash('sha256').update(canonicalManifestJson(manifest), 'utf8').digest('hex');
}
/**
 * 仅为当前 MCP 注册会话减少重复传输，绝不缓存授权、结构检查通过或远端验收通过的事实。
 * 重启、凭据变化、TTL 或容量淘汰均可丢失；丢失时明确拒绝引用，不自动重放写入。
 */
export class ManifestContextStore {
    getIdentity;
    entries = new Map();
    identity = '';
    bytes = 0;
    ttlMs;
    maxEntries;
    maxBytes;
    maxEntryBytes;
    now;
    constructor(getIdentity, options = {}) {
        this.getIdentity = getIdentity;
        this.ttlMs = Math.min(30 * 60_000, Math.max(1, options.ttlMs ?? 15 * 60_000));
        this.maxEntries = Math.min(128, Math.max(1, options.maxEntries ?? 32));
        this.maxBytes = Math.min(32 * 1024 * 1024, Math.max(1, options.maxBytes ?? 16 * 1024 * 1024));
        this.maxEntryBytes = Math.min(this.maxBytes, Math.max(1, options.maxEntryBytes ?? 4 * 1024 * 1024));
        this.now = options.now ?? Date.now;
    }
    synchronizeIdentity() {
        let current = '';
        try {
            current = this.getIdentity?.() || '';
        }
        catch { /* 身份不可用时只禁用本地引用，全文路径仍由服务端鉴权。 */ }
        if (current !== this.identity) {
            this.entries.clear();
            this.bytes = 0;
            this.identity = current;
        }
        for (const [ref, entry] of this.entries) {
            if (entry.expiresAt <= this.now())
                this.remove(ref);
        }
        return !!current;
    }
    remove(ref) {
        const entry = this.entries.get(ref);
        if (entry)
            this.bytes -= entry.bytes;
        this.entries.delete(ref);
    }
    insert(kind, json, hash) {
        const bytes = Buffer.byteLength(json, 'utf8');
        if (!this.synchronizeIdentity() || bytes > this.maxEntryBytes)
            return undefined;
        while (this.entries.size >= this.maxEntries || this.bytes + bytes > this.maxBytes)
            this.remove(this.entries.keys().next().value);
        const ref = `${kind === 'manifest' ? 'manifest' : 'result'}:${randomUUID()}`;
        const expiresAt = this.now() + this.ttlMs;
        this.entries.set(ref, { kind, json, hash, expiresAt, bytes });
        this.bytes += bytes;
        return { ref, expiresAt };
    }
    read(ref, kind) {
        if (!this.synchronizeIdentity())
            throw new Error('当前身份不可用，不能读取会话引用。请重新提交 Manifest 正文；已写入结果未知时先回读，禁止自动重放。');
        const entry = this.entries.get(ref);
        if (!entry || entry.kind !== kind)
            throw new Error('会话引用不存在、已过期、已被淘汰或属于其它连接/身份。请重传 Manifest 正文恢复；未知写入须先回读。');
        return entry;
    }
    resolve(input) {
        if (input.manifestRef !== undefined) {
            const entry = this.read(input.manifestRef, 'manifest');
            if ((input.manifestHash !== undefined && input.manifestHash !== entry.hash)
                || (input.manifest !== undefined && manifestSha256(input.manifest) !== entry.hash)) {
                throw new Error('Manifest 引用、正文或 manifestHash 不一致；变更必须重新提交正文获取新引用。');
            }
            return { manifest: JSON.parse(entry.json), manifestHash: entry.hash, manifestRef: input.manifestRef, expiresAt: entry.expiresAt, contextIdentity: this.identity };
        }
        if (!input.manifest || Array.isArray(input.manifest))
            throw new Error('必须传入 manifest 正文或当前会话的 manifestRef。');
        const hash = manifestSha256(input.manifest);
        if (input.manifestHash !== undefined && input.manifestHash !== hash)
            throw new Error('manifestHash 与当前 Manifest 正文不一致。');
        // 保留原始对象键次序，不因用于比较的规范化哈希改变业务配置顺序。
        const json = JSON.stringify(input.manifest);
        const saved = this.insert('manifest', json, hash);
        return {
            manifest: JSON.parse(json), manifestHash: hash, contextIdentity: this.identity,
            ...(saved ? { manifestRef: saved.ref, expiresAt: saved.expiresAt } : {
                contextNotice: '未建立可复用引用（身份不可用或正文超过会话缓存容量）；继续使用完整 Manifest，原有检查与鉴权仍执行。',
            }),
        };
    }
    readResult(ref, expectedManifestHash) {
        const entry = this.read(ref, 'result');
        if (expectedManifestHash !== undefined && expectedManifestHash !== entry.hash)
            throw new Error('resultRef 与 manifestHash 不一致。');
        return JSON.parse(entry.json);
    }
    /** 每个外部动作重新核对身份，不让一份 A 的计划在异步续签/切换后继续以 B 写入。 */
    assertExecutionIdentity(resolved) {
        if (!this.getIdentity)
            return; // 存量客户端只走原有全文契约，服务端原鉴权始终执行。
        this.synchronizeIdentity();
        if (!resolved.contextIdentity || !this.identity || resolved.contextIdentity !== this.identity) {
            throw new Error('执行身份已变化或失效，已停止后续远端动作。已完成或未知写入必须先回读，禁止自动重放；恢复身份后重新提交 Manifest。');
        }
    }
    finish(raw, resolved, input, writesRequested) {
        // 没有可靠身份的旧客户端保持原契约；它不能创建或消费可跨请求复用的引用。
        if (!this.getIdentity)
            return raw;
        // 旧全文调用不强塞引用元数据；对短小任务保持原契约和原传输量。
        if (input.detail === undefined && input.manifestRef === undefined)
            return raw;
        let parsed;
        try {
            const candidate = JSON.parse(raw.content[0]?.text || '');
            if (candidate && typeof candidate === 'object' && !Array.isArray(candidate))
                parsed = candidate;
        }
        catch { /* 非 JSON 的既有错误文本原样保留，不猜测成功。 */ }
        const isError = !!raw.isError || parsed?.ok === false;
        this.synchronizeIdentity();
        const sameIdentity = !!resolved.contextIdentity && resolved.contextIdentity === this.identity;
        // 操作期间续签或切换凭据时，不能把旧身份读取的结果存给新身份；本次响应仍如实返回。
        const saved = sameIdentity ? this.insert('result', JSON.stringify({ ...raw, isError }), resolved.manifestHash) : undefined;
        const manifestRefAvailable = sameIdentity && !!resolved.manifestRef && this.entries.has(resolved.manifestRef);
        const metadata = {
            manifestHash: resolved.manifestHash,
            ...(manifestRefAvailable ? { manifestRef: resolved.manifestRef, manifestExpiresAt: new Date(resolved.expiresAt).toISOString() } : {}),
            ...(resolved.contextNotice ? { contextNotice: resolved.contextNotice } : {}),
            ...(!manifestRefAvailable && !resolved.contextNotice ? { contextNotice: 'Manifest 引用已失效（身份变化、过期或容量淘汰）；后续重传正文。当前执行结果照常保留，未知写入先回读。' } : {}),
            ...(saved ? { resultRef: saved.ref, resultExpiresAt: new Date(saved.expiresAt).toISOString() } : {}),
            ...(writesRequested ? { executionState: isError ? 'notCompletedDoNotReplay' : 'completedAndValidated' } : {}),
        };
        const detail = input.detail ?? (input.manifestRef ? 'summary' : 'full');
        // 没有保存完整回执时不做有损摘要，确保缓存容量不足不会让诊断证据消失。
        if (parsed) {
            const payload = detail === 'summary' && saved ? summarizeManifestResult(parsed) : parsed;
            return { content: [{ type: 'text', text: JSON.stringify({ ...payload, ...metadata }, null, detail === 'full' ? 2 : undefined) }], isError };
        }
        return { content: [...raw.content, { type: 'text', text: JSON.stringify(metadata) }], isError };
    }
}
/**
 * 原业务编排仍调用原 MicroiClient 方法；代理只增加请求边界身份门禁。
 * “后检查”失败时不能丢弃已返回的写入回执，也不能把新身份的回读视为旧计划验收。
 */
export function bindManifestExecutionClient(client, store, resolved) {
    const execution = { client };
    execution.client = new Proxy(client, {
        get(target, property) {
            const method = Reflect.get(target, property, target);
            if (typeof method !== 'function' || property === 'getContextIdentity')
                return method;
            return async (...args) => {
                const check = (phase, response) => {
                    if (execution.failure)
                        throw new Error(execution.failure.message);
                    try {
                        store.assertExecutionIdentity(resolved);
                    }
                    catch (error) {
                        execution.failure = { method: String(property), phase, message: error instanceof Error ? error.message : String(error), ...(phase === 'after' ? { response } : {}) };
                        throw error;
                    }
                };
                check('before');
                const response = await Reflect.apply(method, target, args);
                check('after', response);
                return response;
            };
        },
    });
    return execution;
}
/** 只压缩已明确成功的逐步回执；失败、警告和最终验收 envelope 完整保留。 */
export function summarizeManifestResult(payload) {
    if (!Array.isArray(payload.results))
        return payload;
    const hasDiagnostic = (value) => {
        if (Array.isArray(value))
            return value.some(hasDiagnostic);
        if (!value || typeof value !== 'object')
            return false;
        return Object.entries(value).some(([key, child]) => {
            if (/(error|warning|exception)/i.test(key) && child !== null && child !== '' && child !== false
                && (!Array.isArray(child) || child.length > 0))
                return true;
            if (/^(Code)$/i.test(key) && child !== 1)
                return true;
            if (/^(Passed|Success|Complete|RetrySafe)$/i.test(key) && child === false)
                return true;
            return hasDiagnostic(child);
        });
    };
    return {
        ...payload,
        resultCount: payload.results.length,
        results: payload.results.map(value => {
            if (!value || typeof value !== 'object' || Array.isArray(value))
                return value;
            const step = value;
            const response = step.response;
            if (!response || response.Code !== 1 || hasDiagnostic(response))
                return step;
            const omittedFields = [];
            // 只移除已知的源码/配置回显；未知业务属性、Skipped、状态和计数均保留，避免白名单误删诊断。
            const compactEcho = (item, path) => {
                if (Array.isArray(item))
                    return item.map((child, index) => compactEcho(child, `${path}[${index}]`));
                if (!item || typeof item !== 'object')
                    return item;
                return Object.fromEntries(Object.entries(item).filter(([key, child]) => {
                    if ((key === 'code' || /^(ApiV8Code|V8Code|CodeText|Config|JsonObj|JsonStr|PageObj|PrintObj|ViewSchema|InFormV8|SubmitFormV8|SubmitBeforeServerV8|SubmitAfterServerV8|OutFormV8|DataFilterV8)$/i.test(key))
                        && (typeof child === 'string' || (child !== null && typeof child === 'object')) && child !== '') {
                        omittedFields.push(`${path}.${key}`);
                        return false;
                    }
                    return true;
                }).map(([key, child]) => [key, compactEcho(child, `${path}.${key}`)]));
            };
            const compact = compactEcho(step, 'step');
            return omittedFields.length ? { ...compact, omittedFields } : step;
        }),
    };
}
//# sourceMappingURL=manifest-context.js.map