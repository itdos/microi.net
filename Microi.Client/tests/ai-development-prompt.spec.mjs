import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { AI_DEVELOPMENT_PROMPT } from '../src/utils/ai-connection.js';

test('前端复制文本与官网提示词一致，交付编号连续覆盖 1–10', async () => {
    const doc = await readFile(new URL('../../microi.doc/docs/doc/v8-engine/ai-apiengine.md', import.meta.url), 'utf8');
    const prompt = doc.match(/::: tip AI开发推荐提示词\r?\n([\s\S]*?)\r?\n:::/)?.[1];
    assert.equal(AI_DEVELOPMENT_PROMPT, prompt?.replaceAll('\r\n', '\n'));
    const summary = doc.slice(doc.indexOf('| 条目 | Skills 默认执行的要求 |'), doc.indexOf('前端“开发工具连接”'));
    const numbers = [...summary.matchAll(/^\| (\d+) \|/gm)].map(match => Number(match[1]));
    assert.deepEqual(numbers, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.match(AI_DEVELOPMENT_PROMPT, /原 1–8 项、第 9 项“基于界面引擎.*第 10 项“先创建完整菜单骨架/);
});
