import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDefaultFormBanner, buildPlan } from './advanced-tools.js';

const fields = [
  { name: 'OrderNo', label: '订单编号', type: 'varchar(50)', component: 'AutoNumber' },
  { name: 'CustomerName', label: '客户名称', type: 'varchar(100)', component: 'Text' },
  { name: 'Cover', label: '订单图片', type: 'mediumtext', component: 'ImgUpload' },
  { name: 'Status', label: '订单状态', type: 'varchar(50)', component: 'Select' },
  { name: 'Amount', label: '订单金额', type: 'decimal(18,2)', component: 'NumberText' },
];

test('new business tables receive useful field-aware Banner defaults', () => {
  const banner = buildDefaultFormBanner({ name: 'Biz_Order', fields });
  assert.equal(banner.FormBannerEnabled, 1);
  assert.equal(banner.FormBannerTitleField, 'OrderNo');
  assert.equal(banner.FormBannerSubtitleField, 'CustomerName');
  assert.equal(banner.FormBannerImageField, 'Cover');
  assert.equal(banner.FormBannerIcon, 'far fa-file-alt');
  assert.deepEqual(JSON.parse(String(banner.FormBannerTagFields)), [
    { Key: 'Status', Field: 'Status', Label: '订单状态' },
  ]);
  assert.deepEqual(JSON.parse(String(banner.FormBannerMetrics)), [
    { Key: 'Amount', Field: 'Amount', Label: '订单金额', Auto: true },
  ]);
});

test('technical integers are not fabricated as Banner metrics and child-only metrics stay runtime-driven', () => {
  const technical = buildDefaultFormBanner({
    name: 'Api_Engine',
    fields: [
      { name: 'Name', label: '名称', type: 'varchar(100)', component: 'Text' },
      { name: 'Sort', label: '排序', type: 'int', component: 'NumberText' },
      { name: 'PageSize', label: '本页加载', type: 'int', component: 'NumberText' },
      { name: 'V8Limit', label: 'V8运行限制', type: 'tinyint', component: 'Switch' },
    ],
  });
  assert.deepEqual(JSON.parse(String(technical.FormBannerMetrics)), []);

  const childOnly = buildDefaultFormBanner({
    name: 'Biz_Order',
    fields: [
      { name: 'OrderNo', label: '订单编号', type: 'varchar(50)', component: 'AutoNumber' },
      {
        name: 'PaymentLines',
        label: '付款明细',
        type: 'text',
        component: 'TableChild',
        relation: { cardinality: '1:N', targetTable: 'Biz_OrderPayment', childForeignKey: 'OrderId', childModule: '订单付款明细' },
      },
    ],
  });
  assert.equal(Object.hasOwn(childOnly, 'FormBannerMetrics'), false);
});

test('explicit empty descriptors suppress inference and ApiEngine metrics survive unchanged', () => {
  const banner = buildDefaultFormBanner({
    name: 'Biz_Order',
    fields,
    formBanner: {
      enabled: false,
      titleField: 'CustomerName',
      tagFields: [],
      metrics: [{ Key: 'Pending', Label: '待处理', ApiEngineKey: 'biz_order_metrics', ValuePath: 'Data.Pending', RefreshSeconds: 30 }],
    },
  });
  assert.equal(banner.FormBannerEnabled, 0);
  assert.equal(banner.FormBannerTitleField, 'CustomerName');
  assert.deepEqual(JSON.parse(String(banner.FormBannerTagFields)), []);
  assert.deepEqual(JSON.parse(String(banner.FormBannerMetrics)), [
    { Key: 'Pending', Label: '待处理', ApiEngineKey: 'biz_order_metrics', ValuePath: 'Data.Pending', RefreshSeconds: 30 },
  ]);
});

test('manifest plan validates Banner field references and includes configuration step', () => {
  const plan = buildPlan({
    name: '订单系统',
    tables: [{
      name: 'Biz_Order',
      fields,
      formBanner: { titleField: 'MissingTitle', tagFields: ['Status'] },
    }],
  });
  assert.equal(plan.plan.includes('configure_form_banner Biz_Order'), true);
  assert.equal(plan.errors.some((error) => error.includes('MissingTitle')), true);
});
