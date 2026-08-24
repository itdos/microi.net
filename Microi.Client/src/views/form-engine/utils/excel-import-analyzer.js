const IGNORED_FIELD_COMPONENTS = new Set([
    "button",
    "tablechild",
    "tabs",
    "collapsegroup",
    "divider",
    "description",
    "alert",
    "html",
    "formtab",
    "layout"
]);

const INSTRUCTION_WORDS = [
    "说明",
    "注意",
    "提示",
    "填写",
    "必填",
    "选填",
    "示例",
    "备注",
    "instruction",
    "notice",
    "example",
    "required",
    "optional"
];

export const IMPORT_PREVIEW_PAGE_SIZE = 15;
export const IMPORT_ERROR_POLICY = Object.freeze({
    ROLLBACK_ALL: "RollbackAll",
    CONTINUE_ON_ERROR: "ContinueOnError"
});

export function normalizeImportErrorPolicy(value) {
    return String(value || "").trim().toLowerCase() === "continueonerror"
        ? IMPORT_ERROR_POLICY.CONTINUE_ON_ERROR
        : IMPORT_ERROR_POLICY.ROLLBACK_ALL;
}

const CSV_DELIMITERS = [",", "\t", ";", "|"];

function toByteArray(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    throw new TypeError("CSV content must be an ArrayBuffer or Uint8Array.");
}

function decodeBytes(bytes, encoding, fatal = false) {
    return new TextDecoder(encoding, { fatal }).decode(bytes).replace(/^\uFEFF/, "");
}

export function detectCsvDelimiter(text) {
    const counts = new Map(CSV_DELIMITERS.map((delimiter) => [delimiter, []]));
    const current = new Map(CSV_DELIMITERS.map((delimiter) => [delimiter, 0]));
    let inQuotes = false;
    let rowCount = 0;
    const source = String(text || "");
    for (let index = 0; index < source.length && rowCount < 20; index += 1) {
        const character = source[index];
        if (character === '"') {
            if (inQuotes && source[index + 1] === '"') index += 1;
            else inQuotes = !inQuotes;
            continue;
        }
        if (inQuotes) continue;
        if (current.has(character)) current.set(character, current.get(character) + 1);
        if (character !== "\r" && character !== "\n") continue;
        if (character === "\r" && source[index + 1] === "\n") index += 1;
        CSV_DELIMITERS.forEach((delimiter) => counts.get(delimiter).push(current.get(delimiter)));
        CSV_DELIMITERS.forEach((delimiter) => current.set(delimiter, 0));
        rowCount += 1;
    }
    if (rowCount < 20 && [...current.values()].some((value) => value > 0)) {
        CSV_DELIMITERS.forEach((delimiter) => counts.get(delimiter).push(current.get(delimiter)));
    }
    let best = { delimiter: ",", score: -1 };
    CSV_DELIMITERS.forEach((delimiter) => {
        const populated = counts.get(delimiter).filter((value) => value > 0);
        if (!populated.length) return;
        const frequencies = new Map();
        populated.forEach((value) => frequencies.set(value, (frequencies.get(value) || 0) + 1));
        const [modeCount, modeFrequency] = [...frequencies.entries()]
            .sort((left, right) => right[1] - left[1] || right[0] - left[0])[0];
        const score = populated.length * 100 + modeFrequency * 20 + modeCount;
        if (score > best.score) best = { delimiter, score };
    });
    return best.delimiter;
}

export function decodeCsvArrayBuffer(value) {
    const bytes = toByteArray(value);
    let text;
    let encoding;
    if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
        text = decodeBytes(bytes.subarray(3), "utf-8");
        encoding = "UTF-8";
    } else if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
        text = decodeBytes(bytes.subarray(2), "utf-16le");
        encoding = "UTF-16LE";
    } else if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
        text = decodeBytes(bytes.subarray(2), "utf-16be");
        encoding = "UTF-16BE";
    } else {
        try {
            text = decodeBytes(bytes, "utf-8", true);
            encoding = "UTF-8";
        } catch (_) {
            text = decodeBytes(bytes, "gb18030");
            encoding = "GBK";
        }
    }
    return { text, encoding, delimiter: detectCsvDelimiter(text) };
}

function toPositiveInteger(value, fallback) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
}

function normalizeText(value) {
    if (value === undefined || value === null) return "";
    return String(value).replace(/\s+/g, " ").trim();
}

