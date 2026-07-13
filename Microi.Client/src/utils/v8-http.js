import axios from "axios";

function normalizeBase(url) {
    return String(url || "").replace(/\/+$/, "");
}

function isAbsoluteHttpUrl(url) {
    return /^https?:\/\//i.test(String(url || ""));
}

function resolveUrl(url, apiBase) {
    var value = String(url || "").trim();
    if (isAbsoluteHttpUrl(value)) return value;
    return normalizeBase(apiBase) + "/" + value.replace(/^\/+/, "");
}

function isPlatformUrl(originalUrl, resolvedUrl, apiBase) {
    if (!isAbsoluteHttpUrl(originalUrl)) return true;
    var base = normalizeBase(apiBase);
    return !!base && (resolvedUrl === base || resolvedUrl.indexOf(base + "/") === 0);
}

function setHeader(headers, name, value) {
    var lowerName = String(name || "").toLowerCase();
    Object.keys(headers).forEach(function (key) {
        if (String(key).toLowerCase() === lowerName) delete headers[key];
    });
    if (value !== undefined && value !== null) headers[name] = value;
}

function mergeHeaders() {
    var result = {};
    Array.prototype.slice.call(arguments).forEach(function (source) {
        if (!source || typeof source !== "object") return;
        Object.keys(source).forEach(function (name) {
            setHeader(result, name, source[name]);
        });
    });
    return result;
}

function removeHeader(headers, name) {
    var lowerName = String(name || "").toLowerCase();
    Object.keys(headers).forEach(function (key) {
        if (String(key).toLowerCase() === lowerName) delete headers[key];
    });
}

function hasHeader(headers, name) {
    var lowerName = String(name || "").toLowerCase();
    return Object.keys(headers).some(function (key) {
        return String(key).toLowerCase() === lowerName;
    });
}

