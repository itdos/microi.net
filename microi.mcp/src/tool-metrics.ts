/** 仅计量工具载荷，不保留问题、源码、身份、凭据或错误正文；字节不是供应商 token。 */
export class ToolPayloadMetrics {
  private readonly actions = new Map<string, { calls: number; errors: number; requestBytes: number; responseBytes: number; elapsedMs: number }>();

  async measure<T>(action: string, request: unknown, run: () => Promise<T> | T): Promise<T> {
    const entry = this.actions.get(action) || { calls: 0, errors: 0, requestBytes: 0, responseBytes: 0, elapsedMs: 0 };
    this.actions.set(action, entry);
    entry.calls += 1;
    entry.requestBytes += this.bytes(request);
    const started = performance.now();
    try {
      const result = await run();
      entry.responseBytes += this.bytes(result);
      if (result && typeof result === 'object' && (result as { isError?: boolean }).isError === true) entry.errors += 1;
      return result;
    } catch (error) {
      entry.errors += 1;
      throw error;
    } finally {
      entry.elapsedMs += performance.now() - started;
    }
  }

  snapshot() {
    const actions = [...this.actions].map(([action, values]) => ({ action, ...values, elapsedMs: Math.round(values.elapsedMs) }));
    return {
      scope: 'current_mcp_session', unit: 'utf8_bytes', providerUsage: 'unknown',
      definition: 'validated tool arguments and returned MCP payload; excludes transport framing, model history and discovery dispatcher overhead',
      totals: actions.reduce((sum, item) => ({ calls: sum.calls + item.calls, errors: sum.errors + item.errors, requestBytes: sum.requestBytes + item.requestBytes, responseBytes: sum.responseBytes + item.responseBytes }), { calls: 0, errors: 0, requestBytes: 0, responseBytes: 0 }),
      actions,
    };
  }

  private bytes(value: unknown): number {
    try { return Buffer.byteLength(JSON.stringify(value) || '', 'utf8'); }
    catch { return 0; } // 计量失败不改变工具业务结果，也不输出可能含秘密的对象。
  }
}