function normalizeMatchKey(value) {
    return normalizeText(value)
        .toLowerCase()
        .replace(/[（(][^）)]*[）)]/g, "")
        .replace(/[\s\-_/\\:：,，.。;；!！?？'\"“”‘’\[\]【】{}<>《》*＊]+/g, "");
}

function getHeaderVariants(value) {
    const result = new Set();
    const text = normalizeText(value);
    if (!text) return result;
    result.add(normalizeMatchKey(text));
    text.split(/\s*\/\s*|\r?\n|\s*>\s*/).forEach((part) => {
        const key = normalizeMatchKey(part);
        if (key) result.add(key);
    });
    return result;
}

function columnToIndex(XLSX, column, fallback) {
    if (Number.isInteger(column)) return Math.max(0, column);
    const text = normalizeText(column).toUpperCase();
    if (!text) return fallback;
    try {
        return XLSX.utils.decode_col(text);
    } catch (_) {
        return fallback;
    }
}

function normalizeCellValue(cell) {
    if (!cell || cell.v === undefined || cell.v === null) return null;
    if (cell.v instanceof Date) return cell.v.toISOString();
    if (typeof cell.v === "string") {
        const value = cell.v.trim();
        return value === "" ? null : value;
    }
    return cell.v;
}

function isBlank(value) {
    return value === null || value === undefined || normalizeText(value) === "";
}

function looksLikeInstruction(value) {
    const text = normalizeText(value).toLowerCase();
    if (!text) return false;
    return INSTRUCTION_WORDS.some((word) => text.includes(word));
}

function isMostlyNumeric(value) {
    if (typeof value === "number" || value instanceof Date) return true;
    const text = normalizeText(value);
    if (!text) return false;
    return /^[-+]?\d+(?:[.,]\d+)?%?$/.test(text)
        || /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(text);
}

function getMergedAnchor(sheet, rowIndex, columnIndex) {
    const merges = Array.isArray(sheet["!merges"]) ? sheet["!merges"] : [];
    for (const range of merges) {
        if (
            rowIndex >= range.s.r
            && rowIndex <= range.e.r
            && columnIndex >= range.s.c
            && columnIndex <= range.e.c
        ) {
            return range.s;
        }
    }
    return { r: rowIndex, c: columnIndex };
}

function readCell(XLSX, sheet, rowIndex, columnIndex, inheritMergedValue = false) {
    const position = inheritMergedValue
        ? getMergedAnchor(sheet, rowIndex, columnIndex)
        : { r: rowIndex, c: columnIndex };
    return normalizeCellValue(sheet[XLSX.utils.encode_cell(position)]);
}

function buildHeaderText(XLSX, sheet, startRow, endRow, columnIndex) {
    const parts = [];
    for (let rowNumber = startRow; rowNumber <= endRow; rowNumber += 1) {
        const value = normalizeText(readCell(XLSX, sheet, rowNumber - 1, columnIndex, true));
        if (value && parts[parts.length - 1] !== value) parts.push(value);
    }
    return parts.join(" / ");
}

function targetAliases(target) {
    const result = new Set();
    [target.name, target.label, ...(target.aliases || [])].forEach((value) => {
        const key = normalizeMatchKey(value);
        if (key) result.add(key);
    });
    return result;
}

function normalizeAliases(value) {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === "string") return value.split(/[,，;；|]/).map((item) => item.trim()).filter(Boolean);
    return [];
}

function getTargetMatchScore(header, target) {
    const variants = getHeaderVariants(header);
    if (!variants.size) return 0;
    let best = 0;
    for (const alias of target._aliases) {
        for (const variant of variants) {
            if (variant === alias) best = Math.max(best, 12);
            else if (
                alias.length >= 2
                && variant.length >= 2
                && (variant.includes(alias) || alias.includes(variant))
            ) best = Math.max(best, 5);
        }
    }
    return best;
}

function makeUniqueTargetName(value, index, used) {
    let base = normalizeText(value).replace(/[.\[\]$]/g, "_");
    if (!base) base = `Column${index + 1}`;
    let result = base;
    let suffix = 2;
    while (used.has(result.toLowerCase())) {
        result = `${base}_${suffix}`;
        suffix += 1;
    }
    used.add(result.toLowerCase());
    return result;
}

