export function runV8ButtonVisibilityCode(code, context) {
    if (code == null || String(code).trim() === "") {
        return undefined;
    }
    var runner = new Function("V8", "row", "btn", "self", "v8", "_", String(code));
    return runner.call(context.self || null, context.V8, context.row, context.btn, context.self, context.v8, context._);
}

export async function runV8ButtonVisibilityCodeAsync(code, context) {
    if (code == null || String(code).trim() === "") {
        return undefined;
    }
    var runner = new Function("V8", "row", "btn", "self", "v8", "_", "return (async function() {\n" + String(code) + "\n}).call(this);");
    return await runner.call(context.self || null, context.V8, context.row, context.btn, context.self, context.v8, context._);
}

export function resolveV8ButtonVisibility(V8, returnValue) {
    if (returnValue === false || (V8 && V8.Result === false)) {
        return false;
    }
    if (returnValue === true || (V8 && V8.Result === true)) {
        return true;
    }
    return null;
}
