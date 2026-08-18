import { Base64 } from "js-base64";

const SOURCE_MARKER = /(?:\b(?:select|insert|update|delete|with|from|where|return|function|const|let|var|if|else|try|catch|await|async)\b|[\u3400-\u9fff]|[\s;{}()=<>.$'"`])/i;
const INVALID_TEXT = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\ufffd]/;

function stripPadding(value) {
    return String(value || "").replace(/=+$/g, "");
}

export function isLikelyFieldSource(value) {
    return typeof value === "string" && SOURCE_MARKER.test(value);
}

/**
 * Decode values written by historical Microi versions without treating an
 * arbitrary Base64-shaped plaintext value as encoded source.
 */
export function decodeLegacyFieldSource(value) {
    if (typeof value !== "string" || value.length === 0) {
        return value;
    }

    // Legacy Base64.encode always emits complete four-character groups.  This
    // cheap guard also protects short field values such as "test"/"abcd".
    if (value.length < 8 || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value) || !Base64.isValid(value)) {
        return value;
    }

    try {
        const decoded = Base64.decode(value);
        if (!decoded || INVALID_TEXT.test(decoded) || !isLikelyFieldSource(decoded)) {
            return value;
        }

        // A canonical round trip avoids accepting permissive decoder results.
        if (stripPadding(Base64.encode(decoded)) !== stripPadding(value)) {
            return value;
        }
        return decoded;
    } catch (error) {
        return value;
    }
}

export function decodeLegacyDiyFieldSources(diyFieldModel) {
    if (!diyFieldModel || typeof diyFieldModel !== "object") return diyFieldModel;

    ["KeyupV8Code", "V8TmpEngineForm", "V8TmpEngineTable"].forEach((key) => {
        diyFieldModel[key] = decodeLegacyFieldSource(diyFieldModel[key]);
    });

    const config = diyFieldModel.Config;
    if (!config || typeof config !== "object") return diyFieldModel;

    ["Sql", "V8Code", "V8CodeBlur", "TableChildRowClickV8"].forEach((key) => {
        config[key] = decodeLegacyFieldSource(config[key]);
    });
    if (config.OpenTable && typeof config.OpenTable === "object") {
        ["SubmitV8", "BeforeOpenV8"].forEach((key) => {
            config.OpenTable[key] = decodeLegacyFieldSource(config.OpenTable[key]);
        });
    }
    return diyFieldModel;
}
