/**
 * Visual reading profile for every hand-maintained Chinese documentation page.
 *
 * Keep this list explicit. A new Chinese page must choose a profile instead of
 * silently inheriting a generic layout that nobody has reviewed.
 */
export const DOC_VISUAL_PROFILES = Object.freeze({
  'case/case-index': 'showcase',
  'case/crm/crm-case1': 'showcase',
  'case/erp/erp-case1': 'showcase',
  'case/ims/ims-case1': 'showcase',
  'case/internet/hourse': 'showcase',
  'case/iot/iot-case1': 'showcase',
  'case/oa/os-case1': 'showcase',
  'case/other/other-case1': 'showcase',
  'about/faq': 'guide',
  'about/microi-training-syllabus': 'guide',
  'about/partner': 'overview',
  'about/template': 'reference',
  'edition-comparison': 'showcase',
  'form-engine/all-form-component': 'reference',
  'form-engine/form-custom-control': 'guide',
  'form-engine/form-datasource': 'guide',
  'form-engine/form-engine-info': 'overview',
  'form-engine/form-field-info': 'reference',
  'form-engine/model-engine': 'reference',
  'getting-started/docker-run': 'guide',
  'getting-started/local-run': 'guide',
  'getting-started/source-code-architecture': 'overview',
  'getting-started/start-use': 'guide',
  'getting-started/win-install-microi': 'guide',
  'index': 'showcase',
  'more/copy-module': 'guide',
  'more/db-dictionary': 'reference',
  'more/dos-orm': 'reference',
  'more/dos-result': 'reference',
  'more/hdfs': 'guide',
  'more/identity-verification': 'policy',
  'more/office': 'guide',
  'more/security': 'policy',
  'more/sys-config': 'reference',
  'system-engine/ai-engine': 'overview',
  'system-engine/ai-platform-governance': 'overview',
  'system-engine/ai-workflow-suite': 'overview',
  'system-engine/app-store': 'guide',
  'system-engine/databases': 'guide',
  'system-engine/datasource-engine': 'overview',
  'system-engine/job': 'overview',
  'system-engine/message-notification': 'overview',
  'system-engine/file-manage': 'showcase',
  'system-engine/micro-app': 'showcase',
  'system-engine/microi-ui': 'showcase',
  'system-engine/module-engine': 'reference',
  'system-engine/mq': 'overview',
  'system-engine/mqtt-engine': 'overview',
  'system-engine/multi-end-client': 'overview',
  'system-engine/page-engine': 'reference',
  'system-engine/print-engine': 'guide',
  'system-engine/bluetooth-printer': 'guide',
  'system-engine/report-engine': 'overview',
  'system-engine/saas-engine': 'policy',
  'system-engine/search-engine': 'overview',
  'system-engine/spider-engine': 'guide',
  'system-engine/translate-engine': 'guide',
  'system-engine/unity-integration': 'guide',
  'system-engine/visualization-engine': 'overview',
  'system-engine/wf-engine': 'guide',
  'v8-engine/ai-apiengine': 'guide',
  'v8-engine/api-engine': 'reference',
  'v8-engine/apiengine-index': 'guide',
  'v8-engine/form-engine': 'reference',
  'v8-engine/mcp-server': 'guide',
  'v8-engine/v8-client': 'reference',
  'v8-engine/v8-server': 'reference',
  'v8-engine/vs-code-plugin': 'guide',
  'v8-engine/where': 'reference',
});

export const DOC_VISUAL_PROFILE_NAMES = Object.freeze([
  'overview',
  'guide',
  'reference',
  'policy',
  'showcase',
]);

export function normalizeChineseDocRoute(routePath = '') {
  const path = String(routePath).split(/[?#]/u, 1)[0].replace(/\/+$/u, '');
  if (path === '/doc' || path === '/doc/index.html') return 'index';
  if (path === '/case' || path === '/case/index.html') return 'case/case-index';
  if (path.startsWith('/doc/')) return path.slice('/doc/'.length).replace(/\.html$/u, '');
  if (path.startsWith('/case/')) return `case/${path.slice('/case/'.length).replace(/\.html$/u, '')}`;
  return '';
}

export function getDocVisualProfile(routePath = '') {
  return DOC_VISUAL_PROFILES[normalizeChineseDocRoute(routePath)] || '';
}
