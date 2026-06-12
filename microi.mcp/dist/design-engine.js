const defaultPageFormConfig = {
    gutter: 0,
    mask: false,
    drag: false,
    left: false,
    hover: false,
    shadow: true,
    link: true,
    watermark: false,
    mobile: false,
    dark: false,
    autoRefresh: 0,
    lastRefreshTime: '',
    watermarkStyle: {
        content: 'Microi',
        font: {
            fontSize: 16,
            color: 'rgba(255, 0, 0, 0.15)',
        },
        rotate: -22,
    },
    dynamicStyle: {
        padding: '10px',
        backgroundColor: '',
        opacity: 1,
    },
};
function asRecord(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
function parseJsonish(value) {
    if (value === undefined || value === null || value === '')
        return { ok: false, error: 'JSON value is empty.' };
    if (typeof value !== 'string')
        return { ok: true, value };
    try {
        return { ok: true, value: JSON.parse(value) };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
}
function mergeRecord(base, patch) {
    return { ...base, ...asRecord(patch) };
}
function randomNumber() {
    return Math.floor(Math.random() * 80000 + 10000);
}
function pageCode(title) {
    const suffix = Math.random().toString(36).slice(2, 8);
    const cleaned = title.replace(/[^\w\u4e00-\u9fa5]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24);
    return `page_${cleaned || 'ai'}_${suffix}`;
}
function param(sort, label, type, value, typeOptions) {
    const result = { sort, label, type, value };
    if (typeOptions)
        result.typeOptions = typeOptions;
    return result;
}
function baseWidgetOption(wrapperNumber, span, height) {
    return {
        number: randomNumber(),
        wrapperNumber,
        span,
        offset: 0,
        push: 0,
        pull: 0,
        height,
        marginTop: 0,
        dynamicStyle: {
            padding: '8px',
            backgroundColor: '',
        },
    };
}
function statParams(data, dark) {
    return [
        param(0, 'Data source', 'textarea', '', { rows: 3, dataJson: { data, searchData: [] } }),
        param(1, 'Grid width', 'slider', 6, { min: 1, max: 24, step: 1 }),
        param(2, 'Background', 'color', ''),
        param(3, 'Gap', 'input', '5px'),
        param(4, 'Block colors', 'input', '#2563eb,#16a34a,#f59e0b,#dc2626,#7c3aed,#0891b2'),
        param(5, 'Padding', 'input', '18px'),
        param(6, 'Radius', 'input', '8px'),
        param(7, 'Title size', 'input', '13px'),
        param(8, 'Title weight', 'input', '500'),
        param(9, 'Title color', 'color', dark ? '#dbeafe' : '#ffffff'),
        param(10, 'Title margin', 'input', '0 0 10px 0'),
        param(11, 'Value size', 'input', '22px'),
        param(12, 'Value weight', 'input', '700'),
        param(13, 'Value color', 'color', '#ffffff'),
        param(14, 'Icon position', 'radio', 'suffix'),
        param(15, 'Icon color', 'color', '#ffffff'),
        param(16, 'Icon size', 'input', '18px'),
        param(17, 'Background image', 'input', ''),
        param(18, 'Show search', 'switch', false),
        param(19, 'Date filter', 'switch', false),
        param(20, 'Precision', 'number', 0),
        param(21, 'Value padding', 'input', '0'),
        param(22, 'Value margin', 'input', '0'),
        param(23, 'Icon margin', 'input', '0'),
    ];
}
function chartParams(type, dataJson, title, unit = '') {
    if (type === 'pie') {
        return [
            param(0, 'Data source', 'textarea', '', { rows: 3, dataJson }),
            param(1, 'Show search', 'switch', false),
            param(2, 'Inner radius', 'number', 36),
            param(3, 'Outer radius', 'number', 92),
            param(4, 'Unit', 'input', unit),
            param(5, 'Title', 'input', title),
            param(6, 'Subtitle', 'input', ''),
            param(7, 'Show legend', 'switch', true),
            param(8, 'Legend orient', 'select', 'vertical'),
            param(9, 'Legend position', 'select', 'left'),
            param(10, 'Tooltip', 'switch', true),
            param(11, 'Trigger', 'select', 'item'),
            param(12, 'Toolbox', 'switch', false),
            param(13, 'Show label', 'switch', true),
            param(14, 'Label position', 'select', 'outside'),
            param(15, 'Border radius', 'number', 8),
            param(16, 'Border width', 'number', 2),
            param(17, 'Pad angle', 'number', 2),
            param(18, 'Nightingale', 'switch', false),
            param(19, 'Date filter', 'switch', false),
            param(20, 'Label format', 'input', '{d}%'),
        ];
    }
    return [
        param(0, 'Data source', 'textarea', '', { rows: 3, dataJson }),
        param(1, 'Show search', 'switch', false),
        param(2, 'Boundary gap', 'switch', type === 'bar'),
        param(3, 'Bar effect', 'select', 'shadow'),
        param(4, 'Unit', 'input', unit),
        param(5, 'Title', 'input', title),
        param(6, 'Subtitle', 'input', ''),
        param(7, 'Show legend', 'switch', true),
        param(8, 'Legend orient', 'select', 'horizontal'),
        param(9, 'Legend position', 'select', 'center'),
        param(10, 'Tooltip', 'switch', true),
        param(11, 'Trigger', 'select', 'axis'),
        param(12, 'Toolbox', 'switch', false),
        param(13, 'Show label', 'switch', type === 'bar'),
        param(14, 'Label position', 'select', 'outside'),
        param(15, 'Split line', 'switch', true),
        param(16, 'Date filter', 'switch', false),
        param(17, 'Rotate', 'switch', false),
    ];
}
function tableParams(dataJson) {
    return [
        param(0, 'Data source', 'textarea', '', { rows: 3, dataJson }),
        param(1, 'Show search', 'switch', false),
        param(2, 'Stripe', 'switch', true),
        param(3, 'Border', 'switch', true),
        param(4, 'Size', 'select', 'small'),
        param(5, 'Progress width', 'number', 16),
        param(6, 'Merge column', 'input', ''),
        param(7, 'Page size', 'number', -1),
        param(8, 'Summary', 'switch', false),
        param(9, 'Border color', 'color', 'var(--el-border-color-lighter)'),
        param(10, 'Header background', 'color', 'var(--el-fill-color-light)'),
        param(11, 'Header color', 'color', 'var(--el-table-header-text-color)'),
        param(12, 'Text color', 'color', 'var(--el-table-text-color)'),
        param(13, 'Date filter', 'switch', false),
        param(14, 'Pie width', 'number', 30),
        param(15, 'Pie background', 'color', '#409eff50'),
        param(16, 'Pie border', 'color', '#409eff'),
    ];
}
function makeWidget(type, label, wrapperNumber, span, height, widgetParams) {
    return {
        type,
        label,
        category: 0,
        show: 1,
        icon: '',
        img: '',
        widgetOption: baseWidgetOption(wrapperNumber, span, height),
        widgetParams,
    };
}
function makeWrapper(title, span, height, widgetListFactory, dark) {
    const wrapperNumber = randomNumber();
    return {
        type: 'pannel',
        label: 'Card',
        hidden: false,
        icon: '',
        img: '',
        wrapperOption: {
            number: wrapperNumber,
            gutter: 0,
            span,
            offset: 0,
            push: 0,
            pull: 0,
            height,
            marginTop: 0,
            margin: '0px 10px 10px 0px',
            pannelColor: dark ? '#111827' : '#ffffff',
            dynamicStyle: {
                padding: '12px',
                backgroundColor: dark ? '#111827' : '#ffffff',
            },
            titleOption: {
                hidden: true,
                title,
                dynamicStyle: {
                    textAlign: 'left',
                    padding: '0px',
                    height: '22px',
                    lineHeight: '22px',
                    fontSize: '14px',
                    color: dark ? '#e5e7eb' : '#111827',
                },
                moreOption: {
                    hidden: false,
                    icon: 'More',
                    iconShow: false,
                    text: 'More',
                    linkurl: '/',
                    linktype: 'router',
                    refresh: '0',
                    datetime: '0',
                    autotime: false,
                    autotimeval: 1,
                    dynamicStyle: {
                        color: dark ? '#93c5fd' : '#2563eb',
                        fontSize: '12px',
                    },
                },
            },
        },
        widgetList: widgetListFactory(wrapperNumber),
    };
}
function scenarioFromPrompt(prompt, theme) {
    const text = `${prompt} ${theme || ''}`.toLowerCase();
    if (/维保|维修|设备|工单|巡检|maintenance|service|ticket|asset/.test(text))
        return 'maintenance';
    if (/商城|商品|库存|订单|门店|mall|shop|ecommerce|retail|sku/.test(text))
        return 'mall';
    if (/财务|发票|收款|付款|finance|invoice|payment/.test(text))
        return 'finance';
    if (/销售|客户|商机|营收|sales|customer|crm|revenue/.test(text))
        return 'sales';
    return 'operations';
}
function scenarioData(scenario) {
    if (scenario === 'maintenance') {
        return {
            title: '维保运营驾驶舱',
            subtitle: '工单、设备、巡检与客户服务状态总览',
            stats: [
                { name: '今日工单', value: 86, icon: 'Tickets', bgColor: '#2563eb', bgImage: '', linkUrl: '/' },
                { name: '待派单', value: 14, icon: 'Clock', bgColor: '#f59e0b', bgImage: '', linkUrl: '/' },
                { name: '按时完成率', value: 96, icon: 'Top', bgColor: '#16a34a', bgImage: '', linkUrl: '/' },
                { name: '高风险设备', value: 7, icon: 'Warning', bgColor: '#dc2626', bgImage: '', linkUrl: '/' },
            ],
            xAxis: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
            barSeries: [
                { name: '新增工单', data: [18, 22, 16, 28, 31, 20, 14] },
                { name: '完成工单', data: [15, 20, 18, 24, 29, 21, 16] },
            ],
            lineSeries: [
                { name: '响应时长(分钟)', data: [42, 38, 35, 33, 31, 29, 28] },
                { name: '满意度', data: [92, 93, 94, 94, 95, 96, 96] },
            ],
            pieData: [
                { name: '待接单', value: 14 },
                { name: '处理中', value: 28 },
                { name: '待验收', value: 17 },
                { name: '已完成', value: 63 },
            ],
            tableHeaders: [
                { prop: 'WorkOrderNo', label: '工单号', align: 'center' },
                { prop: 'CustomerName', label: '客户', align: 'center' },
                { prop: 'DeviceName', label: '设备', align: 'center' },
                { prop: 'Status', label: '状态', align: 'center', status_ui: true },
                { prop: 'Owner', label: '负责人', align: 'center' },
            ],
            tableRows: [
                { WorkOrderNo: 'WO-20260611-001', CustomerName: '利轩科技园', DeviceName: '空压机 A01', Status: '处理中', Owner: '张工', status_ui: 'warning' },
                { WorkOrderNo: 'WO-20260611-002', CustomerName: '星河工厂', DeviceName: '冷却塔 C03', Status: '待验收', Owner: '李工', status_ui: 'primary' },
                { WorkOrderNo: 'WO-20260611-003', CustomerName: '北城仓储', DeviceName: '配电柜 P12', Status: '已完成', Owner: '王工', status_ui: 'success' },
            ],
        };
    }
    if (scenario === 'mall') {
        return {
            title: '商城经营看板',
            subtitle: '订单、商品、库存与会员增长概览',
            stats: [
                { name: '今日订单', value: 328, icon: 'ShoppingCart', bgColor: '#2563eb', bgImage: '', linkUrl: '/' },
                { name: '销售额', value: 128900, icon: 'Money', bgColor: '#16a34a', bgImage: '', linkUrl: '/' },
                { name: '低库存 SKU', value: 23, icon: 'Warning', bgColor: '#f59e0b', bgImage: '', linkUrl: '/' },
                { name: '新增会员', value: 78, icon: 'User', bgColor: '#7c3aed', bgImage: '', linkUrl: '/' },
            ],
            xAxis: ['1月', '2月', '3月', '4月', '5月', '6月'],
            barSeries: [
                { name: '订单数', data: [1200, 1420, 1380, 1680, 1910, 2250] },
                { name: '发货数', data: [1160, 1390, 1350, 1610, 1880, 2190] },
            ],
            lineSeries: [
                { name: '销售额', data: [82, 96, 91, 116, 132, 158] },
                { name: '复购率', data: [28, 31, 30, 34, 36, 39] },
            ],
            pieData: [
                { name: '食品饮料', value: 35 },
                { name: '家清日化', value: 24 },
                { name: '数码家电', value: 18 },
                { name: '服饰鞋包', value: 23 },
            ],
            tableHeaders: [
                { prop: 'SkuName', label: '商品', align: 'center' },
                { prop: 'Stock', label: '库存', align: 'center' },
                { prop: 'Sales', label: '销量', align: 'center' },
                { prop: 'Status', label: '状态', align: 'center', status_ui: true },
            ],
            tableRows: [
                { SkuName: '轻食燕麦组合', Stock: 128, Sales: 486, Status: '热销', status_ui: 'success' },
                { SkuName: '无线耳机 Pro', Stock: 18, Sales: 221, Status: '低库存', status_ui: 'warning' },
                { SkuName: '智能水杯', Stock: 76, Sales: 164, Status: '正常', status_ui: 'primary' },
            ],
        };
    }
    return {
        title: scenario === 'sales' ? '销售运营仪表盘' : scenario === 'finance' ? '财务收付款看板' : '综合运营驾驶舱',
        subtitle: '核心指标、趋势分析、结构分布与明细列表',
        stats: [
            { name: '本月目标', value: 128, icon: 'Aim', bgColor: '#2563eb', bgImage: '', linkUrl: '/' },
            { name: '已完成', value: 96, icon: 'Top', bgColor: '#16a34a', bgImage: '', linkUrl: '/' },
            { name: '待处理', value: 18, icon: 'Clock', bgColor: '#f59e0b', bgImage: '', linkUrl: '/' },
            { name: '风险项', value: 6, icon: 'Warning', bgColor: '#dc2626', bgImage: '', linkUrl: '/' },
        ],
        xAxis: ['1月', '2月', '3月', '4月', '5月', '6月'],
        barSeries: [
            { name: '计划', data: [80, 92, 100, 116, 124, 138] },
            { name: '实际', data: [76, 88, 96, 110, 129, 146] },
        ],
        lineSeries: [
            { name: '增长率', data: [8, 12, 10, 16, 18, 21] },
            { name: '达成率', data: [88, 91, 93, 94, 96, 98] },
        ],
        pieData: [
            { name: 'A 类', value: 42 },
            { name: 'B 类', value: 28 },
            { name: 'C 类', value: 18 },
            { name: '其他', value: 12 },
        ],
        tableHeaders: [
            { prop: 'Name', label: '名称', align: 'center' },
            { prop: 'Owner', label: '负责人', align: 'center' },
            { prop: 'Progress', label: '进度', align: 'center', progress_ui: true },
            { prop: 'Status', label: '状态', align: 'center', status_ui: true },
        ],
        tableRows: [
            { Name: '重点项目 A', Owner: '陈晨', Progress: 92, Status: '进行中', progress_ui: 'success', status_ui: 'success' },
            { Name: '客户跟进 B', Owner: '林曦', Progress: 68, Status: '待推进', progress_ui: 'warning', status_ui: 'warning' },
            { Name: '风险整改 C', Owner: '赵宁', Progress: 35, Status: '预警', progress_ui: 'exception', status_ui: 'danger' },
        ],
    };
}
export function buildPageDesign(input) {
    const prompt = input.prompt || '';
    const scenario = scenarioFromPrompt(prompt, input.theme);
    const dark = /dark|深色|黑色|大屏|驾驶舱/.test(`${prompt} ${input.style || ''}`.toLowerCase());
    const data = scenarioData(scenario);
    const title = input.title || data.title;
    const desc = input.desc || data.subtitle;
    const background = dark ? '#0f172a' : '#f3f4f6';
    return {
        formConfig: {
            ...defaultPageFormConfig,
            dark,
            title,
            dynamicStyle: {
                padding: '12px 0 0 0',
                backgroundColor: background,
                opacity: 1,
            },
        },
        wrapperList: [
            makeWrapper(title, 24, 120, (wrapperNumber) => [
                makeWidget('workbench', 'Workbench', wrapperNumber, 24, 90, [
                    param(0, 'Data source', 'textarea', '', {
                        rows: 3,
                        dataJson: {
                            icon: '',
                            title,
                            subTitle: desc,
                        },
                    }),
                ]),
            ], dark),
            makeWrapper('核心指标', 24, 160, (wrapperNumber) => [
                makeWidget('statistic', 'Statistic', wrapperNumber, 24, 130, statParams(data.stats, dark)),
            ], dark),
            makeWrapper('趋势分析', 12, 340, (wrapperNumber) => [
                makeWidget('bar', 'Bar Chart', wrapperNumber, 24, 300, chartParams('bar', {
                    xAxis: data.xAxis,
                    series: data.barSeries,
                    searchData: [],
                }, '业务趋势', '')),
            ], dark),
            makeWrapper('结构占比', 12, 340, (wrapperNumber) => [
                makeWidget('pie', 'Pie Chart', wrapperNumber, 24, 300, chartParams('pie', {
                    data: data.pieData,
                    searchData: [],
                }, '分类占比', '')),
            ], dark),
            makeWrapper('效率走势', 12, 340, (wrapperNumber) => [
                makeWidget('line', 'Line Chart', wrapperNumber, 24, 300, chartParams('line', {
                    xAxis: data.xAxis,
                    series: data.lineSeries,
                    searchData: [],
                }, '效率走势', '')),
            ], dark),
            makeWrapper('重点明细', 12, 340, (wrapperNumber) => [
                makeWidget('tabel', 'Table', wrapperNumber, 24, 300, tableParams({
                    headerData: data.tableHeaders,
                    bodyData: data.tableRows,
                    total: data.tableRows.length,
                    searchData: [],
                })),
            ], dark),
        ],
    };
}
function textElement(left, top, width, height, title, options = {}) {
    return {
        options: {
            left,
            top,
            width,
            height,
            title,
            fontSize: 9,
            lineHeight: height,
            ...options,
        },
        printElementType: { title: 'Text', type: 'text' },
    };
}
function hline(left, top, width) {
    return {
        options: { left, top, width, height: 1, borderStyle: 'solid' },
        printElementType: { title: 'Line', type: 'hline' },
    };
}
function rect(left, top, width, height) {
    return {
        options: { left, top, width, height, borderWidth: 1 },
        printElementType: { title: 'Rect', type: 'rect' },
    };
}
function printScenario(prompt) {
    return scenarioFromPrompt(prompt);
}
export function buildPrintTemplateDesign(input) {
    const scenario = printScenario(input.prompt || '');
    const title = input.title || (scenario === 'maintenance' ? '维保工单打印模板' : scenario === 'mall' ? '商城订单打印模板' : '业务单据打印模板');
    const tableField = scenario === 'maintenance' ? 'Items' : 'Details';
    const columns = scenario === 'maintenance'
        ? [
            [{ title: '项目', field: 'ItemName', width: 120, checked: true }, { title: '处理结果', field: 'Result', width: 180, checked: true }, { title: '工时', field: 'Hours', width: 80, checked: true }, { title: '备注', field: 'Remark', width: 150, checked: true }],
        ]
        : [
            [{ title: '名称', field: 'Name', width: 150, checked: true }, { title: '规格', field: 'Spec', width: 120, checked: true }, { title: '数量', field: 'Qty', width: 80, checked: true }, { title: '金额', field: 'Amount', width: 100, checked: true }, { title: '备注', field: 'Remark', width: 120, checked: true }],
        ];
    const printObj = scenario === 'maintenance'
        ? {
            WorkOrderNo: 'WO-20260611-001',
            CustomerName: '利轩科技园',
            ContactName: '王经理',
            DeviceName: '空压机 A01',
            ServiceDate: '2026-06-11',
            EngineerName: '张工',
            FaultDesc: '设备运行异响，压力波动异常。',
            Solution: '完成轴承检查、管路紧固与运行测试。',
            Items: [
                { ItemName: '现场检查', Result: '已完成', Hours: 1.5, Remark: '运行记录正常' },
                { ItemName: '部件维护', Result: '已完成', Hours: 2, Remark: '更换易损件' },
            ],
        }
        : {
            BillNo: 'BILL-20260611-001',
            CustomerName: '示例客户',
            ContactName: '李经理',
            BillDate: '2026-06-11',
            OwnerName: '陈晨',
            Summary: '业务单据摘要说明。',
            Details: [
                { Name: '服务项目 A', Spec: '标准', Qty: 2, Amount: 1200, Remark: '含税' },
                { Name: '服务项目 B', Spec: '高级', Qty: 1, Amount: 2800, Remark: '含安装' },
            ],
        };
    const elements = [
        textElement(40, 18, 520, 24, title, { fontSize: 18, fontWeight: '700', textAlign: 'center', lineHeight: 24 }),
        hline(36, 50, 535),
        textElement(42, 66, 76, 16, scenario === 'maintenance' ? '工单号' : '单据号', { fontWeight: '600' }),
        textElement(118, 66, 160, 16, '', { field: scenario === 'maintenance' ? 'WorkOrderNo' : 'BillNo', testData: scenario === 'maintenance' ? printObj.WorkOrderNo : printObj.BillNo }),
        textElement(320, 66, 76, 16, '日期', { fontWeight: '600' }),
        textElement(396, 66, 160, 16, '', { field: scenario === 'maintenance' ? 'ServiceDate' : 'BillDate', testData: scenario === 'maintenance' ? printObj.ServiceDate : printObj.BillDate }),
        textElement(42, 92, 76, 16, '客户', { fontWeight: '600' }),
        textElement(118, 92, 160, 16, '', { field: 'CustomerName', testData: printObj.CustomerName }),
        textElement(320, 92, 76, 16, '联系人', { fontWeight: '600' }),
        textElement(396, 92, 160, 16, '', { field: 'ContactName', testData: printObj.ContactName }),
        textElement(42, 118, 76, 16, scenario === 'maintenance' ? '设备' : '负责人', { fontWeight: '600' }),
        textElement(118, 118, 160, 16, '', { field: scenario === 'maintenance' ? 'DeviceName' : 'OwnerName', testData: scenario === 'maintenance' ? printObj.DeviceName : printObj.OwnerName }),
        textElement(320, 118, 76, 16, scenario === 'maintenance' ? '工程师' : '制单人', { fontWeight: '600' }),
        textElement(396, 118, 160, 16, '', { field: scenario === 'maintenance' ? 'EngineerName' : 'OwnerName', testData: scenario === 'maintenance' ? printObj.EngineerName : printObj.OwnerName }),
        rect(38, 150, 535, 70),
        textElement(48, 160, 70, 16, scenario === 'maintenance' ? '故障描述' : '摘要', { fontWeight: '600' }),
        textElement(118, 160, 430, 46, '', { field: scenario === 'maintenance' ? 'FaultDesc' : 'Summary', testData: scenario === 'maintenance' ? printObj.FaultDesc : printObj.Summary, lineHeight: 18 }),
        textElement(42, 242, 160, 16, '明细', { fontSize: 12, fontWeight: '700' }),
        {
            options: {
                left: 40,
                top: 266,
                width: 530,
                height: 92,
                field: tableField,
                columns,
                fields: columns[0].map((column) => ({ text: column.title, field: column.field })),
            },
            printElementType: { title: 'Table', type: 'table' },
        },
        textElement(42, 392, 76, 16, scenario === 'maintenance' ? '处理方案' : '备注', { fontWeight: '600' }),
        textElement(118, 392, 430, 38, '', { field: scenario === 'maintenance' ? 'Solution' : 'Summary', testData: scenario === 'maintenance' ? printObj.Solution : printObj.Summary, lineHeight: 18 }),
        hline(36, 468, 535),
        textElement(60, 492, 120, 16, '客户签字：'),
        textElement(330, 492, 120, 16, '经办人签字：'),
    ];
    const pageObj = {
        panels: [
            {
                index: 0,
                name: title,
                paperType: input.paperType || 'A4',
                height: 297,
                width: 210,
                paperHeader: 0,
                paperFooter: 841.8897637795277,
                paperNumberContinue: true,
                watermarkOptions: {},
                panelLayoutOptions: {},
                printElements: elements,
            },
        ],
    };
    return { pageObj, printObj };
}
function unwrapPageCandidate(value) {
    const parsed = parseJsonish(value);
    if (!parsed.ok)
        return value;
    let current = parsed.value;
    if (typeof current === 'string') {
        const again = parseJsonish(current);
        if (again.ok)
            current = again.value;
    }
    const record = asRecord(current);
    if (record.JsonObj !== undefined)
        return unwrapPageCandidate(record.JsonObj);
    if (record.jsonObj !== undefined)
        return unwrapPageCandidate(record.jsonObj);
    if (record.JsonStr !== undefined)
        return unwrapPageCandidate(record.JsonStr);
    if (record.jsonStr !== undefined)
        return unwrapPageCandidate(record.jsonStr);
    const formData = asRecord(record.formData ?? record.FormData);
    if (Object.keys(formData).length) {
        if (formData.JsonObj !== undefined)
            return unwrapPageCandidate(formData.JsonObj);
        if (formData.jsonObj !== undefined)
            return unwrapPageCandidate(formData.jsonObj);
        if (formData.formConfig !== undefined || formData.wrapperList !== undefined)
            return formData;
    }
    return current;
}
export function normalizePageJsonObj(value) {
    const candidate = unwrapPageCandidate(value);
    const parsed = parseJsonish(candidate);
    if (!parsed.ok)
        return { ok: false, errors: [`JsonObj is not valid JSON: ${parsed.error}`], warnings: [] };
    const obj = asRecord(parsed.value);
    const errors = [];
    const warnings = [];
    if (!Object.keys(obj).length)
        errors.push('JsonObj must be an object.');
    if (obj.formConfig !== undefined && Object.keys(asRecord(obj.formConfig)).length === 0)
        warnings.push('formConfig is empty; defaults were applied.');
    if (obj.wrapperList !== undefined && !Array.isArray(obj.wrapperList))
        errors.push('JsonObj.wrapperList must be an array.');
    const wrapperList = Array.isArray(obj.wrapperList) ? obj.wrapperList.map((item, index) => {
        const wrapper = asRecord(item);
        if (!getString(wrapper, 'type'))
            wrapper.type = 'pannel';
        if (!getString(wrapper, 'label'))
            wrapper.label = 'Card';
        if (wrapper.hidden === undefined)
            wrapper.hidden = false;
        wrapper.icon = wrapper.icon ?? '';
        wrapper.img = wrapper.img ?? '';
        wrapper.wrapperOption = mergeRecord({
            number: randomNumber(),
            gutter: 0,
            span: 24,
            offset: 0,
            push: 0,
            pull: 0,
            height: 300,
            marginTop: 0,
            margin: '0px 10px 10px 0px',
            pannelColor: '',
            dynamicStyle: { padding: '10px', backgroundColor: '' },
            titleOption: {
                hidden: true,
                title: `Section ${index + 1}`,
                dynamicStyle: { textAlign: 'left', padding: '0px', height: '20px', lineHeight: '20px', fontSize: '14px', color: '' },
                moreOption: { hidden: false, icon: 'More', iconShow: false, text: 'More', linkurl: '/', linktype: 'router', refresh: '0', datetime: '0', autotime: false, autotimeval: 1, dynamicStyle: { color: '', fontSize: '12px' } },
            },
        }, wrapper.wrapperOption);
        if (!Array.isArray(wrapper.widgetList)) {
            wrapper.widgetList = [];
            warnings.push(`wrapperList[${index}].widgetList was missing and was set to an empty array.`);
        }
        else {
            wrapper.widgetList = wrapper.widgetList.map((widget, widgetIndex) => {
                const widgetRecord = asRecord(widget);
                if (!getString(widgetRecord, 'type'))
                    errors.push(`wrapperList[${index}].widgetList[${widgetIndex}].type is required.`);
                widgetRecord.label = widgetRecord.label ?? widgetRecord.type ?? 'Widget';
                widgetRecord.category = widgetRecord.category ?? 0;
                widgetRecord.show = widgetRecord.show ?? 1;
                widgetRecord.icon = widgetRecord.icon ?? '';
                widgetRecord.img = widgetRecord.img ?? '';
                widgetRecord.widgetOption = mergeRecord({
                    number: randomNumber(),
                    wrapperNumber: asRecord(wrapper.wrapperOption).number,
                    span: 24,
                    offset: 0,
                    push: 0,
                    pull: 0,
                    height: 260,
                    marginTop: 0,
                    dynamicStyle: { padding: '8px', backgroundColor: '' },
                }, widgetRecord.widgetOption);
                if (!Array.isArray(widgetRecord.widgetParams)) {
                    widgetRecord.widgetParams = [param(0, 'Data source', 'textarea', '', { rows: 3, dataJson: {} })];
                    warnings.push(`wrapperList[${index}].widgetList[${widgetIndex}].widgetParams was missing and a safe data param was added.`);
                }
                return widgetRecord;
            });
        }
        return wrapper;
    }) : [];
    if (!Array.isArray(obj.wrapperList))
        warnings.push('wrapperList was missing and was set to an empty array.');
    const normalized = {
        formConfig: {
            ...defaultPageFormConfig,
            ...asRecord(obj.formConfig),
            dynamicStyle: {
                ...asRecord(defaultPageFormConfig.dynamicStyle),
                ...asRecord(asRecord(obj.formConfig).dynamicStyle),
            },
            watermarkStyle: {
                ...asRecord(defaultPageFormConfig.watermarkStyle),
                ...asRecord(asRecord(obj.formConfig).watermarkStyle),
            },
        },
        wrapperList,
    };
    return {
        ok: errors.length === 0,
        value: normalized,
        json: JSON.stringify(normalized),
        errors,
        warnings,
    };
}
function unwrapPrintCandidate(value) {
    const parsed = parseJsonish(value);
    if (!parsed.ok)
        return value;
    let current = parsed.value;
    const record = asRecord(current);
    if (record.PageObj !== undefined)
        current = record.PageObj;
    else if (record.pageObj !== undefined)
        current = record.pageObj;
    return current;
}
export function normalizePrintPageObj(value) {
    const candidate = unwrapPrintCandidate(value);
    const parsed = parseJsonish(candidate);
    if (!parsed.ok)
        return { ok: false, errors: [`PageObj is not valid JSON: ${parsed.error}`], warnings: [] };
    const obj = asRecord(parsed.value);
    const errors = [];
    const warnings = [];
    if (!Array.isArray(obj.panels))
        errors.push('PageObj.panels must be an array.');
    const panels = Array.isArray(obj.panels) ? obj.panels.map((panel, panelIndex) => {
        const panelRecord = asRecord(panel);
        panelRecord.index = panelRecord.index ?? panelIndex;
        panelRecord.name = panelRecord.name ?? `Panel ${panelIndex + 1}`;
        panelRecord.paperType = panelRecord.paperType ?? 'A4';
        panelRecord.height = panelRecord.height ?? 297;
        panelRecord.width = panelRecord.width ?? 210;
        panelRecord.paperHeader = panelRecord.paperHeader ?? 0;
        panelRecord.paperFooter = panelRecord.paperFooter ?? 841.8897637795277;
        panelRecord.paperNumberContinue = panelRecord.paperNumberContinue ?? true;
        panelRecord.watermarkOptions = panelRecord.watermarkOptions ?? {};
        panelRecord.panelLayoutOptions = panelRecord.panelLayoutOptions ?? {};
        if (!Array.isArray(panelRecord.printElements)) {
            panelRecord.printElements = [];
            warnings.push(`panels[${panelIndex}].printElements was missing and was set to an empty array.`);
        }
        panelRecord.printElements = panelRecord.printElements.map((element, elementIndex) => {
            const elementRecord = asRecord(element);
            const type = getString(asRecord(elementRecord.printElementType), 'type');
            if (!type)
                errors.push(`panels[${panelIndex}].printElements[${elementIndex}].printElementType.type is required.`);
            elementRecord.options = asRecord(elementRecord.options);
            return elementRecord;
        });
        return panelRecord;
    }) : [];
    if (panels.length === 0)
        errors.push('PageObj.panels must contain at least one panel.');
    return {
        ok: errors.length === 0,
        value: { ...obj, panels },
        json: JSON.stringify({ ...obj, panels }),
        errors,
        warnings,
    };
}
export function normalizePrintObj(value) {
    if (value === undefined || value === null || value === '') {
        return { ok: true, value: {}, json: '{}', errors: [], warnings: [] };
    }
    const parsed = parseJsonish(value);
    if (!parsed.ok)
        return { ok: false, errors: [`PrintObj is not valid JSON: ${parsed.error}`], warnings: [] };
    return { ok: true, value: parsed.value, json: JSON.stringify(parsed.value), errors: [], warnings: [] };
}
function getString(record, ...keys) {
    for (const key of keys) {
        const value = record[key];
        if (typeof value === 'string' && value.trim())
            return value.trim();
        if (typeof value === 'number' || typeof value === 'boolean')
            return String(value);
    }
    return '';
}
export function pageDesignPayload(input) {
    const scenario = scenarioData(scenarioFromPrompt(input.prompt || '', input.theme));
    const title = input.title || scenario.title;
    const jsonObj = buildPageDesign({ ...input, title });
    return {
        title,
        number: input.number || pageCode(title),
        desc: input.desc || scenario.subtitle || getString(asRecord(jsonObj.formConfig), 'title') || '',
        jsonObj,
        jsonStr: JSON.stringify(jsonObj),
    };
}
export function printDesignPayload(input) {
    const built = buildPrintTemplateDesign(input);
    const panels = Array.isArray(built.pageObj.panels) ? built.pageObj.panels : [];
    const title = input.title || getString(asRecord(panels[0]), 'name') || 'AI print template';
    const number = input.number || `print_${Math.random().toString(36).slice(2, 8)}`;
    return {
        title,
        number,
        desc: input.desc || '',
        pageObj: built.pageObj,
        pageObjStr: JSON.stringify(built.pageObj),
        printObj: built.printObj,
        printObjStr: JSON.stringify(built.printObj),
        dataApi: input.dataApi || '',
    };
}
//# sourceMappingURL=design-engine.js.map