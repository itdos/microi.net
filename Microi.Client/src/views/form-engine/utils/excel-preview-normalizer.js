import { strFromU8, strToU8, unzip, zip } from "fflate";

const XDR_NAMESPACE = "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing";
const ZIP_SIGNATURES = new Set([0x03, 0x05, 0x07]);

function toExactArrayBuffer(value) {
    if (value instanceof ArrayBuffer) return value;
    const bytes = value instanceof Uint8Array
        ? value
        : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}
function isZip(bytes) {
    return bytes.length >= 4
        && bytes[0] === 0x50
        && bytes[1] === 0x4b
        && ZIP_SIGNATURES.has(bytes[2])
        && [0x04, 0x06, 0x08].includes(bytes[3]);
}

function unzipAsync(bytes) {
    return new Promise((resolve, reject) => {
        unzip(bytes, (error, entries) => {
            if (error) reject(error);
            else resolve(entries);
        });
    });
}

function zipAsync(entries) {
    return new Promise((resolve, reject) => {
        zip(entries, { level: 6 }, (error, bytes) => {
            if (error) reject(error);
            else resolve(bytes);
        });
    });
}

function normalizeDrawingXml(xml) {
    const namespacePattern = new RegExp(`xmlns=(["'])${XDR_NAMESPACE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\1`);
    if (!namespacePattern.test(xml) || /<xdr:wsDr\b/.test(xml)) return xml;
    let normalized = xml.replace(namespacePattern, `xmlns:xdr="${XDR_NAMESPACE}"`);
    normalized = normalized.replace(/<(\/?)([A-Za-z_][\w.-]*)(?=[\s/>])/g, (match, slash, name) => {
        return `<${slash}xdr:${name}`;
    });
    return normalized;
}

function normalizeRelationshipTargets(xml) {
    return xml
        .replace(/Target=(['"])\/xl\/drawings\//g, "Target=$1../drawings/")
        .replace(/Target=(['"])\/xl\/media\//g, "Target=$1../media/");
}

/**
 * Makes standards-equivalent DrawingML generated with a default XDR namespace
 * readable by @vue-office/excel/ExcelJS without changing workbook content.
 */
export async function normalizeXlsxPreviewArrayBuffer(value) {
    const original = toExactArrayBuffer(value);
    const sourceBytes = new Uint8Array(original);
    if (!isZip(sourceBytes)) return original;

    try {
        const entries = await unzipAsync(sourceBytes);
        let changed = false;
        Object.keys(entries).forEach((name) => {
            const isDrawing = /^xl\/drawings\/[^/]+\.xml$/i.test(name);
            const isRelationships = /_rels\/[^/]+\.rels$/i.test(name);
            if (!isDrawing && !isRelationships) return;
            const source = strFromU8(entries[name]);
            const normalized = isDrawing
                ? normalizeDrawingXml(source)
                : normalizeRelationshipTargets(source);
            if (normalized === source) return;
            entries[name] = strToU8(normalized);
            changed = true;
        });
        if (!changed) return original;
        return toExactArrayBuffer(await zipAsync(entries));
    } catch (_) {
        // Preview compatibility must never prevent the ordinary analyzer/import path.
        return original;
    }
}