export function buildImportTargets(fields = [], configuredColumns = []) {
    const columns = Array.isArray(configuredColumns) ? configuredColumns.filter(Boolean) : [];
    const source = columns.length
        ? columns.map((column) => ({
            name: column.Name || column.FieldName || column.Label,
            label: column.Label || column.Name || column.FieldName,
            aliases: normalizeAliases(column.Aliases || column.HeaderAliases),
            preferredColumn: column.Column,
            required: Boolean(column.Required)
        }))
        : (Array.isArray(fields) ? fields : [])
            .filter((field) => {
                const component = normalizeText(field && field.Component).toLowerCase();
                return field
                    && field.Name
                    && field.Label
                    && !IGNORED_FIELD_COMPONENTS.has(component);
            })
            .map((field) => ({
                name: field.Name,
                label: field.Label,
                aliases: [field.AsName, ...normalizeAliases(field.ImportAliases)].filter(Boolean),
                required: Boolean(field.Required)
            }));

    const used = new Set();
    return source
        .filter((target) => target.name || target.label)
        .map((target, index) => {
            const normalized = {
                ...target,
                name: makeUniqueTargetName(target.name || target.label, index, used),
                label: normalizeText(target.label || target.name)
            };
            normalized._aliases = targetAliases(normalized);
            return normalized;
        });
}

function chooseBestMappings(headers, targets, preferredMappings = {}, manualMappings = {}) {
    const mappings = [];
    const usedTargets = new Set();
    const targetByName = new Map(targets.map((target) => [target.name, target]));

    headers.forEach((header, columnIndex) => {
        const manualValue = Object.prototype.hasOwnProperty.call(manualMappings, columnIndex)
            ? manualMappings[columnIndex]
            : undefined;
        if (manualValue !== undefined) {
            const target = targetByName.get(manualValue);
            mappings[columnIndex] = target && !usedTargets.has(target.name) ? target : null;
            if (mappings[columnIndex]) usedTargets.add(mappings[columnIndex].name);
            return;
        }
        const preferred = preferredMappings[columnIndex];
        if (preferred && !usedTargets.has(preferred.name)) {
            mappings[columnIndex] = preferred;
            usedTargets.add(preferred.name);
        }
    });

    const candidates = [];
    headers.forEach((header, columnIndex) => {
        if (mappings[columnIndex] !== undefined) return;
        targets.forEach((target) => {
            if (usedTargets.has(target.name)) return;
            const score = getTargetMatchScore(header, target);
            if (score > 0) candidates.push({ columnIndex, target, score });
        });
    });
    candidates.sort((left, right) => right.score - left.score);
    const usedColumns = new Set();
    candidates.forEach((candidate) => {
        if (usedColumns.has(candidate.columnIndex) || usedTargets.has(candidate.target.name)) return;
        mappings[candidate.columnIndex] = candidate.target;
        usedColumns.add(candidate.columnIndex);
        usedTargets.add(candidate.target.name);
    });
    return mappings;
}

function rowValues(XLSX, sheet, rowNumber, columnIndexes) {
    return columnIndexes.map((columnIndex) => readCell(XLSX, sheet, rowNumber - 1, columnIndex));
}

function rowLooksLikeData(values) {
    const populated = values.filter((value) => !isBlank(value));
    if (!populated.length) return false;
    const instructions = populated.filter(looksLikeInstruction).length;
    const longText = populated.filter((value) => normalizeText(value).length > 80).length;
    if (populated.length === 1 && (instructions || longText)) return false;
    if (instructions / populated.length >= 0.6) return false;
    return true;
}

