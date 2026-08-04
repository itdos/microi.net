function normalizeBase(url) {
    return String(url || "").replace(/\/+$/, "");
}

function resolveUrl(url, apiBase) {
    var value = String(url || "").trim();
    if (/^https?:\/\//i.test(value)) return value;
    return normalizeBase(apiBase) + "/" + value.replace(/^\/+/, "");
}

function sanitizeParam(input) {
    var param = input && typeof input === "object" && !Array.isArray(input)
        ? Object.assign({}, input)
        : {};
    var forbidden = {
        osclient: true,
        currentuserid: true,
        currentusername: true,
        apikey: true,
        endpoint: true,
        serverinternalcall: true,
        headers: true,
        header: true,
        token: true,
        authorization: true,
        source: true
    };
    Object.keys(param).forEach(function (name) {
        if (forbidden[String(name).toLowerCase()]) delete param[name];
    });
    return param;
}

function parseJsonResult(value) {
    if (value && typeof value === "object") return value;
    try {
        return JSON.parse(String(value || ""));
    } catch (error) {
        return { Code: 0, Data: null, Msg: String(value || "AI 服务未返回有效 JSON。") };
    }
}

function toHeaderObject(headers) {
    var result = {};
    if (!headers) return result;
    if (typeof headers.forEach === "function") {
        headers.forEach(function (value, name) { result[name] = value; });
        return result;
    }
    Object.keys(headers).forEach(function (name) { result[name] = headers[name]; });
    return result;
}

function appendQuery(url, param) {
    var query = new URLSearchParams();
    Object.keys(param || {}).forEach(function (name) {
        var value = param[name];
        if (value === undefined || value === null || typeof value === "object") return;
        query.append(name, String(value));
    });
    var text = query.toString();
    return text ? url + (url.indexOf("?") >= 0 ? "&" : "?") + text : url;
}

function parseSseBlock(block) {
    var eventName = "message";
    var data = [];
    String(block || "").split("\n").forEach(function (line) {
        if (line.indexOf("event:") === 0) eventName = line.substring(6).trim() || "message";
        if (line.indexOf("data:") === 0) data.push(line.substring(5).replace(/^ /, ""));
    });
    return { event: eventName, data: data.join("\n") };
}

/**
 * 创建浏览器端 V8.AI。认证头、租户和 Token 轮换由宿主提供，调用代码不能覆盖。
 */
export function createV8AI(options = {}) {
    var http = options.http;
    var fetchAdapter = options.fetchAdapter
        || (typeof fetch === "function" ? fetch.bind(globalThis) : null);

    async function request(endpoint, dynamicParam, forcedMethod) {
        if (!http) throw new Error("V8.AI 缺少 V8.Http 宿主。");
        var param = sanitizeParam(dynamicParam);
        var method = String(forcedMethod || param.Method || "POST").toUpperCase();
        delete param.Method;
        var text = method === "GET"
            ? await http.Get({ Url: endpoint, GetParam: param })
            : await http.Post({ Url: endpoint, PostParam: param, ParamType: "json" });
        return parseJsonResult(text);
    }

    async function stream(endpoint, dynamicParam, onChunkReceived, streamOptions) {
        if (typeof onChunkReceived !== "function") {
            throw new Error("V8.AI 流式调用必须传入 onChunkReceived 回调函数。");
        }
        if (!fetchAdapter) throw new Error("当前浏览器不支持 V8.AI 流式调用。");

        var param = sanitizeParam(dynamicParam);
        var callOptions = streamOptions || {};
        var method = String(callOptions.Method || param.Method || "POST").toUpperCase();
        delete param.Method;
        var apiBase = typeof options.getApiBase === "function" ? options.getApiBase() : "";
        var url = resolveUrl(endpoint, apiBase);
        var platformContext = typeof options.getPlatformContext === "function"
            ? (options.getPlatformContext() || {})
            : {};
        var headers = Object.assign({}, platformContext.headers || {});
        var init = {
            method: method,
            headers: headers,
            signal: callOptions.Signal || callOptions.signal
        };
        if (method === "GET") {
            url = appendQuery(url, param);
        } else {
            headers["Content-Type"] = "application/json";
            init.body = JSON.stringify(param);
        }

        var response = await fetchAdapter(url, init);
        if (typeof options.onPlatformResponse === "function") {
            options.onPlatformResponse(
                toHeaderObject(response.headers),
                platformContext.requestToken);
        }
        if (!response.ok) {
            var errorText = await response.text();
            var errorResult = parseJsonResult(errorText);
            return errorResult && typeof errorResult.Code === "number"
                ? errorResult
                : { Code: 0, Data: null, Msg: errorText || ("AI 请求失败（HTTP " + response.status + "）") };
        }
        if (!response.body || typeof response.body.getReader !== "function") {
            return { Code: 0, Data: null, Msg: "当前浏览器无法读取 AI 流式响应。" };
        }

        var reader = response.body.getReader();
        var decoder = new TextDecoder("utf-8");
        var buffer = "";
        var fullText = "";
        var finalResult = null;

        async function consume(block) {
            var eventData = parseSseBlock(block);
            if (eventData.event === "message") {
                fullText += eventData.data;
                await onChunkReceived(eventData.data);
            } else if (eventData.event === "result") {
                var data = eventData.data;
                try { data = JSON.parse(data); } catch (error) {}
                finalResult = { Code: 1, Data: data, Msg: "" };
            } else if (eventData.event === "error") {
                finalResult = { Code: 0, Data: null, Msg: eventData.data || "AI 流式调用失败。" };
            }
        }

        while (true) {
            var read = await reader.read();
            buffer += decoder.decode(read.value || new Uint8Array(), { stream: !read.done });
            buffer = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
            var boundary = buffer.indexOf("\n\n");
            while (boundary >= 0) {
                var block = buffer.substring(0, boundary);
                buffer = buffer.substring(boundary + 2);
                if (block.trim()) await consume(block);
                boundary = buffer.indexOf("\n\n");
            }
            if (read.done) break;
        }
        if (buffer.trim()) await consume(buffer);
        return finalResult || { Code: 1, Data: fullText, Msg: "" };
    }

    var api = {
        Chat: function (param) { return request("/api/Ai/Chat", param); },
        ChatGet: function (param) { return request("/api/Ai/Chat", param, "GET"); },
        ChatStream: function (param, onChunk, callOptions) {
            return stream("/api/Ai/ChatStream", param, onChunk, callOptions);
        },
        RecognizeIntent: function (param) { return request("/api/Ai/RecognizeIntent", param); },
        NL2SQL: function (param) { return request("/api/Ai/NL2SQL", param); },
        NL2V8: function (param) { return request("/api/Ai/NL2V8EngineSync", param); },
        NL2V8Stream: function (param, onChunk, callOptions) {
            return stream("/api/Ai/NL2V8Engine", param, onChunk, callOptions);
        }
    };
    api.ChatAsync = api.Chat;
    api.RecognizeIntentAsync = api.RecognizeIntent;
    api.NL2SQLAsync = api.NL2SQL;
    api.NL2V8Async = api.NL2V8;
    return api;
}

export default createV8AI;
