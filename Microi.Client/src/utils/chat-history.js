// A page belongs to one peer and one selection generation. SignalR broadcasts from
// other windows must never replace that page or reset its continuation cursor.
export function createChatHistoryState(peerId = '', generation = 0) {
    return { peerId: String(peerId), generation, cursor: '', hasMore: true, loading: false, error: '', tailPending: false, tailLoading: false };
}

export function belongsToChat(row, actorId, peerId) {
    const from = String(row?.FromUserId || '');
    const to = String(row?.ToUserId || '');
    return (from === String(actorId) && to === String(peerId)) || (from === String(peerId) && to === String(actorId));
}

export function chatMessageKey(row) {
    return row?.MessageId || row?.RequestId || row?._id || row?.tempId;
}

export function mergeChatHistory(current, incoming, actorId, peerId) {
    const result = [];
    const aliases = new Map();
    for (const row of [...current, ...incoming]) {
        if (!belongsToChat(row, actorId, peerId)) continue;
        const keys = [row.MessageId, row.RequestId, row._id, row.tempId].filter(Boolean).map(String);
        const index = keys.map(key => aliases.get(key)).find(value => value !== undefined);
        if (index === undefined) {
            keys.forEach(key => aliases.set(key, result.length));
            result.push(row);
        } else {
            keys.forEach(key => aliases.set(key, index));
            result[index] = { ...result[index], ...row };
            if (row.MessageId && !row.tempId) {
                delete result[index].tempId;
                delete result[index].SendFailed;
            }
        }
    }
    const timestamp = row => {
        const value = Date.parse(String(row.CreateTime || row.SendTime || '').replace(' ', 'T'));
        return Number.isFinite(value) ? value : 0;
    };
    return result.sort((a, b) => timestamp(a) - timestamp(b)
        || String(chatMessageKey(a) || '').localeCompare(String(chatMessageKey(b) || '')));
}

export async function fetchChatHistoryPage(state, invoke, actorId, isCurrent) {
    if (state.loading || !state.hasMore) return null;
    state.loading = true;
    state.error = '';
    try {
        const page = await invoke('GetChatHistoryPage', {
            FromUserId: actorId, ToUserId: state.peerId, HistoryCursor: state.cursor, _PageSize: 30
        });
        if (!isCurrent(state)) return null;
        if (!page || String(page.PeerUserId) !== state.peerId || !Array.isArray(page.Messages))
            throw new Error('聊天历史响应不属于当前会话，请重试。');
        if (page.HasMore && (!page.NextCursor || page.NextCursor === state.cursor))
            throw new Error('聊天历史分页未前进，请重试。');
        state.cursor = page.NextCursor || '';
        state.hasMore = page.HasMore === true;
        return page.Messages;
    } catch (error) {
        if (isCurrent(state)) state.error = error?.message || '历史消息加载失败，请重试。';
        return null;
    } finally {
        state.loading = false;
    }
}

// Reading the latest visible messages also acknowledges them on the server. This
// bounded refresh is independent of the backwards history cursor and never resets it.
// Incoming messages during a request coalesce into one trailing refresh.
export async function refreshChatHistoryTail(state, invoke, actorId, isCurrent) {
    if (!state.tailPending || state.tailLoading || !isCurrent(state)) return null;
    state.tailLoading = true;
    let rows = [];
    try {
        do {
            state.tailPending = false;
            const page = await invoke('GetChatHistoryPage', {
                FromUserId: actorId, ToUserId: state.peerId, HistoryCursor: '', _PageSize: 30
            });
            if (!isCurrent(state)) return null;
            if (!page || String(page.PeerUserId) !== state.peerId || !Array.isArray(page.Messages))
                throw new Error('聊天已读响应不属于当前会话');
            rows = mergeChatHistory(rows, page.Messages, actorId, state.peerId);
        } while (state.tailPending);
        return rows;
    } catch {
        if (isCurrent(state)) state.tailPending = true;
        return null;
    } finally { state.tailLoading = false; }
}
