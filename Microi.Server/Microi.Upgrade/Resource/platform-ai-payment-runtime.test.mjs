import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('./platform-ai-account.js', import.meta.url), 'utf8');
const execute = new Function('V8', 'DateNow', 'DateFormat', source);
const EVENT_ID = `alipay:${'a'.repeat(64)}`;

function whereValue(param, field) {
  const row = (param?._Where || []).find(item => String(item?.[0]) === field);
  return row?.[2];
}

function createRuntime(overrides = {}) {
  const transaction = { Name: 'managed-payment-transaction' };
  const state = {
    order: {
      Id: 'order-id', OrderNo: 'SUB202608250001', PlanId: 'plan-id',
      PlanCode: 'pro', PlanName: '专业版', Amount: 99, PayMethod: 'alipay',
      PayStatus: 0, SubscriptionMonths: 1, UserId: 'user-id', UserName: '用户', TradeNo: '',
    },
    subscription: null,
    key: { Id: 'provider-key-id', ProviderId: 'provider-id', CurrentUsers: 0, MaxUsers: 15 },
    bind: null,
    protocolConsumes: 0,
    hookCalls: [],
    writes: [],
    ...overrides,
  };
  let guidIndex = 0;
  const success = data => ({ Code: 1, Data: data });
  const missing = () => ({ Code: 2, Data: null });
  const formEngine = {
    GetFormData(table, param, currentTransaction) {
      assert.equal(currentTransaction, transaction);
      if (table === 'mic_sub_order') {
        if (whereValue(param, 'OrderNo')) return success({ ...state.order });
        if (whereValue(param, 'TradeNo')) return missing();
        return success({ ...state.order });
      }
      if (table === 'mic_sub_plan') return success({ Id: 'plan-id', QuotaPer5h: 600 });
      if (table === 'mic_sub_user') return state.subscription ? success({ ...state.subscription }) : missing();
      if (table === 'mic_sub_apikey') return success({ ...state.key });
      throw new Error(`unexpected GetFormData ${table}`);
    },
    GetTableData(table, param, currentTransaction) {
      assert.equal(currentTransaction, transaction);
      if (table === 'mic_sub_provider') return success([{ Id: 'provider-id' }]);
      if (table === 'mic_sub_apikey_binduser') return success(state.bind ? [{ ...state.bind }] : []);
      if (table === 'mic_sub_apikey') return success([{ ...state.key }]);
      throw new Error(`unexpected GetTableData ${table}`);
    },
    UptFormDataByWhere(table, param, currentTransaction) {
      assert.equal(currentTransaction, transaction);
      state.writes.push(['UptFormDataByWhere', table, structuredClone(param)]);
      if (table === 'mic_sub_order') {
        if (state.order.PayStatus !== 0) return { Code: 1, DataCount: 0 };
        Object.assign(state.order, param);
        return { Code: 1, DataCount: 1 };
      }
      if (table === 'mic_sub_apikey') {
        Object.assign(state.key, param);
        return { Code: 1, DataCount: 1 };
      }
      throw new Error(`unexpected UptFormDataByWhere ${table}`);
    },
    UptFormData(table, param, currentTransaction) {
      assert.equal(currentTransaction, transaction);
      state.writes.push(['UptFormData', table, structuredClone(param)]);
      if (table === 'mic_sub_user') Object.assign(state.subscription, param);
      return { Code: 1 };
    },
    AddFormData(table, param, currentTransaction) {
      assert.equal(currentTransaction, transaction);
      state.writes.push(['AddFormData', table, structuredClone(param)]);
      if (table === 'mic_sub_user') state.subscription = { ...param };
      if (table === 'mic_sub_apikey_binduser') state.bind = { ...param };
      return { Code: 1 };
    },
  };
  const V8 = {
    Param: {
      Action: 'CompletePayment',
      Provider: 'Alipay',
      EventId: EVENT_ID,
      TradeStatus: 'TRADE_SUCCESS',
      OrderNo: state.order.OrderNo,
      TradeNo: 'alipay-trade-1',
      TotalAmount: '99.00',
    },
    DbTrans: transaction,
    CurrentUser: {},
    Method: {
      RequireManagedProtocolContext() {
        state.protocolConsumes += 1;
        return { Code: 1 };
      },
      NewGuid() {
        guidIndex += 1;
        return `00000000-0000-4000-8000-${String(guidIndex).padStart(12, '0')}`;
      },
      ManageAiPlatform() {
        throw new Error('CompletePayment must not enter user-bound atom authorization');
      },
    },
    ApiEngine: {
      Run(key, payload, currentTransaction) {
        assert.equal(key, 'platform-ai-custom-hook');
        assert.equal(currentTransaction, transaction);
        state.hookCalls.push(structuredClone(payload));
        return { Code: 1 };
      },
    },
    FormEngine: formEngine,
  };
  return { state, V8 };
}

function run(runtime) {
  return execute(
    runtime.V8,
    () => '2026-08-25 12:00:00',
    value => {
      const date = value instanceof Date ? value : new Date(value);
      const pad = number => String(number).padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
        + `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    },
  );
}

test('verified payment is claimed once and order, subscription and provider binding share the Managed execution', () => {
  const runtime = createRuntime();
  const first = run(runtime);
  assert.equal(first.Code, 1);
  assert.equal(first.Data.IdempotentReplay, false);
  assert.equal(runtime.state.protocolConsumes, 1);
  assert.equal(runtime.state.order.PayStatus, 1);
  assert.equal(runtime.state.order.TradeNo, 'alipay-trade-1');
  assert.ok(runtime.state.subscription);
  assert.ok(runtime.state.bind);
  assert.deepEqual(runtime.state.hookCalls, [{
    SourceApiEngineKey: 'platform-ai-account',
    Stage: 'Before',
    Action: 'CompletePayment',
    EventId: EVENT_ID,
    Provider: 'Alipay',
  }]);
  assert.doesNotMatch(JSON.stringify(runtime.state.hookCalls), /OrderNo|TradeNo|TotalAmount|ApiKey/);

  const writeCount = runtime.state.writes.length;
  const replay = run(runtime);
  assert.equal(replay.Code, 1);
  assert.equal(replay.Data.IdempotentReplay, true);
  assert.equal(runtime.state.protocolConsumes, 2);
  assert.equal(runtime.state.writes.length, writeCount);
});

test('amount mismatch fails before the atomic order claim', () => {
  const runtime = createRuntime();
  runtime.V8.Param.TotalAmount = '98.99';
  const result = run(runtime);
  assert.equal(result.Code, 0);
  assert.match(result.Msg, /支付金额/);
  assert.equal(runtime.state.protocolConsumes, 1);
  assert.equal(runtime.state.order.PayStatus, 0);
  assert.deepEqual(runtime.state.writes, []);
});
