import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { cases, platformContext, protocolVersion } from './cases.mjs';

const hash = x => createHash('sha256').update(typeof x === 'string' ? x : JSON.stringify(x)).digest('hex');
export const limits = Object.freeze({ calls: 6, maxOutputTokens: 1024, timeoutMs: 120000, maxResponseBytes: 100000, retries: 0 });
export function plan(model) {
  if (typeof model !== 'string' || !model.trim() || model.length > 128) throw new Error('A model ID is required');
  return cases.flatMap((task, index) => (index % 2 ? [true, false] : [false, true]).map(context => ({
    id: task.id, condition: context ? 'fixed-context' : 'plain',
    body: { model, stream: true, stream_options: { include_usage: true }, max_tokens: limits.maxOutputTokens,
      messages: [{ role: 'system', content: '只输出所要求的 JSON；不执行任何操作。' + (context ? '\n' + platformContext : '') }, { role: 'user', content: task.question }] }
  })));
}
export function evaluate(id, text) {
  try { const checks = cases.find(x => x.id === id).validate(JSON.parse(text)); return { passed: Object.values(checks).every(Boolean), checks }; }
  catch { return { passed: false, checks: { validJson: false } }; }
}

export async function officialTransport(body, key, { fetchImpl = fetch } = {}) {
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), limits.timeoutMs);
  let text = '', buffer = '', totalChars = 0, usage = null, returnedModel = null, finish = null, ttft = null, done = false;
  try {
    const response = await fetchImpl('https://api.microi.net/v1/chat/completions', {
      method: 'POST', redirect: 'error', signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    if (!response.ok) return { status: 'http-error', httpStatus: response.status, elapsedMs: performance.now() - started, text: '', usage: null };
    const decoder = new TextDecoder();
    const line = raw => {
      if (done) return;
      if (!raw.startsWith('data:')) return;
      const data = raw.slice(5).trim();
      if (!data) return;
      if (data === '[DONE]') { done = true; return; }
      const event = JSON.parse(data);
      if (event.error) throw new Error('ProviderError');
      if (isModelId(event.model)) returnedModel = event.model;
      if (event.usage) usage = event.usage;
      const choice = event.choices?.[0];
      if (choice?.finish_reason) finish = choice.finish_reason;
      const delta = choice?.delta?.content;
      if (typeof delta === 'string' && delta) { ttft ??= performance.now() - started; text += delta; }
    };
    for await (const bytes of response.body) {
      buffer += decoder.decode(bytes, { stream: true });
      totalChars += bytes.length;
      if (totalChars > limits.maxResponseBytes) { controller.abort(); throw new Error('ResponseLimit'); }
      let boundary;
      while ((boundary = buffer.indexOf('\n')) >= 0) { line(buffer.slice(0, boundary).replace(/\r$/, '')); buffer = buffer.slice(boundary + 1); }
      if (done) break;
    }
    if (!done) {
      buffer += decoder.decode();
      if (buffer.trim()) line(buffer.trim());
    }
    const status = finish === 'stop' && done && text ? 'complete' : finish === 'length' ? 'truncated' : finish === 'content_filter' ? 'filtered' : 'incomplete';
    return { status, finish, returnedModel, elapsedMs: performance.now() - started, firstTextMs: ttft, text, usage };
  } catch (error) {
    // Never serialize upstream messages, response bodies, URLs or authorization headers.
    return { status: controller.signal.aborted ? 'aborted' : 'transport-error', errorType: error?.name ?? 'Error', elapsedMs: performance.now() - started, firstTextMs: ttft, text, usage, returnedModel, finish };
  } finally { clearTimeout(timer); }
}

function isModelId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9/.:_-]{0,127}$/.test(value);
}

function safeUsage(usage) {
  if (!usage || typeof usage !== 'object') return null;
  const result = {};
  for (const field of ['prompt_tokens','completion_tokens','total_tokens']) if (Number.isSafeInteger(usage[field]) && usage[field] >= 0) result[field] = usage[field];
  for (const [group, fields] of [['prompt_tokens_details',['cached_tokens']],['completion_tokens_details',['reasoning_tokens']]]) {
    for (const field of fields) if (Number.isSafeInteger(usage[group]?.[field]) && usage[group][field] >= 0) (result[group] ??= {})[field] = usage[group][field];
  }
  return Object.keys(result).length ? result : null;
}
export async function runSuite({ model, transport, evidenceKind = 'harness-test', onRecord = async () => {} }) {
  const requests = plan(model);
  const report = { protocolVersion, evidenceKind, createdAt: new Date().toISOString(), nodeVersion: process.version,
    endpoint: 'https://api.microi.net/v1/chat/completions', limits, tasksetSha256: hash(requests), records: [] };
  for (const request of requests) {
    const result = await transport(request.body);
    const validation = evaluate(request.id, result.text ?? '');
    const usage = safeUsage(result.usage);
    const record = { id: request.id, condition: request.condition, requestedModel: model, returnedModel: isModelId(result.returnedModel) ? result.returnedModel : null,
      inputSha256: hash(request.body), outputSha256: hash(result.text ?? ''), status: result.status,
      finish: result.finish ?? null, httpStatus: result.httpStatus ?? null, elapsedMs: result.elapsedMs, firstTextMs: result.firstTextMs ?? null,
      usage, usageSource: evidenceKind === 'real-provider' && usage ? 'provider' : usage ? 'synthetic-fixture' : 'unavailable',
      validation, passed: result.status === 'complete' && validation.passed };
    report.records.push(record);
    await onRecord(report);
    // Configuration/auth/transport uncertainty stops the suite; no automatic replay or alternate transport.
    if (['http-error','aborted','transport-error'].includes(result.status)) break;
  }
  report.completedCalls = report.records.length;
  report.passed = report.records.filter(x => x.passed).length;
  report.cost = null;
  report.costReason = 'No verified dated tariff or invoice was supplied; tokens are not currency.';
  return report;
}

async function main() {
  const [mode, model, output] = process.argv.slice(2);
  if (!['plan','run'].includes(mode)) throw new Error('Usage: node run.mjs plan MODEL | node run.mjs run MODEL OUTPUT.json (API key via stdin)');
  const requests = plan(model);
  if (mode === 'plan') { console.log(JSON.stringify({ protocolVersion, limits, tasksetSha256: hash(requests), requests }, null, 2)); return; }
  if (!output) throw new Error('An output path is required');
  // Exclusive create prevents silently replacing an earlier result.
  await writeFile(output, JSON.stringify({ status: 'prepared', protocolVersion }), { flag: 'wx' });
  let key = '';
  for await (const chunk of process.stdin) { key += chunk.toString('utf8'); if (key.length > 4096) throw new Error('Invalid stdin credential'); }
  key = key.trim();
  if (!key || /\s/.test(key) || key.length > 4096) throw new Error('Invalid stdin credential');
  const sourceHashes = {};
  for (const name of ['run.mjs','cases.mjs']) sourceHashes[name] = hash(await readFile(new URL(name, import.meta.url), 'utf8'));
  const persist = report => writeFile(output, JSON.stringify({ ...report, sourceHashes }, null, 2));
  const report = await runSuite({ model, evidenceKind: 'real-provider', transport: body => officialTransport(body, key), onRecord: persist });
  key = '';
  await persist(report);
  console.log(JSON.stringify({ output, calls: report.completedCalls, passed: report.passed, evidenceKind: report.evidenceKind }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => { console.error('AI benchmark stopped; inspect the saved redacted receipt. No automatic retry.'); process.exitCode = 1; });
