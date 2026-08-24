import assert from "node:assert/strict";
import test from "node:test";
import XLSX from "xlsx";
import {
    analyzeExcelWorkbook,
    buildImportMetadata,
    buildImportTargets,
    decodeCsvArrayBuffer,
    IMPORT_ERROR_POLICY,
    normalizeImportErrorPolicy,
    IMPORT_PREVIEW_PAGE_SIZE
} from "../src/views/form-engine/utils/excel-import-analyzer.js";

function workbookFromRows(rows, merges = [], name = "Sheet1") {
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!merges"] = merges.map((range) => XLSX.utils.decode_range(range));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, name);
    return workbook;
}

const fields = [
    { Name: "CustomerName", Label: "客户名称", Component: "Text" },
    { Name: "CustomerCode", Label: "客户编码", Component: "Text" },
    { Name: "Phone", Label: "手机号", Component: "Text" },
    { Name: "LayoutOnly", Label: "布局", Component: "CollapseGroup" }
];

test("detects instructions, merged multi-level headers, and the first real data row", () => {
    const workbook = workbookFromRows([
        ["客户资料导入模板"],
        ["说明：蓝色区域为系统说明，图片和文字不参与导入"],
        [],
        ["基本信息", null, "联系信息"],
        ["客户名称", "客户编码", "手机号"],
        ["甲公司", "C001", "13800000000"],
        ["乙公司", "C002", "13900000000"]
    ], ["A4:B4"], "客户");

    const result = analyzeExcelWorkbook(XLSX, workbook, {
        targets: buildImportTargets(fields)
    });

    assert.equal(result.sheetName, "客户");
    assert.deepEqual([result.headerStartRow, result.headerEndRow], [4, 5]);
    assert.deepEqual([result.dataStartRow, result.dataEndRow], [6, 7]);
    assert.equal(result.confidence, "high");
    assert.deepEqual(
        result.columns.map((column) => [column.header, column.targetName]),
        [
            ["基本信息 / 客户名称", "CustomerName"],
            ["基本信息 / 客户编码", "CustomerCode"],
            ["联系信息 / 手机号", "Phone"]
        ]
    );
    assert.deepEqual(result.rows[0], {
        _ExcelRow: 6,
        CustomerName: "甲公司",
        CustomerCode: "C001",
        Phone: "13800000000"
    });
});

test("automatically skips an instruction sheet and selects the business data sheet", () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
        ["导入使用说明"],
        ["说明：请勿修改模板中的字段名称"],
        ["提示：图片和示例文字不会参与导入"]
    ]), "使用说明");
    const dataSheet = XLSX.utils.aoa_to_sheet([
        ["客户资料导入模板"],
        ["填写说明：第 5 行开始录入数据"],
        ["基本信息", null, "联系信息"],
        ["客户名称", "客户编码", "手机号"],
        ["甲公司", "C001", "13800000000"],
        ["乙公司", "C002", "13900000000"]
    ]);
    dataSheet["!merges"] = [XLSX.utils.decode_range("A3:B3")];
    XLSX.utils.book_append_sheet(workbook, dataSheet, "客户数据");

    const result = analyzeExcelWorkbook(XLSX, workbook, {
        targets: buildImportTargets(fields),
        autoDetectSheet: true
    });

    assert.equal(result.sheetName, "客户数据");
    assert.deepEqual([result.headerStartRow, result.headerEndRow], [3, 4]);
    assert.deepEqual([result.dataStartRow, result.dataEndRow], [5, 6]);
    assert.equal(result.rows.length, 2);
});

test("keeps an unknown workbook available for manual row and column mapping", () => {
    const workbook = workbookFromRows([
        ["任意模板"],
        ["内部简称", "内部号码"],
        ["甲", "001"],
        ["乙", "002"]
    ]);
    const automatic = analyzeExcelWorkbook(XLSX, workbook, {
        targets: buildImportTargets(fields)
    });

    assert.equal(automatic.mappedColumnCount, 0);
    assert.equal(automatic.sourceRowCount, 2);
    assert.equal(automatic.rows.length, 0);
    assert.deepEqual(automatic.sourceRows, [
        { _ExcelRow: 3, _ImportSourceColumn_0: "甲", _ImportSourceColumn_1: "001" },
        { _ExcelRow: 4, _ImportSourceColumn_0: "乙", _ImportSourceColumn_1: "002" }
    ]);
    assert.deepEqual(
        automatic.columns.map((column) => [column.header, column.sourceKey, column.targetName]),
        [
            ["内部简称", "_ImportSourceColumn_0", ""],
            ["内部号码", "_ImportSourceColumn_1", ""]
        ]
    );
    assert.deepEqual(automatic.columns[0].samples, ["甲", "乙"]);

    const corrected = analyzeExcelWorkbook(XLSX, workbook, {
        targets: buildImportTargets(fields),
        headerStartRow: 2,
        headerEndRow: 2,
        dataStartRow: 3,
        dataEndRow: 4,
        manualMappings: { 0: "CustomerName", 1: "CustomerCode" }
    });
    assert.equal(corrected.confidence, "manual");
    assert.deepEqual(corrected.rows, [
        { _ExcelRow: 3, CustomerName: "甲", CustomerCode: "001" },
        { _ExcelRow: 4, CustomerName: "乙", CustomerCode: "002" }
    ]);
});