function normalizeValue(value) {
    if (value === undefined || value === null) return "";
    return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function appendFormFields(target, fields) {
    if (!fields || typeof fields !== "object") return;
    Object.keys(fields).forEach(function (name) {
        var value = fields[name];
        if (Array.isArray(value)) {
            value.forEach(function (item) {
                target.append(name, normalizeValue(item));
            });
        } else {
            target.append(name, normalizeValue(value));
        }
    });
}

function base64ToBlob(value) {
    var text = String(value || "");
    var mime = "application/octet-stream";
    var match = text.match(/^data:([^;,]+);base64,(.*)$/i);
    if (match) {
        mime = match[1];
        text = match[2];
    }
    var binary = atob(text);
    var bytes = new Uint8Array(binary.length);
    for (var index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return new Blob([bytes], { type: mime });
}

function appendFiles(formData, param) {
    var base64Files = param.FilesByteBase64 || {};
    Object.keys(base64Files).forEach(function (name) {
        formData.append(name, base64ToBlob(base64Files[name]), name);
    });

    var stringFiles = param.FilesByteString || {};
    Object.keys(stringFiles).forEach(function (name) {
        formData.append(name, new Blob([String(stringFiles[name] || "")]), name);
    });

    var byteFiles = param.FilesByte || {};
    Object.keys(byteFiles).forEach(function (name) {
        formData.append(name, new Blob([byteFiles[name]]), name);
    });
}

function hasFiles(param) {
    return [param.FilesByteBase64, param.FilesByteString, param.FilesByte].some(function (files) {
        return files && typeof files === "object" && Object.keys(files).length > 0;
    });
}

function bodyNames(method) {
    return method === "PATCH"
        ? { param: "PatchParam", text: "PatchParamString" }
        : { param: "PostParam", text: "PostParamString" };
}

function buildBody(param, method, headers) {
    if (method === "GET") return undefined;
    var names = bodyNames(method);
    var bodyParam = param[names.param];
    var bodyString = param[names.text];
    var paramType = String(param.ParamType || "form").toLowerCase();

    if (hasFiles(param)) {
        if (typeof FormData === "undefined" || typeof Blob === "undefined" || typeof atob === "undefined") {
            throw new Error("当前前端运行环境不支持 V8.Http 文件上传。");
        }
        var formData = new FormData();
        appendFormFields(formData, bodyParam);
        appendFiles(formData, param);
        removeHeader(headers, "Content-Type");
        return formData;
    }

    if (paramType === "json") {
        if (!hasHeader(headers, "Content-Type")) setHeader(headers, "Content-Type", "application/json");
        if (bodyString !== undefined && bodyString !== null && bodyString !== "") return String(bodyString);
        return JSON.stringify(bodyParam === undefined ? {} : bodyParam);
    }

    if (paramType === "xml") {
        if (!hasHeader(headers, "Content-Type")) setHeader(headers, "Content-Type", "application/xml");
        return bodyString !== undefined && bodyString !== null ? String(bodyString) : normalizeValue(bodyParam);
    }

    if (paramType === "binary") return bodyString !== undefined ? bodyString : bodyParam;

    if (!hasHeader(headers, "Content-Type")) {
        setHeader(headers, "Content-Type", "application/x-www-form-urlencoded;charset=UTF-8");
    }
    var formBody = new URLSearchParams();
    appendFormFields(formBody, bodyParam);
    return formBody;
}

function toHeaderObject(headers) {
    if (!headers) return {};
    if (typeof headers.toJSON === "function") return headers.toJSON();
    return headers;
}

function toHeaderList(headers) {
    var source = toHeaderObject(headers);
    return Object.keys(source || {}).map(function (name) {
        return { Name: name, Value: source[name] };
    });
}

function toUint8Array(value) {
    if (value instanceof Uint8Array) return value;
    if (typeof ArrayBuffer !== "undefined" && value instanceof ArrayBuffer) return new Uint8Array(value);
    if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView && ArrayBuffer.isView(value)) {
        return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    }
    var text = value === undefined || value === null
        ? ""
        : typeof value === "string"
            ? value
            : JSON.stringify(value);
    return typeof TextEncoder !== "undefined" ? new TextEncoder().encode(text) : new Uint8Array();
}

function decodeBytes(bytes, encoding) {
    if (!bytes || !bytes.length) return "";
    if (typeof TextDecoder !== "undefined") {
        try {
            return new TextDecoder(String(encoding || "utf-8")).decode(bytes);
        } catch (error) {
            return new TextDecoder("utf-8").decode(bytes);
        }
    }
    return Array.prototype.map.call(bytes, function (byte) {
        return String.fromCharCode(byte);
    }).join("");
}

function toContent(value, encoding) {
    if (typeof value === "string") return value;
    if (value === undefined || value === null) return "";
    if ((typeof ArrayBuffer !== "undefined" && value instanceof ArrayBuffer) || value instanceof Uint8Array) {
        return decodeBytes(toUint8Array(value), encoding);
    }
    return JSON.stringify(value);
}

/**
 * 创建浏览器端 V8.Http。同后端使用 PascalCase 对象参数；浏览器端请求始终返回 Promise。
 */
export function createV8Http(options = {}) {
    var requestAdapter = options.requestAdapter || axios;

    async function execute(dynamicParam, method, returnResponse) {
        var param = dynamicParam || {};
        if (!param || typeof param !== "object" || Array.isArray(param)) {
            throw new Error("V8.Http 参数必须是对象。");
        }
        if (!param.Url) throw new Error("V8.Http.Url 不能为空。");

        var apiBase = typeof options.getApiBase === "function" ? options.getApiBase() : "";
        var url = resolveUrl(param.Url, apiBase);
        var platformRequest = isPlatformUrl(param.Url, url, apiBase);
        var platformContext = platformRequest && typeof options.getPlatformContext === "function"
            ? (options.getPlatformContext() || {})
            : {};
        var headers = mergeHeaders(platformContext.headers, param.Headers, param.Header);
        var body = buildBody(param, method, headers);
        var timeoutSeconds = Number(param.Timeout !== undefined ? param.Timeout : param.TimeOut);
        if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) timeoutSeconds = 600;

        try {
            var response = await requestAdapter({
                url: url,
                method: method,
                params: param.GetParam || {},
                data: body,
                headers: headers,
                timeout: timeoutSeconds * 1000,
                responseType: returnResponse ? "arraybuffer" : "text",
                transformResponse: [function (data) { return data; }],
                validateStatus: function () { return true; }
            });
            var responseHeaders = toHeaderObject(response.headers);
            if (platformRequest && typeof options.onPlatformResponse === "function") {
                options.onPlatformResponse(responseHeaders, platformContext.requestToken);
            }
            if (!returnResponse) return toContent(response.data, param.Encoding);

            var rawBytes = toUint8Array(response.data);
            return {
                Headers: toHeaderList(responseHeaders),
                Content: decodeBytes(rawBytes, param.Encoding),
                RawBytes: rawBytes,
                StatusCode: Number(response.status || response.statusCode || 0),
                ErrorMessage: ""
            };
        } catch (error) {
            var errorMessage = error && error.message ? error.message : String(error || "HTTP请求失败");
            if (!returnResponse) return errorMessage;
            return {
                Headers: [],
                Content: "",
                RawBytes: new Uint8Array(),
                StatusCode: error && error.response ? Number(error.response.status || 0) : 0,
                ErrorMessage: errorMessage
            };
        }
    }

    return {
        Get: function (param) { return execute(param, "GET", false); },
        GetResponse: function (param) { return execute(param, "GET", true); },
        Post: function (param) { return execute(param, "POST", false); },
        PostResponse: function (param) { return execute(param, "POST", true); },
        Patch: function (param) { return execute(param, "PATCH", false); },
        PatchResponse: function (param) { return execute(param, "PATCH", true); }
    };
}

export default createV8Http;
