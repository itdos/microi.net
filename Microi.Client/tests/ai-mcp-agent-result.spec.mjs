import assert from 'node:assert/strict';
import test from 'node:test';
import { mapMcpCallTrace } from '../src/views/ai-engine/ai-mcp-agent-result.js';
import { canUseBuilderMcp, chooseConversationalModel } from '../src/views/ai-engine/ai-mcp-builder.js';

test('online MCP builder is visible only at Level 9999 or above', () => {
  assert.equal(canUseBuilderMcp({ Level: 9998, IsAdmin: true }), false);
  assert.equal(canUseBuilderMcp({ Level: 9999 }), true);
  assert.equal(canUseBuilderMcp({ Level: 10000 }), true);
});

test('builder defaults to a conversation model instead of a media model', () => {
  const models = [
    { Name: 'AI image', AiModel: 'image-01', ModelType: 'image' },
    { Name: 'Microi 中转站', AiModel: 'relay-chat' },
    { Name: 'MiniMax M3', AiModel: 'MiniMax-M3' },
  ];
  assert.equal(chooseConversationalModel(models)?.AiModel, 'MiniMax-M3');
});

test('server tool receipts show actual calls without persisting model parameters or sensitive results', () => {
  const actions = mapMcpCallTrace({ McpCalls: [
    { Action: 'microi_get_db_schema', IsError: false, Params: { Token: 'secret' }, Result: 'secret' },
    { Action: 'microi_create_table', IsError: true, Params: { OsClient: 'other' } },
  ] });
  assert.equal(actions.length, 2);
  assert.equal(actions[0].Action, 'microi_get_db_schema');
  assert.deepEqual(actions[0].Params, {});
  assert.ok(actions[0].__result);
  assert.equal(actions[1].__result, null);
  assert.match(actions[1].__error, /错误/);
  assert.doesNotMatch(JSON.stringify(actions), /secret|other/);
});

test('invalid or missing server receipts cannot be mistaken for completed MCP actions', () => {
  assert.deepEqual(mapMcpCallTrace({ McpCalls: {} }), []);
  assert.deepEqual(mapMcpCallTrace(null), []);
});