test("does not consume the first data row as a second header when fields are unrelated", () => {
    const workbook = workbookFromRows([
        ["资产名称", "资产状态", "资产价格", "购买日期"],
        ["多功能一体机", "使用中", "2668.00", "2018年05月14日"],
        ["四门储物柜", "使用中", "715.00", "2016年08月01日"],
        ["冰箱", "使用中", "860.00", "2020年04月01日"],
        ["双推门矮柜", "使用中", "815.00", "2016年08月01日"],
        ["扶手椅", "使用中", "210.00", "2009年10月19日"]
    ]);
    const result = analyzeExcelWorkbook(XLSX, workbook, {
        targets: buildImportTargets(fields)
    });

    assert.deepEqual([result.headerStartRow, result.headerEndRow], [1, 1]);
    assert.deepEqual([result.dataStartRow, result.dataEndRow], [2, 6]);
    assert.equal(result.mappedColumnCount, 0);
    assert.equal(result.sourceRowCount, 5);
    assert.equal(result.sourceRows[0]._ImportSourceColumn_0, "多功能一体机");
});

test("preserves declarative V8 column coordinates and emits server parse metadata", () => {
    const workbook = workbookFromRows([
        ["项目导入"],
        ["固定说明", "P-2026"],
        ["序号", "物料规格", "数量"],
        [1, "M8", 20]
    ]);
    const targets = buildImportTargets([], [
        { Column: "B", Name: "Specification", Label: "物料规格" },
        { Column: "C", Name: "Quantity", Label: "数量" }
    ]);
    const result = analyzeExcelWorkbook(XLSX, workbook, {
        targets,
        headerStartRow: 3,
        headerEndRow: 3,
        dataStartRow: 4,
        cells: { ProjectCode: "B2" }
    });
    const metadata = buildImportMetadata(result);

    assert.deepEqual(result.rows, [{ _ExcelRow: 4, Specification: "M8", Quantity: 20 }]);
    assert.deepEqual(result.cells, { ProjectCode: "P-2026" });
    assert.equal(metadata.Version, "2.2");
    assert.equal(metadata.ErrorPolicy, "RollbackAll");
    assert.equal(metadata.UpsertMode, "ByTableUniqueRules");
    assert.deepEqual(metadata.Columns.map((column) => column.Column), ["B", "C"]);
    assert.equal(metadata.DataStartRow, 4);
});

test("detects UTF-8 and GBK CSV encodings before using the same source-row preview", () => {
    const utf8Bytes = new Uint8Array([
        0xef, 0xbb, 0xbf,
        ...new TextEncoder().encode("资产名称,资产状态\r\n电脑,使用中")
    ]);
    const utf8 = decodeCsvArrayBuffer(utf8Bytes);
    assert.equal(utf8.encoding, "UTF-8");
    assert.equal(utf8.delimiter, ",");

    const gbkHex = "D7CAB2FAC3FBB3C62CD7CAB2FAD7B4CCAC0D0AB5E7C4D42CCAB9D3C3D6D0";
    const gbkBytes = Uint8Array.from(gbkHex.match(/../g), (value) => Number.parseInt(value, 16));
    const gbk = decodeCsvArrayBuffer(gbkBytes);
    assert.equal(gbk.encoding, "GBK");
    assert.equal(gbk.delimiter, ",");
    assert.equal(gbk.text, "资产名称,资产状态\r\n电脑,使用中");

    const workbook = XLSX.read(gbk.text, { type: "string", FS: gbk.delimiter });
    const result = analyzeExcelWorkbook(XLSX, workbook, {
        fileType: "csv",
        encoding: gbk.encoding,
        delimiter: gbk.delimiter,
        targets: buildImportTargets(fields)
    });
    assert.equal(result.mappedColumnCount, 0);
    assert.equal(result.sourceRowCount, 1);
    assert.deepEqual(result.sourceRows[0], {
        _ExcelRow: 2,
        _ImportSourceColumn_0: "电脑",
        _ImportSourceColumn_1: "使用中"
    });
    assert.deepEqual(buildImportMetadata(result), {
        Version: "2.2",
        ErrorPolicy: "RollbackAll",
        UpsertMode: "ByTableUniqueRules",
        UniqueRules: [],
        FileType: "csv",
        Encoding: "GBK",
        Delimiter: ",",
        SheetIndex: 0,
        SheetName: "Sheet1",
        HeaderStartRow: 1,
        HeaderEndRow: 1,
        DataStartRow: 2,
        DataEndRow: 2,
        Confidence: "low",
        RowCount: 0,
        KeyField: "",
        Cells: {},
        Columns: []
    });
});

test("preview pagination contract remains exactly fifteen rows", () => {
    assert.equal(IMPORT_PREVIEW_PAGE_SIZE, 15);
});

test("import error policy keeps rollback-all compatibility and accepts continue-on-error", () => {
    assert.equal(normalizeImportErrorPolicy(), IMPORT_ERROR_POLICY.ROLLBACK_ALL);
    assert.equal(normalizeImportErrorPolicy("ContinueOnError"), IMPORT_ERROR_POLICY.CONTINUE_ON_ERROR);
    assert.equal(normalizeImportErrorPolicy("unexpected"), IMPORT_ERROR_POLICY.ROLLBACK_ALL);
});
