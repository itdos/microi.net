import type { OcrRecognizeRequest, OcrRecognizeResult, TranslateFileRequest, TranslateFileResult } from './microi-client.js';
export declare const OCR_MAX_BASE64_CHARACTERS: number;
export interface PreparedMcpOcrInput {
    request: OcrRecognizeRequest;
    byteLength: number;
    sha256: string;
    auditFileName: string;
}
export declare function prepareMcpOcrInput(input: {
    filePath?: string;
    fileByteBase64?: string;
    fileName?: string;
    useDocOrientationClassify?: boolean;
    useDocUnwarping?: boolean;
    useTextlineOrientation?: boolean;
    textRecScoreThresh?: number;
    returnWordBox?: boolean;
}): PreparedMcpOcrInput;
export declare function buildMcpOcrResult(value: OcrRecognizeResult | null | undefined, options?: {
    includePages?: boolean;
    includeRegions?: boolean;
    maxTextChars?: number;
}): OcrRecognizeResult | null;
export declare const TRANSLATE_INLINE_RESULT_BYTES: number;
export declare const TRANSLATE_MAX_BASE64_CHARACTERS: number;
export interface PreparedMcpTranslateFileInput {
    request: TranslateFileRequest;
    byteLength: number;
    sha256: string;
    auditFileName: string;
}
export declare function prepareMcpTranslateFileInput(input: {
    filePath?: string;
    fileByteBase64?: string;
    fileName?: string;
    fromLang?: string;
    targetLang: string;
}): PreparedMcpTranslateFileInput;
export declare function decodeMcpTranslatedFile(result: TranslateFileResult | null | undefined): Buffer;
export declare function saveMcpTranslatedFile(outputFilePath: string, bytes: Buffer): string;
//# sourceMappingURL=document-inputs.d.ts.map