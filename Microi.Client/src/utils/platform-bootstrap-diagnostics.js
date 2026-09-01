const DATABASE_ERROR_GUIDES = Object.freeze({
    DatabaseHostInvalid: {
        reason: "数据库服务器地址无效，或当前后端运行环境无法解析该主机名。",
        solution: "请登录主租户，在 SaaS 引擎的租户管理中打开当前子租户，同时检查【数据库连接】和【只读数据库连接】的 Data Source/Server。该地址必须能被当前后端容器解析和访问，不能使用只存在于另一 Docker 网络中的服务名；保存后刷新租户运行配置或重启后端。"
    },
    DatabaseCredentialsRejected: {
        reason: "数据库拒绝了当前账号，账号密码错误或账号没有目标库权限。",
        solution: "请在主租户的 SaaS 租户配置中核对数据库账号和密码，并确认该账号已被授权访问当前子租户数据库；同步检查只读数据库连接，保存后刷新租户运行配置。"
    },
    DatabaseNotFound: {
        reason: "连接配置中的目标数据库不存在或数据库名填写错误。",
        solution: "请确认子租户数据库已创建并完成初始化，再核对数据库连接和只读数据库连接中的 Database/Initial Catalog；保存后刷新租户运行配置。"
    },
    DatabaseCapacityExceeded: {
        reason: "数据库连接数已耗尽，或数据库主机因连续连接失败暂时阻止了连接。",
        solution: "请检查数据库最大连接数、当前连接占用和主机阻断状态，先恢复数据库容量，再刷新页面；不要仅反复刷新制造更多连接。"
    },
    DatabaseEndpointUnreachable: {
        reason: "后端无法连接数据库服务器，可能是地址、端口、容器网络、防火墙或数据库服务状态异常。",
        solution: "请从当前后端容器验证数据库地址和端口可达，并同时核对数据库连接与只读数据库连接；修复网络或服务后刷新租户运行配置。"
    },
    DatabaseConnectionUnavailable: {
        reason: "后端无法使用当前租户的数据库连接。",
        solution: "请登录主租户，在 SaaS 引擎的租户管理中打开当前子租户，同时检查【数据库连接】和【只读数据库连接】的 Data Source/Server、端口、数据库名、账号密码及账号授权；保存后刷新租户运行配置或重启后端。"
    }
});

function readMessage(result) {
    return String(result?.Msg || result?.Message || "").trim();
}

function readErrorCode(result, message) {
    const structuredCode = String(result?.DataAppend?.ErrorCode || "").trim();
    if (DATABASE_ERROR_GUIDES[structuredCode]) return structuredCode;
    const taggedCode = message.match(/(?:ErrorCode\s*=\s*|\[)(Database[A-Za-z]+)(?:\]|\b)/i)?.[1];
    if (taggedCode) {
        const canonicalCode = Object.keys(DATABASE_ERROR_GUIDES)
            .find((key) => key.toLowerCase() === taggedCode.toLowerCase());
        if (canonicalCode) return canonicalCode;
    }

    if (/host name or ip address is invalid|name or service not known|no such host is known|nodename nor servname|getaddrinfo/i.test(message)) {
        return "DatabaseHostInvalid";
    }
    if (/access denied for user|authentication failed/i.test(message)) {
        return "DatabaseCredentialsRejected";
    }
    if (/unknown database|database does not exist/i.test(message)) {
        return "DatabaseNotFound";
    }
    if (/too many connections|max_user_connections|blocked because of many connection errors/i.test(message)) {
        return "DatabaseCapacityExceeded";
    }
    if (/unable to connect|connection refused|connection timed out|timeout expired/i.test(message)) {
        return "DatabaseEndpointUnreachable";
    }
    if (/database connection is temporarily unavailable|数据库连接失败|database[^\n]{0,40}(?:unavailable|failed)/i.test(message)) {
        return "DatabaseConnectionUnavailable";
    }
    return "";
}

function readRetryAfterSeconds(result, message) {
    const structuredSeconds = Number(result?.DataAppend?.RetryAfterSeconds || 0);
    if (Number.isFinite(structuredSeconds) && structuredSeconds > 0) {
        return Math.min(86400, Math.ceil(structuredSeconds));
    }
    const match = message.match(/Retry\s+after\s+(\d{1,6})\s+seconds/i);
    return match ? Math.min(86400, Number(match[1])) : 0;
}

export function formatPlatformSysConfigFailure(result) {
    const message = readMessage(result);
    const errorCode = readErrorCode(result, message);
    if (!errorCode) return message || "后端未返回可用的系统设置。";

    const guide = DATABASE_ERROR_GUIDES[errorCode];
    const retryAfterSeconds = readRetryAfterSeconds(result, message);
    const retryText = retryAfterSeconds > 0
        ? ` 后端保护性重试约剩余 ${retryAfterSeconds} 秒；配置未修复前无需反复刷新。`
        : "";
    return `数据库连接失败：${guide.reason}${retryText} 解决方案：${guide.solution} 为保护凭据，请勿在页面或工单中粘贴含密码的完整连接串。`;
}

export const platformDatabaseErrorGuides = DATABASE_ERROR_GUIDES;
