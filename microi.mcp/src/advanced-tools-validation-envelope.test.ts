import assert from 'node:assert/strict';
import test from 'node:test';

import { buildGenerateSystemValidationPayload } from './advanced-tools.js';

test('generate_system preserves validator Code, Msg and Data for deterministic recovery', () => {
  const payload = buildGenerateSystemValidationPayload(
    [{ step: 'upsertEngine', response: { Code: 1 } }],
    {
      Code: 0,
      Msg: "验收低代码系统失败：'Newtonsoft.Json.Linq.JValue' does not contain a definition for 'Val'",
      Data: null,
    },
  );

  assert.deepEqual(payload, {
    ok: false,
    results: [{ step: 'upsertEngine', response: { Code: 1 } }],
    validation: {
      Code: 0,
      Msg: "验收低代码系统失败：'Newtonsoft.Json.Linq.JValue' does not contain a definition for 'Val'",
      Data: null,
    },
  });
});
