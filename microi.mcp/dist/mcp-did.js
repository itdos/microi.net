import crypto from 'node:crypto';
const MAX_DID_LENGTH = 128;
const PRINTABLE_ASCII_PATTERN = /^[\x20-\x7E]+$/;
/**
 * HTTP Header values must stay within printable ASCII for compatibility with
 * clients that convert them through Web IDL ByteString.
 */
export function resolveMcpDid(configuredDid, hostname = 'Unknown') {
    const fallback = `MCP:${hostname || 'Unknown'}`;
    const raw = String(configuredDid || fallback).trim() || 'MCP:Unknown';
    if (raw.length <= MAX_DID_LENGTH && PRINTABLE_ASCII_PATTERN.test(raw)) {
        return raw;
    }
    const digest = crypto
        .createHash('sha256')
        .update(raw, 'utf8')
        .digest('hex')
        .slice(0, 16);
    const stem = raw
        .normalize('NFKD')
        .replace(/[^\x20-\x7E]/g, '')
        .replace(/[^A-Za-z0-9._:-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^[-.:]+|[-.:]+$/g, '') || 'MCP';
    const maxStemLength = MAX_DID_LENGTH - digest.length - 1;
    return `${stem.slice(0, maxStemLength)}-${digest}`;
}
//# sourceMappingURL=mcp-did.js.map