function scoreHeaderCandidate(XLSX, sheet, startRow, endRow, columnIndexes, targets, preferredMappings) {
    const headers = [];
    let textualHeaders = 0;
    let numericHeaders = 0;
    let instructionHeaders = 0;
    const uniqueHeaders = new Set();
    columnIndexes.forEach((columnIndex) => {
        const header = buildHeaderText(XLSX, sheet, startRow, endRow, columnIndex);
        headers[columnIndex] = header;
        if (header) {
            uniqueHeaders.add(normalizeMatchKey(header));
            if (isMostlyNumeric(header)) numericHeaders += 1;
            else textualHeaders += 1;
            if (looksLikeInstruction(header) || header.length > 120) instructionHeaders += 1;
        }
    });
    const mappings = chooseBestMappings(headers, targets, preferredMappings, {});
    const matched = mappings.filter(Boolean).length;
    const exactScore = mappings.reduce((score, target, columnIndex) => (
        target ? score + getTargetMatchScore(headers[columnIndex], target) : score
    ), 0);
    const mappedIndexes = mappings
        .map((target, index) => (target ? index : null))
        .filter((value) => value !== null);
    const probeIndexes = mappedIndexes.length ? mappedIndexes : columnIndexes;
    let followingDataRows = 0;
    for (let rowNumber = endRow + 1; rowNumber <= Math.min(endRow + 4, sheet.LastRowNum + 1); rowNumber += 1) {
        if (rowLooksLikeData(rowValues(XLSX, sheet, rowNumber, probeIndexes))) followingDataRows += 1;
    }
    const mergedHeaderGroups = (sheet["!merges"] || []).filter((range) => (
        range.s.r >= startRow - 1
        && range.s.r < endRow - 1
        && range.e.c > range.s.c
        && columnIndexes.some((columnIndex) => columnIndex >= range.s.c && columnIndex <= range.e.c)
    )).length;
    const parentLabels = new Map();
    if (startRow < endRow) {
        columnIndexes.forEach((columnIndex) => {
            const value = normalizeText(readCell(XLSX, sheet, startRow - 1, columnIndex, true));
            if (value && value.length <= 50 && !looksLikeInstruction(value)) {
                parentLabels.set(value, (parentLabels.get(value) || 0) + 1);
            }
        });
    }
    const hasRepeatedParentLabel = [...parentLabels.values()].some((count) => count >= 2);
    const hierarchyBonus = mergedHeaderGroups > 0
        ? Math.min(6, mergedHeaderGroups * 3)
        : (hasRepeatedParentLabel ? 2 : 0);
    const unsupportedHierarchyPenalty = startRow < endRow
        && mergedHeaderGroups === 0
        && !hasRepeatedParentLabel
        ? Math.min(14, 8 + (endRow - startRow - 1) * 3)
        : 0;
    const sparseTitlePenalty = columnIndexes.length > 1 && uniqueHeaders.size <= 1 ? 6 : 0;
    const score = exactScore
        + matched * 8
        + Math.min(textualHeaders, 8)
        + followingDataRows * 3
        + hierarchyBonus
        - numericHeaders * 2
        - instructionHeaders * 7
        - sparseTitlePenalty
        - unsupportedHierarchyPenalty
        - Math.max(0, endRow - startRow - 2);
    return { startRow, endRow, headers, mappings, matched, score };
}

function detectHeaderRange(XLSX, sheet, columnIndexes, targets, preferredMappings, maxHeaderRows) {
    const firstRow = sheet.FirstRowNum === undefined ? 1 : sheet.FirstRowNum + 1;
    const lastCandidateRow = Math.min(sheet.LastRowNum + 1, firstRow + 79);
    let best = null;
    for (let endRow = firstRow; endRow <= lastCandidateRow; endRow += 1) {
        for (let depth = 1; depth <= maxHeaderRows; depth += 1) {
            const startRow = Math.max(firstRow, endRow - depth + 1);
            const candidate = scoreHeaderCandidate(
                XLSX,
                sheet,
                startRow,
                endRow,
                columnIndexes,
                targets,
                preferredMappings
            );
            if (!best || candidate.score > best.score) best = candidate;
        }
    }
    return best;
}

function detectDataStartRow(XLSX, sheet, startRow, columnIndexes) {
    const lastRow = sheet.LastRowNum + 1;
    for (let rowNumber = startRow; rowNumber <= lastRow; rowNumber += 1) {
        const values = rowValues(XLSX, sheet, rowNumber, columnIndexes);
        if (!rowLooksLikeData(values)) continue;
        return rowNumber;
    }
    return Math.min(startRow, lastRow + 1);
}

function detectDataEndRow(XLSX, sheet, startRow, columnIndexes) {
    for (let rowNumber = sheet.LastRowNum + 1; rowNumber >= startRow; rowNumber -= 1) {
        const values = rowValues(XLSX, sheet, rowNumber, columnIndexes);
        if (rowLooksLikeData(values)) return rowNumber;
    }
    return startRow - 1;
}

function getConfidence(matchedColumns, targetCount, rowCount, usedAutomaticDetection) {
    if (!rowCount || !matchedColumns) return "low";
    if (!usedAutomaticDetection) return "manual";
    const denominator = Math.max(1, Math.min(targetCount || matchedColumns, matchedColumns + 2));
    const ratio = matchedColumns / denominator;
    if (matchedColumns >= 2 && ratio >= 0.66) return "high";
    if (matchedColumns >= 1) return "medium";
    return "low";
}

