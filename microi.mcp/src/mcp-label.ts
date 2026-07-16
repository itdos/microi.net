export interface McpLabelEnvironment {
  MICROI_LABEL_BASE64?: string;
  MICROI_LABEL?: string;
}

function decodeUtf8Base64(value: string): string {
  const normalized = value.trim();
  if (!normalized || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized) || normalized.length % 4 !== 0) {
    return '';
  }

  const bytes = Buffer.from(normalized, 'base64');
  const roundTrip = bytes.toString('base64').replace(/=+$/, '');
  if (roundTrip !== normalized.replace(/=+$/, '')) {
    return '';
  }
  return bytes.toString('utf8');
}

/**
 * MCP 客户端配置优先传 ASCII Base64，避免部分客户端把环境值误走
 * ByteString/Header 链路时无法处理中文。MICROI_LABEL 仅保留旧配置兼容。
 */
export function resolveMcpLabel(env: McpLabelEnvironment): string {
  const encoded = env.MICROI_LABEL_BASE64 || '';
  if (encoded) {
    const decoded = decodeUtf8Base64(encoded);
    if (decoded) {
      return decoded;
    }
  }
  return env.MICROI_LABEL || '';
}
