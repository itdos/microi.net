import { AsyncLocalStorage } from 'node:async_hooks';
const active = new AsyncLocalStorage();
const readRoute = /\/(?:Get|List|Query|Inspect|Validate|Check)[A-Za-z]+$/i;
/** 只能在可信 dispatcher/明确的写前校验分支调用；不能凭“没看到请求”推断未写入。 */
export function notExecuted(result) {
    const scope = active.getStore();
    if (scope && !scope.mutationStarted)
        scope.validationRejected = true;
    return result;
}
/** 只发送固定阶段名；请求正文、SQL、返回值和身份信息不进入进度通知。 */
export async function reportOperation(path, method, completed = false) {
    const scope = active.getStore();
    if (!scope)
        return;
    const read = method === 'GET' || readRoute.test(path);
    if (!completed) {
        scope.requests += 1;
        if (!read)
            scope.mutationStarted = true;
    }
    const stage = /\/CreateTable$/i.test(path) ? '表结构创建（DDL）'
        : /\/AddField$/i.test(path) ? '字段结构更新（DDL）'
            : /\/CreateModule$/i.test(path) ? '菜单模块配置'
                : read ? '权威数据回读' : '配置写入';
    await scope.report(JSON.stringify({ stage, state: completed ? 'returned' : 'started', request: scope.requests }), ++scope.sequence);
}
/** 只接收已鉴权 MCP 端点的 ORM 回执；不从模型参数或推测的 SQL 生成事件。 */
export async function reportDdlEvents(path, response) {
    const scope = active.getStore();
    if (!scope || !/\/(CreateTable|AddField)$/.test(path) || !response || typeof response !== 'object')
        return;
    const append = response.DataAppend;
    for (const raw of (Array.isArray(append?.DdlEvents) ? append.DdlEvents : []).slice(0, 128)) {
        const item = raw;
        if (!Number.isSafeInteger(item.Id) || typeof item.Statement !== 'string' || item.Statement.length > 4200 || !['submitted', 'executed', 'failed'].includes(String(item.State)))
            continue;
        await scope.report(JSON.stringify({ kind: 'ddl', id: item.Id, statement: item.Statement, state: item.State, transactionPending: item.TransactionPending === true, observedAtUtc: item.ObservedAtUtc }), ++scope.sequence);
    }
    if ((append?.DdlEventsDropped ?? 0) > 0)
        await scope.report(JSON.stringify({ stage: 'DDL回执有界截断', state: 'returned' }), ++scope.sequence);
}
export async function withOperationProgress(run, report = async () => { }) {
    const scope = { requests: 0, mutationStarted: false, validationRejected: false, sequence: 0, report };
    return active.run(scope, async () => {
        const result = await run();
        // 未发任何写请求的本地校验错误可确定未执行；已经开始写入的错误始终要求回读。
        return { ...result, _meta: { ...result._meta, microiExecution: {
                    state: result.isError ? (scope.validationRejected && !scope.mutationStarted ? 'notExecuted' : 'uncertain') : 'returned',
                    requests: scope.requests,
                } } };
    });
}
//# sourceMappingURL=operation-progress.js.map