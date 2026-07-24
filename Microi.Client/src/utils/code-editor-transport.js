export const codeEditorTransportMarker = "MICROI_B64URL_V1:";
export const codeEditorTransportVersion = 1;

function bytesToBase64(bytes) {
    let binary = "";
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
        for (let index = 0; index < chunk.length; index += 1) {
            binary += String.fromCharCode(chunk[index]);
        }
    }
    return btoa(binary);
}

export function encodeCodeEditorValue(value) {
    const bytes = new TextEncoder().encode(value);
    return codeEditorTransportMarker
        + bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function prepareCodeEditorTransport(formData, diyFieldList) {
    const encodedFields = [];
    if (!formData || typeof formData !== "object" || !Array.isArray(diyFieldList)) {
        return null;
    }

    diyFieldList.forEach(function (field) {
        if (!field || field.Component !== "CodeEditor" || typeof field.Name !== "string") return;
        if (!Object.prototype.hasOwnProperty.call(formData, field.Name)) return;
        const value = formData[field.Name];
        if (typeof value !== "string") return;

        formData[field.Name] = encodeCodeEditorValue(value);
        encodedFields.push(field.Name);
    });

    if (encodedFields.length === 0) return null;
    return {
        Version: codeEditorTransportVersion,
        Encoding: "base64url",
        Fields: encodedFields
    };
}
