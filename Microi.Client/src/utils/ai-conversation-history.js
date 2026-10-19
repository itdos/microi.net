export async function readAiHistoryPage(client, source, pageIndex = 1, conversationId = '') {
    const result = await client.PostAsync('/apiengine/platform-ai-runtime', {
        Action: conversationId ? 'GetConversationRecords' : 'ListConversationSummaries',
        Source: source, PageIndex: pageIndex, ...(conversationId ? { ConversationId: conversationId } : {})
    }, null, null, 'json');
    const body = result?.data?.Code !== undefined ? result.data : result;
    if (Number(body?.Code) !== 1) throw new Error(body?.Msg || '会话读取失败');
    return body.Data || {};
}

export async function readAiConversation(client, source, conversationId) {
    const records = new Map();
    let page = 1;
    while (page) {
        const data = await readAiHistoryPage(client, source, page, conversationId);
        for (const record of data.Records || []) records.set(record.__rowId || record.Id, record);
        if (!data.HasMore) break;
        const next = Number(data.NextPage);
        if (!Number.isInteger(next) || next <= page || next > 10000) throw new Error('会话分页无效，请重新打开');
        page = next;
    }
    return [...records.values()].sort((a, b) => String(a.CreatedAt || '').localeCompare(String(b.CreatedAt || '')));
}
