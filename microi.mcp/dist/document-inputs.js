import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
const OCR_MAX_FILE_BYTES = 100 * 1024 * 1024;
export const OCR_MAX_BASE64_CHARACTERS = Math.ceil(OCR_MAX_FILE_BYTES / 3) * 4 + 512;
const OCR_ALLOWED_EXTENSIONS = new Set([
    '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tif', '.tiff', '.webp',
]);
function normalizeOcrFileName(value) {
    const trimmed = String(value || '').trim();
    if (!trimmed)
        return undefined;
    if (trimmed.includes('\0'))
        throw new Error('fileName 不能包含空字符。');
    const fileName = path.basename(trimmed);
    if (!fileName || fileName === '.' || fileName === '..')
        throw new Error('fileName 无效。');
    if (fileName.length > 255)
        throw new Error('fileName 不能超过 255 个字符。');
    const extension = path.extname(fileName).toLowerCase();
    if (extension && !OCR_ALLOWED_EXTENSIONS.has(extension)) {
        throw new Error('OCR 仅支持 PDF、PNG、JPEG、GIF、BMP、TIFF 或 WebP 文件。');
    }
    return fileName;
}
function decodeMcpOcrBase64(value) {
    const trimmed = value.trim();
    const commaIndex = /^data:[^;,]+;base64,/iu.test(trimmed) ? trimmed.indexOf(',') : -1;
    const normalized = (commaIndex >= 0 ? trimmed.slice(commaIndex + 1) : trimmed).replace(/\s/gu, '');
    if (!normalized)
        throw new Error('fileByteBase64 不能为空。');
    if (normalized.length > OCR_MAX_BASE64_CHARACTERS)
        throw new Error('OCR 文件超过 MCP 100 MB 硬上限。');
    if (normalized.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/u.test(normalized)) {
        throw new Error('fileByteBase64 不是有效的 Base64 内容。');
    }
    const bytes = Buffer.from(normalized, 'base64');
    if (bytes.toString('base64').replace(/=+$/u, '') !== normalized.replace(/=+$/u, '')) {
        throw new Error('fileByteBase64 不是规范的 Base64 内容。');
    }
    if (bytes.length === 0 || bytes.length > OCR_MAX_FILE_BYTES) {
        throw new Error('OCR 文件必须大于 0 字节且不超过 MCP 100 MB 硬上限。');
    }
    return bytes;
}
export function prepareMcpOcrInput(input) {
    const hasPath = Boolean(input.filePath?.trim());
    const hasBase64 = Boolean(input.fileByteBase64?.trim());
    if (hasPath === hasBase64)
        throw new Error('filePath 与 fileByteBase64 必须且只能提供一个。');
    let bytes;
    let fileName = normalizeOcrFileName(input.fileName);
    if (hasPath) {
        const requestedPath = String(input.filePath).trim();
        if (!path.isAbsolute(requestedPath))
            throw new Error('filePath 必须是绝对路径。');
        const stat = fs.lstatSync(requestedPath);
        if (stat.isSymbolicLink())
            throw new Error('filePath 不能是符号链接。');
        if (!stat.isFile())
            throw new Error('filePath 必须指向普通文件。');
        if (stat.size <= 0 || stat.size > OCR_MAX_FILE_BYTES) {
            throw new Error('OCR 文件必须大于 0 字节且不超过 MCP 100 MB 硬上限。');
        }
        const localFileName = normalizeOcrFileName(path.basename(requestedPath));
        if (!localFileName || !path.extname(localFileName))
            throw new Error('本地 OCR 文件必须使用受支持的扩展名。');
        fileName = fileName || localFileName;
        bytes = fs.readFileSync(requestedPath);
        if (bytes.length !== stat.size)
            throw new Error('OCR 文件在读取期间发生变化，请重试。');
    }
    else {
        bytes = decodeMcpOcrBase64(String(input.fileByteBase64));
    }
    return {
        request: {
            FileByteBase64: bytes.toString('base64'),
            FileName: fileName,
            UseDocOrientationClassify: input.useDocOrientationClassify,
            UseDocUnwarping: input.useDocUnwarping,
            UseTextlineOrientation: input.useTextlineOrientation,
            TextRecScoreThresh: input.textRecScoreThresh,
            ReturnWordBox: input.returnWordBox,
        },
        byteLength: bytes.length,
        sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
        auditFileName: fileName || '(unnamed OCR input)',
    };
}
export function buildMcpOcrResult(value, options = {}) {
    if (!value)
        return null;
    const maxTextChars = Math.max(1_000, Math.min(200_000, options.maxTextChars || 100_000));
    const sourceText = String(value.Text || '');
    const result = {
        Provider: value.Provider,
        TraceId: value.TraceId,
        FileName: value.FileName,
        FileType: value.FileType,
        Text: sourceText.slice(0, maxTextChars),
        AverageConfidence: value.AverageConfidence,
        PageCount: value.PageCount,
        ElapsedMilliseconds: value.ElapsedMilliseconds,
        TextTruncated: sourceText.length > maxTextChars,
    };
    if (!options.includePages)
        return result;
    let remainingPageCharacters = maxTextChars;
    result.Pages = (value.Pages || []).map(page => {
        const pageText = String(page.Text || '');
        const visibleText = pageText.slice(0, remainingPageCharacters);
        remainingPageCharacters = Math.max(0, remainingPageCharacters - visibleText.length);
        if (visibleText.length < pageText.length)
            result.TextTruncated = true;
        return {
            PageIndex: page.PageIndex,
            Text: visibleText,
            AverageConfidence: page.AverageConfidence,
            ...(options.includeRegions ? { Regions: page.Regions || [] } : {}),
        };
    });
    return result;
}
const TRANSLATE_MAX_FILE_BYTES = 20 * 1024 * 1024;
const TRANSLATE_MAX_RESULT_BYTES = 25 * 1024 * 1024;
export const TRANSLATE_INLINE_RESULT_BYTES = 2 * 1024 * 1024;
export const TRANSLATE_MAX_BASE64_CHARACTERS = Math.ceil(TRANSLATE_MAX_FILE_BYTES / 3) * 4 + 512;
const TRANSLATE_ALLOWED_EXTENSIONS = new Set([
    '.txt', '.html', '.htm', '.odt', '.odp', '.docx', '.pptx', '.xlsx', '.epub', '.pdf',
]);
function normalizeTranslateFileName(value) {
    const trimmed = String(value || '').trim();
    if (!trimmed || trimmed.includes('\0'))
        throw new Error('fileName 无效。');
    const fileName = path.basename(trimmed);
    if (!fileName || fileName === '.' || fileName === '..' || fileName.length > 255) {
        throw new Error('fileName 无效或超过 255 个字符。');
    }
    if (!TRANSLATE_ALLOWED_EXTENSIONS.has(path.extname(fileName).toLowerCase())) {
        throw new Error('文件翻译仅支持 TXT、HTML、ODT、ODP、DOCX、PPTX、XLSX、EPUB 或 PDF。');
    }
    return fileName;
}
function decodeTranslateBase64(value) {
    const trimmed = value.trim();
    const commaIndex = /^data:[^;,]+;base64,/iu.test(trimmed) ? trimmed.indexOf(',') : -1;
    const normalized = (commaIndex >= 0 ? trimmed.slice(commaIndex + 1) : trimmed).replace(/\s/gu, '');
    if (!normalized || normalized.length > TRANSLATE_MAX_BASE64_CHARACTERS) {
        throw new Error('翻译文件必须大于 0 字节且不超过 20 MB。');
    }
    if (normalized.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/u.test(normalized)) {
        throw new Error('fileByteBase64 不是有效的 Base64 内容。');
    }
    const bytes = Buffer.from(normalized, 'base64');
    if (bytes.length === 0 || bytes.length > TRANSLATE_MAX_FILE_BYTES
        || bytes.toString('base64').replace(/=+$/u, '') !== normalized.replace(/=+$/u, '')) {
        throw new Error('fileByteBase64 无效或超过 20 MB。');
    }
    return bytes;
}
export function prepareMcpTranslateFileInput(input) {
    const hasPath = Boolean(input.filePath?.trim());
    const hasBase64 = Boolean(input.fileByteBase64?.trim());
    if (hasPath === hasBase64)
        throw new Error('filePath 与 fileByteBase64 必须且只能提供一个。');
    if (!String(input.targetLang || '').trim())
        throw new Error('targetLang 不能为空。');
    let bytes;
    let fileName;
    if (hasPath) {
        const requestedPath = String(input.filePath).trim();
        if (!path.isAbsolute(requestedPath))
            throw new Error('filePath 必须是绝对路径。');
        const stat = fs.lstatSync(requestedPath);
        if (stat.isSymbolicLink() || !stat.isFile())
            throw new Error('filePath 必须指向非符号链接的普通文件。');
        if (stat.size <= 0 || stat.size > TRANSLATE_MAX_FILE_BYTES) {
            throw new Error('翻译文件必须大于 0 字节且不超过 20 MB。');
        }
        fileName = normalizeTranslateFileName(input.fileName || path.basename(requestedPath));
        bytes = fs.readFileSync(requestedPath);
        if (bytes.length !== stat.size)
            throw new Error('翻译文件在读取期间发生变化，请重试。');
    }
    else {
        fileName = normalizeTranslateFileName(input.fileName);
        bytes = decodeTranslateBase64(String(input.fileByteBase64));
    }
    return {
        request: {
            FileByteBase64: bytes.toString('base64'),
            FileName: fileName,
            FromLang: String(input.fromLang || 'auto').trim() || 'auto',
            Lang: String(input.targetLang).trim(),
        },
        byteLength: bytes.length,
        sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
        auditFileName: fileName,
    };
}
export function decodeMcpTranslatedFile(result) {
    const value = String(result?.FileByteBase64 || '').trim();
    if (!value)
        throw new Error('后端未返回翻译文件内容。');
    const bytes = Buffer.from(value, 'base64');
    if (bytes.length === 0 || bytes.length > TRANSLATE_MAX_RESULT_BYTES
        || bytes.toString('base64').replace(/=+$/u, '') !== value.replace(/=+$/u, '')) {
        throw new Error('后端返回的翻译文件无效或超过 25 MB。');
    }
    if (result?.ByteLength !== undefined && Number(result.ByteLength) !== bytes.length) {
        throw new Error('后端翻译文件长度回读不一致。');
    }
    return bytes;
}
export function saveMcpTranslatedFile(outputFilePath, bytes) {
    const rawPath = String(outputFilePath || '').trim();
    const resolved = path.resolve(rawPath);
    if (!path.isAbsolute(rawPath))
        throw new Error('outputFilePath 必须是绝对路径。');
    if (fs.existsSync(resolved))
        throw new Error('outputFilePath 已存在；为避免覆盖，请使用新的文件名。');
    const parentStat = fs.lstatSync(path.dirname(resolved));
    if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) {
        throw new Error('outputFilePath 的父目录必须是非符号链接目录。');
    }
    fs.writeFileSync(resolved, bytes, { flag: 'wx' });
    return resolved;
}
//# sourceMappingURL=document-inputs.js.map