function buildFallbackTargets(headers, columnIndexes) {
    const used = new Set();
    return columnIndexes
        .filter((columnIndex) => headers[columnIndex])
        .map((columnIndex) => ({
            name: makeUniqueTargetName(headers[columnIndex], columnIndex, used),
            label: headers[columnIndex],
            aliases: [],
            _aliases: getHeaderVariants(headers[columnIndex]),
            preferredColumn: columnIndex
        }));
}

function scoreWorkbookSheet(XLSX, workbook, sheetIndex, options) {
    const sheetName = workbook.SheetNames[sheetIndex];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet || !sheet["!ref"]) {
        return { sheetIndex, score: Number.NEGATIVE_INFINITY, dataRowCount: 0 };
    }

    const decodedRange = XLSX.utils.decode_range(sheet["!ref"]);
    sheet.FirstRowNum = decodedRange.s.r;
    sheet.LastRowNum = decodedRange.e.r;
    const maxColumns = clamp(toPositiveInteger(options.maxColumns, 256), 1, 256);
    const lastColumn = Math.min(decodedRange.e.c, decodedRange.s.c + maxColumns - 1);
    const columnIndexes = [];
    for (let columnIndex = decodedRange.s.c; columnIndex <= lastColumn; columnIndex += 1) {
        columnIndexes.push(columnIndex);
    }

    const targets = Array.isArray(options.targets) ? options.targets : [];
    const preferredMappings = {};
    targets.forEach((target) => {
        const columnIndex = columnToIndex(XLSX, target.preferredColumn, null);
        if (columnIndex !== null && columnIndex <= lastColumn) preferredMappings[columnIndex] = target;
    });
    const detection = detectHeaderRange(
        XLSX,
        sheet,
        columnIndexes,
        targets,
        preferredMappings,
        clamp(toPositiveInteger(options.maxHeaderRows, 4), 1, 8)
    );
    detection.mappings = chooseBestMappings(detection.headers, targets, preferredMappings, {});
    const mappedIndexes = detection.mappings
        .map((target, index) => (target ? index : null))
        .filter((value) => value !== null);
    const probeIndexes = mappedIndexes.length ? mappedIndexes : columnIndexes;
    const dataStartRow = detectDataStartRow(XLSX, sheet, detection.endRow + 1, probeIndexes);
    const sampleEndRow = Math.min(sheet.LastRowNum + 1, dataStartRow + 199);
    const populatedColumns = new Set();
    let dataRowCount = 0;
    for (let rowNumber = dataStartRow; rowNumber <= sampleEndRow; rowNumber += 1) {
        const values = rowValues(XLSX, sheet, rowNumber, probeIndexes);
        if (!rowLooksLikeData(values)) continue;
        dataRowCount += 1;
        values.forEach((value, index) => {
            if (!isBlank(value)) populatedColumns.add(probeIndexes[index]);
        });
    }

    const mappedColumnCount = detection.mappings.filter(Boolean).length;
    const instructionSheetPenalty = looksLikeInstruction(sheetName) ? 12 : 0;
    const noDataPenalty = dataRowCount ? 0 : 100;
    const singleColumnPenalty = populatedColumns.size <= 1 ? 6 : 0;
    const score = Number(detection.score || 0)
        + mappedColumnCount * 18
        + Math.min(dataRowCount, 30) * 2
        + Math.min(populatedColumns.size, 12)
        - instructionSheetPenalty
        - noDataPenalty
        - singleColumnPenalty;
    return { sheetIndex, score, dataRowCount, mappedColumnCount };
}

function selectBestSheetIndex(XLSX, workbook, options) {
    let best = null;
    workbook.SheetNames.forEach((_, sheetIndex) => {
        const candidate = scoreWorkbookSheet(XLSX, workbook, sheetIndex, options);
        if (!best || candidate.score > best.score) best = candidate;
    });
    return best ? best.sheetIndex : 0;
}

