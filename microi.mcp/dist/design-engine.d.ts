type JsonRecord = Record<string, unknown>;
export type NormalizeResult = {
    ok: boolean;
    value?: JsonRecord;
    json?: string;
    errors: string[];
    warnings: string[];
};
type PageBuildInput = {
    prompt?: string;
    title?: string;
    number?: string;
    desc?: string;
    theme?: string;
    style?: string;
    dataApi?: string;
};
type PrintBuildInput = {
    prompt?: string;
    title?: string;
    number?: string;
    desc?: string;
    dataApi?: string;
    paperType?: string;
};
export declare function buildPageDesign(input: PageBuildInput): JsonRecord;
export declare function buildPrintTemplateDesign(input: PrintBuildInput): {
    pageObj: JsonRecord;
    printObj: JsonRecord;
};
export declare function normalizePageJsonObj(value: unknown): NormalizeResult;
export declare function normalizePrintPageObj(value: unknown): NormalizeResult;
export declare function normalizePrintObj(value: unknown): NormalizeResult;
export declare function pageDesignPayload(input: PageBuildInput): {
    title: string;
    number: string;
    desc: string;
    jsonObj: JsonRecord;
    jsonStr: string;
};
export declare function printDesignPayload(input: PrintBuildInput): {
    title: string;
    number: string;
    desc: string;
    pageObj: JsonRecord;
    pageObjStr: string;
    printObj: JsonRecord;
    printObjStr: string;
    dataApi: string;
};
export {};
//# sourceMappingURL=design-engine.d.ts.map