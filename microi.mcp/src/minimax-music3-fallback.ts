import { Client as GradioClient } from '@gradio/client';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ApiResponse, MicroiClient } from './microi-client.js';

export const MINIMAX_MUSIC3_MODEL = 'MiniMaxAI/MiniMax-Music3';
export const MINIMAX_MUSIC3_SPACE = 'https://minimaxai-minimax-music3.hf.space';
const MAX_WAV_BYTES = 32 * 1024 * 1024;

export interface MiniMaxMusic3FallbackInput {
  apiBaseUrl: string;
  osClient: string;
  requestId: string;
  prompt: string;
  durationSeconds?: number;
  stateDirectory?: string;
}

interface Music3Receipt {
  State: 'Generating' | 'Succeeded' | 'Failed' | 'Uncertain';
  Fingerprint: string;
  Result?: Record<string, unknown>;
  Error?: string;
  UpdatedAtUtc: string;
}

export function isRetiredMiniMaxMusicApi(result: ApiResponse): boolean {
  const message = String(result?.Msg || '');
  return result?.Code !== 1
    && /\b410\b/u.test(message)
    && /Music API is no longer available to new users/iu.test(message);
}

export function buildMiniMaxMusic3StudioState(prompt: string): Record<string, unknown> {
  const cleanPrompt = String(prompt || '').trim();
  return {
    mode: 'studio',
    description: cleanPrompt,
    instrumental: true,
    title: 'Microi Original Game Music',
    lyrics: '[instrumental]',
    global_meta: [
      'Premium original game soundtrack, 44.1 kHz stereo master.',
      'Clear theme, polished transients, controlled low end, wide but mono-compatible image.',
      'Designed for a seamless gameplay loop and long listening without fatigue.',
    ].join(' '),
    vocals: 'Instrumental only. No singing, spoken words, chants, or vocal samples.',
    arrangement: `${cleanPrompt} Start the musical hook within two seconds. Use clear eight-bar sections, purposeful transitions, and an ending tail that can crossfade seamlessly into the opening.`,
  };
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function writeReceipt(filePath: string, receipt: Music3Receipt): void {
  const temporary = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(receipt, null, 2)}\n`, { encoding: 'utf8', flag: 'w' });
  fs.renameSync(temporary, filePath);
}

function readReceipt(filePath: string): Music3Receipt | undefined {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Music3Receipt;
  } catch {
    return undefined;
  }
}

function extractPredictionFileUrl(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  const url = (value as Record<string, unknown>).url;
  return typeof url === 'string' ? url : '';
}

function isWave(bytes: Buffer): boolean {
  return bytes.length >= 12
    && bytes.subarray(0, 4).toString('ascii') === 'RIFF'
    && bytes.subarray(8, 12).toString('ascii') === 'WAVE';
}

function describeError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object') {
    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== '{}') return serialized;
    } catch { /* fall through to a bounded string */ }
  }
  return String(error);
}

export async function generateMiniMaxMusic3Fallback(
  client: MicroiClient,
  input: MiniMaxMusic3FallbackInput,
): Promise<ApiResponse<Record<string, unknown>>> {
  const durationSeconds = Math.max(10, Math.min(60, Math.trunc(input.durationSeconds || 20)));
  const fingerprint = sha256(JSON.stringify({
    requestId: input.requestId,
    prompt: input.prompt.trim(),
    durationSeconds,
    model: MINIMAX_MUSIC3_MODEL,
  }));
  const stateRoot = path.resolve(input.stateDirectory
    || process.env.MICROI_MCP_STATE_DIR
    || path.join(os.homedir(), '.microi-mcp'));
  const receiptDirectory = path.join(stateRoot, 'minimax-music3');
  fs.mkdirSync(receiptDirectory, { recursive: true });
  const receiptKey = sha256(`${input.apiBaseUrl}|${input.osClient}|${input.requestId}`);
  const receiptPath = path.join(receiptDirectory, `${receiptKey}.json`);
  const lockPath = path.join(receiptDirectory, `${receiptKey}.lock`);
  const existing = readReceipt(receiptPath);
  if (existing) {
    if (existing.Fingerprint !== fingerprint) {
      return { Code: 0, Data: {}, Msg: '相同 RequestId 已用于另一组 MiniMax-Music3 参数，请换新 RequestId。' };
    }
    if (existing.State === 'Succeeded' && existing.Result) {
      return { Code: 1, Data: { ...existing.Result, Replayed: true }, Msg: '已返回本机 MCP 幂等记录中的 MiniMax-Music3 音乐。' };
    }
    return { Code: 2, Data: { Status: existing.State }, Msg: existing.Error || '同一 RequestId 正在生成或结果不确定，未重复调用 MiniMax-Music3。' };
  }

  let lockHandle: number | undefined;
  try {
    lockHandle = fs.openSync(lockPath, 'wx');
  } catch {
    return { Code: 2, Data: { Status: 'Generating' }, Msg: '同一 RequestId 正在由另一个 MCP 进程生成，未重复提交。' };
  }
  writeReceipt(receiptPath, {
    State: 'Generating',
    Fingerprint: fingerprint,
    UpdatedAtUtc: new Date().toISOString(),
  });

  let submitted = false;
  try {
    const app = await GradioClient.connect(MINIMAX_MUSIC3_SPACE);
    submitted = true;
    const seed = Number.parseInt(fingerprint.slice(0, 8), 16) & 0x7fffffff;
    const prediction = await app.predict('/studio_generate', {
      state: buildMiniMaxMusic3StudioState(input.prompt),
      duration: durationSeconds,
      seed,
      randomize_seed: false,
      headroom: 0,
      steps: 30,
      guidance: 1.7,
    });
    const values = Array.isArray(prediction.data) ? prediction.data : [];
    const fileUrl = extractPredictionFileUrl(values[2]);
    const parsedUrl = fileUrl ? new URL(fileUrl) : null;
    if (!parsedUrl
      || parsedUrl.protocol !== 'https:'
      || parsedUrl.port
      || parsedUrl.hostname.toLowerCase() !== new URL(MINIMAX_MUSIC3_SPACE).hostname.toLowerCase()) {
      throw new Error('MiniMax-Music3 返回的文件地址未通过官方 Space 白名单校验。');
    }
    const response = await fetch(parsedUrl, { redirect: 'error' });
    if (!response.ok) throw new Error(`MiniMax-Music3 文件下载失败：HTTP ${response.status}`);
    const declaredLength = Number(response.headers.get('content-length') || 0);
    if (declaredLength > MAX_WAV_BYTES) throw new Error('MiniMax-Music3 音乐超过 MCP 32MiB 安全上限。');
    const wavBytes = Buffer.from(await response.arrayBuffer());
    if (wavBytes.length > MAX_WAV_BYTES || !isWave(wavBytes)) {
      throw new Error('MiniMax-Music3 未返回有效的 WAV 音乐。');
    }
    const upload = await client.uploadFileBase64({
      FileName: `minimax-music3-${fingerprint.slice(0, 12)}.wav`,
      FileByteBase64: wavBytes.toString('base64'),
      Path: 'ai-music',
      Limit: false,
      Preview: false,
    });
    if (upload.Code !== 1 || !upload.Data || typeof upload.Data !== 'object') {
      throw new Error(`音乐已生成但 HDFS 写入失败：${upload.Msg || 'unknown error'}`);
    }
    const uploadData = upload.Data as Record<string, unknown>;
    const result: Record<string, unknown> = {
      RequestId: input.requestId,
      Model: MINIMAX_MUSIC3_MODEL,
      RequestedModel: 'music-3.0',
      ModelFallbackUsed: true,
      ModelFallbackReason: 'MiniMax 托管 Music API 返回明确 410，按官方指引切换开源 MiniMax-Music3。',
      Route: 'MiniMax-Official-HuggingFace-Space',
      DurationMilliseconds: durationSeconds * 1000,
      SampleRate: 44100,
      Channels: 2,
      Format: 'wav',
      FileSize: wavBytes.length,
      FileSha256: crypto.createHash('sha256').update(wavBytes).digest('hex'),
      Hdfs: uploadData,
      Permanent: true,
      Storage: 'Microi.HDFS',
      Replayed: false,
      Attribution: 'MiniMax-Music3',
    };
    writeReceipt(receiptPath, {
      State: 'Succeeded',
      Fingerprint: fingerprint,
      Result: result,
      UpdatedAtUtc: new Date().toISOString(),
    });
    return { Code: 1, Data: result, Msg: 'MiniMax-Music3 原创音乐已生成并写入当前租户公有 HDFS。' };
  } catch (error) {
    const message = describeError(error);
    writeReceipt(receiptPath, {
      State: submitted ? 'Uncertain' : 'Failed',
      Fingerprint: fingerprint,
      Error: submitted
        ? `MiniMax-Music3 结果不确定，未用同一 RequestId 自动重试：${message}`
        : `MiniMax-Music3 提交前失败：${message}`,
      UpdatedAtUtc: new Date().toISOString(),
    });
    return {
      Code: 0,
      Data: { Status: submitted ? 'Uncertain' : 'Failed' },
      Msg: submitted
        ? `MiniMax-Music3 结果不确定，未用同一 RequestId 自动重试：${message}`
        : `MiniMax-Music3 提交前失败：${message}`,
    };
  } finally {
    if (lockHandle !== undefined) fs.closeSync(lockHandle);
    try { fs.unlinkSync(lockPath); } catch { /* another process never owns this exact handle */ }
  }
}
