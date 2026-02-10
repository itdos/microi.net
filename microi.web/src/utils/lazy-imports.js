/**
 * 大型库懒加载配置
 * 用于优化首屏加载性能
 * 
 * 使用方式：
 * import { loadMonacoEditor } from '@/utils/lazy-imports';
 * const monaco = await loadMonacoEditor();
 * 
 * 注意：Monaco Editor 已在 diy-code-editor.vue 中通过动态 import() 实现懒加载
 * Office 组件已在 office-widget.vue 中通过 defineAsyncComponent 实现懒加载
 */

// Monaco Editor 懒加载（已在 diy-code-editor.vue 中使用动态 import）
export const loadMonacoEditor = () => {
    return import('monaco-editor').then(monaco => {
        return monaco;
    });
};

// Monaco Workers 懒加载
export const loadMonacoWorkers = async () => {
    const [jsonWorker, cssWorker, htmlWorker, tsWorker, editorWorker] = await Promise.all([
        import('monaco-editor/esm/vs/language/json/json.worker?worker'),
        import('monaco-editor/esm/vs/language/css/css.worker?worker'),
        import('monaco-editor/esm/vs/language/html/html.worker?worker'),
        import('monaco-editor/esm/vs/language/typescript/ts.worker?worker'),
        import('monaco-editor/esm/vs/editor/editor.worker?worker')
    ]);
    return {
        jsonWorker: jsonWorker.default,
        cssWorker: cssWorker.default,
        htmlWorker: htmlWorker.default,
        tsWorker: tsWorker.default,
        editorWorker: editorWorker.default
    };
};

// Office 文档预览懒加载
export const loadOfficeDocx = () => {
    return import('@vue-office/docx');
};

export const loadOfficeExcel = () => {
    return import('@vue-office/excel');
};

export const loadOfficePdf = () => {
    return import('@vue-office/pdf');
};

// 富文本编辑器懒加载
export const loadWangEditor = () => {
    return import('@wangeditor/editor-for-vue');
};

// Three.js 懒加载
export const loadThree = () => {
    return import('three');
};

// Gantt 甘特图懒加载
export const loadGantt = () => {
    return import('dhtmlx-gantt');
};

// FullCalendar 日历懒加载
export const loadFullCalendar = () => {
    return import('@fullcalendar/vue3');
};

// Chart.js 图表懒加载(如果只在特定页面使用)
export const loadChart = () => {
    return import('vue-chart-3');
};

// Excel 处理懒加载
export const loadXlsx = () => {
    return import('xlsx');
};

// CodeMirror 懒加载
export const loadCodeMirror = () => {
    return import('codemirror');
};

// 打印库懒加载
export const loadHiprint = () => {
    return import('vue-plugin-hiprint');
};