export function analyzeExcelWorkbook(XLSX, workbook, options = {}) {
    if (!XLSX || !workbook || !Array.isArray(workbook.SheetNames) || !workbook.SheetNames.length) {
        throw new Error("Excel workbook is empty.");
    }
    const configuredSheetIndex = workbook.SheetNames.indexOf(options.sheetName);
    const hasConfiguredSheetIndex = options.sheetIndex !== undefined
        && options.sheetIndex !== null
        && options.sheetIndex !== "";
    const shouldDetectSheet = Boolean(options.autoDetectSheet)
        || (configuredSheetIndex < 0 && !hasConfiguredSheetIndex);
    const sheetIndex = shouldDetectSheet
        ? selectBestSheetIndex(XLSX, workbook, options)
        : clamp(
            configuredSheetIndex >= 0 ? configuredSheetIndex : Number(options.sheetIndex || 0),
            0,
            workbook.SheetNames.length - 1
        );
    const sheetName = workbook.SheetNames[sheetIndex];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) throw new Error(`Excel sheet not found: ${sheetName}`);

    const decodedRange = XLSX.utils.decode_range(sheet["!ref"] || "A1:A1");
    sheet.FirstRowNum = decodedRange.s.r;
    sheet.LastRowNum = decodedRange.e.r;
    const maxColumns = clamp(toPositiveInteger(options.maxColumns, 256), 1, 256);
    const lastColumn = Math.min(decodedRange.e.c, decodedRange.s.c + maxColumns - 1);
    const columnIndexes = [];
    for (let columnIndex = decodedRange.s.c; columnIndex <= lastColumn; columnIndex += 1) {
        columnIndexes.push(columnIndex);
    }

    let targets = Array.isArray(options.targets) ? options.targets : [];
    const preferredMappings = {};
    targets.forEach((target) => {
        const columnIndex = columnToIndex(XLSX, target.preferredColumn, null);
        if (columnIndex !== null && columnIndex <= lastColumn) preferredMappings[columnIndex] = target;
    });
    const explicitHeaderStart = toPositiveInteger(options.headerStartRow, null);
    const explicitHeaderEnd = toPositiveInteger(options.headerEndRow, null);
    const explicitDataStart = toPositiveInteger(options.dataStartRow, null);
    const defaultHeaderRow = explicitDataStart ? Math.max(1, explicitDataStart - 1) : null;
    const usesExplicitHeader = Boolean(explicitHeaderStart || explicitHeaderEnd || defaultHeaderRow);
    let detection;
    if (usesExplicitHeader) {
        const headerStartRow = explicitHeaderStart || explicitHeaderEnd || defaultHeaderRow;
        const headerEndRow = Math.max(headerStartRow, explicitHeaderEnd || defaultHeaderRow || headerStartRow);
        const headers = [];
        columnIndexes.forEach((columnIndex) => {
            headers[columnIndex] = buildHeaderText(XLSX, sheet, headerStartRow, headerEndRow, columnIndex);
        });
        detection = {
            startRow: headerStartRow,
            endRow: headerEndRow,
            headers,
            mappings: chooseBestMappings(
                headers,
                targets,
                preferredMappings,
                options.manualMappings || {}
            )
        };
    } else {
        detection = detectHeaderRange(
            XLSX,
            sheet,
            columnIndexes,
            targets,
            preferredMappings,
            clamp(toPositiveInteger(options.maxHeaderRows, 4), 1, 8)
        );
        detection.mappings = chooseBestMappings(
            detection.headers,
            targets,
            preferredMappings,
            options.manualMappings || {}
        );
    }

    if (!targets.length) {
        targets = buildFallbackTargets(detection.headers, columnIndexes);
        detection.mappings = chooseBestMappings(
            detection.headers,
            targets,
            Object.fromEntries(targets.map((target) => [target.preferredColumn, target])),
            options.manualMappings || {}
        );
    }
    const mappedIndexes = detection.mappings
        .map((target, index) => (target ? index : null))
        .filter((value) => value !== null);
    const dataProbeIndexes = mappedIndexes.length ? mappedIndexes : columnIndexes;
    const dataStartRow = explicitDataStart || detectDataStartRow(
        XLSX,
        sheet,
        detection.endRow + 1,
        dataProbeIndexes
    );
    const configuredDataEnd = toPositiveInteger(options.dataEndRow, null);
    const dataEndRow = Math.min(
        configuredDataEnd || detectDataEndRow(XLSX, sheet, dataStartRow, dataProbeIndexes),
        sheet.LastRowNum + 1
    );
    const maxRows = clamp(toPositiveInteger(options.maxRows, 50000), 1, 50000);
    const rows = [];
    const sourceRows = [];
    const samples = new Map();
    let sourceRowCount = 0;
    for (let rowNumber = dataStartRow; rowNumber <= dataEndRow; rowNumber += 1) {
        const row = { _ExcelRow: rowNumber };
        const sourceRow = { _ExcelRow: rowNumber };
        let hasValue = false;
        let sourceHasValue = false;
        const values = new Map();
        columnIndexes.forEach((columnIndex) => {
            const value = readCell(XLSX, sheet, rowNumber - 1, columnIndex);
            values.set(columnIndex, value);
            sourceRow[`_ImportSourceColumn_${columnIndex}`] = value;
            if (!isBlank(value)) {
                sourceHasValue = true;
                const currentSamples = samples.get(columnIndex) || [];
                if (currentSamples.length < 3) currentSamples.push(value);
                samples.set(columnIndex, currentSamples);
            }
        });
        if (sourceHasValue) {
            sourceRowCount += 1;
            sourceRows.push(sourceRow);
        }
        if (sourceRowCount > maxRows) {
            const error = new Error(`Excel data rows exceed the limit ${maxRows}.`);
            error.code = "IMPORT_TOO_MANY_ROWS";
            error.limit = maxRows;
            throw error;
        }
        detection.mappings.forEach((target, columnIndex) => {
            if (!target) return;
            const value = values.get(columnIndex);
            row[target.name] = value;
            if (!isBlank(value)) hasValue = true;
        });
        if (!hasValue) continue;
        if (options.keyField && isBlank(row[options.keyField])) continue;
        rows.push(row);
    }

    const columns = columnIndexes.map((columnIndex) => {
        const target = detection.mappings[columnIndex] || null;
        return {
            columnIndex,
            columnLetter: XLSX.utils.encode_col(columnIndex),
            sourceKey: `_ImportSourceColumn_${columnIndex}`,
            header: detection.headers[columnIndex] || "",
            targetName: target ? target.name : "",
            targetLabel: target ? target.label : "",
            samples: samples.get(columnIndex) || []
        };
    }).filter((column) => column.header || column.targetName || column.samples.length);
    const mappedColumns = columns.filter((column) => column.targetName);
    const automatic = !usesExplicitHeader && !Object.keys(options.manualMappings || {}).length;
    const confidence = getConfidence(mappedColumns.length, targets.length, rows.length, automatic);
    const cells = {};
    Object.keys(options.cells || {}).forEach((key) => {
        const address = normalizeText(options.cells[key]).toUpperCase();
        cells[key] = normalizeCellValue(sheet[address]);
    });
    return {
        sheetNames: [...workbook.SheetNames],
        sheetIndex,
        sheetName,
        headerStartRow: detection.startRow,
        headerEndRow: detection.endRow,
        dataStartRow,
        dataEndRow,
        confidence,
        columns,
        targets: targets.map(({ _aliases, ...target }) => target),
        mappedColumnCount: mappedColumns.length,
        ignoredColumnCount: Math.max(0, columns.length - mappedColumns.length),
        sourceRowCount,
        sourceRows,
        keyField: options.keyField || "",
        rows,
        cells,
        fileType: normalizeText(options.fileType).toLowerCase() || "excel",
        encoding: normalizeText(options.encoding),
        delimiter: options.delimiter || ""
    };
}

export function buildImportMetadata(analysis, options = {}) {
    if (!analysis) return null;
    return {
        Version: "2.2",
        ErrorPolicy: normalizeImportErrorPolicy(options.errorPolicy),
        UpsertMode: "ByTableUniqueRules",
        UniqueRules: Array.isArray(options.uniqueRules) ? options.uniqueRules : [],
        FileType: analysis.fileType || "excel",
        Encoding: analysis.encoding || "",
        Delimiter: analysis.delimiter || "",
        SheetIndex: analysis.sheetIndex,
        SheetName: analysis.sheetName,
        HeaderStartRow: analysis.headerStartRow,
        HeaderEndRow: analysis.headerEndRow,
        DataStartRow: analysis.dataStartRow,
        DataEndRow: analysis.dataEndRow,
        Confidence: analysis.confidence,
        RowCount: analysis.rows.length,
        KeyField: analysis.keyField || "",
        Cells: analysis.cells,
        Columns: analysis.columns
            .filter((column) => column.targetName)
            .map((column) => ({
                ColumnIndex: column.columnIndex,
                Column: column.columnLetter,
                Header: column.header,
                Name: column.targetName,
                Label: column.targetLabel
            }))
    };
}
