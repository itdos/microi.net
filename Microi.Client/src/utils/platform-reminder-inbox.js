// The database owns reminder state. A realtime event is only a wake-up hint.
export function safeReminderLink(value, origin) {
    const text = String(value || '');
    if (!text || /[\u0000-\u0020\\]/.test(text) || text.startsWith('//')) return '';
    try {
        const url = new URL(text, origin);
        return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
            && (/^https?:\/\//i.test(text) || text.startsWith('/') || text.startsWith('#')) ? url.href : '';
    } catch { return ''; }
}

export function createReminderInbox({ request, onChange, connected = () => false,
    now = Date.now, schedule = setTimeout, cancel = clearTimeout, entryId }) {
    let disposed = false, busy = false, rerun = false, timer, items = [], failures = 0;
    const dismissed = new Set(), pending = new Map(), ownedPresentations = new Map();
    // The framework V8.Http contract returns response text; SDK adapters may already parse it.
    const parseResponse = value => typeof value === 'string' ? JSON.parse(value) : value;
    const publish = () => { if (!disposed) onChange(items.filter(item => !dismissed.has(item.Id) && Date.parse(item.EndsAt) > now())); };
    const arm = delay => { cancel(timer); if (!disposed) timer = schedule(refresh, Math.max(1000, delay)); };
    async function acknowledge(id, action = 'Acknowledge', item) {
        const result = parseResponse(await request({ Action: action, Id: id, EntryId: entryId }));
        if (Number(result?.Code) !== 1) throw new Error('Reminder acknowledgement unavailable');
        if (action === 'Presented' && item && result.Data?.Claimed === true && !dismissed.has(id)) ownedPresentations.set(id, item);
        if (action === 'Acknowledge' || result.Data?.NoLongerActive) ownedPresentations.delete(id);
        if (pending.get(id)?.action === action) pending.delete(id);
    }
    async function refresh() {
        if (disposed) return;
        if (busy) { rerun = true; return; }
        cancel(timer); busy = true;
        let delay = connected() ? 60000 : 15000;
        try {
            // Retry acknowledgements with the same occurrence and page identity before reconciling.
            for (const [id, retry] of [...pending.entries()].slice(0, 5)) { try { await acknowledge(id, retry.action, retry.item); } catch { break; } }
            const result = parseResponse(await request({ Action: 'Inbox', EntryId: entryId }));
            if (disposed) return;
            if (Number(result?.Code) !== 1 || !Array.isArray(result.Data)) throw new Error('Reminder inbox unavailable');
            failures = 0;
            const seen = new Set();
            const candidates = result.Data.filter(item => item && typeof item.Id === 'string' && !seen.has(item.Id)
                && seen.add(item.Id) && typeof item.Title === 'string' && typeof item.Content === 'string'
                && Date.parse(item.EndsAt) > now()).slice(0, 300);
            // A server-side claim prevents two browser documents from displaying the same restart notice.
            // ActiveIds keeps an already claimed dialog open until the user closes it or publication ends.
            const active = new Set(Array.isArray(result.DataAppend?.ActiveIds) ? result.DataAppend.ActiveIds : []);
            for (const [id, item] of ownedPresentations) {
                if (!active.has(id) || Date.parse(item.EndsAt) <= now()) { ownedPresentations.delete(id); continue; }
                if (!seen.has(id)) candidates.push(item);
            }
            candidates.sort((a, b) => Number(b.Priority || 0) - Number(a.Priority || 0) || String(a.DueAt || '').localeCompare(String(b.DueAt || '')) || a.Id.localeCompare(b.Id));
            const next = candidates.find(item => !dismissed.has(item.Id));
            if (next?.DisplayMode === 'AfterServerRestart' && !ownedPresentations.has(next.Id)) {
                const retry = { action: 'Presented', item: next };
                pending.set(next.Id, retry);
                try { await acknowledge(next.Id, retry.action, next); } catch { delay = 15000; }
                if (disposed) return;
            }
            items = candidates.filter(item => item.DisplayMode !== 'AfterServerRestart' || ownedPresentations.has(item.Id));
            // Keep local dismissal during this document lifetime, including a delayed replica read.
            publish();
            const due = Date.parse(result.DataAppend?.NextCheckAt);
            if (Number.isFinite(due)) delay = Math.min(delay, Math.max(1000, due - now()));
        } catch {
            failures++;
            items = items.filter(item => Date.parse(item.EndsAt) > now());
            publish();
            delay = Math.min(300000, 15000 * 2 ** Math.min(failures, 5));
        } finally {
            busy = false;
            if (!disposed) { arm(rerun ? 1000 : delay); rerun = false; }
        }
    }
    return {
        refresh,
        async close(id) {
            if (disposed || !items.some(item => item.Id === id) || dismissed.has(id)) return;
            dismissed.add(id); pending.set(id, { action: 'Acknowledge' }); publish();
            try { await acknowledge(id); } catch { if (!disposed) arm(15000); }
            if (!disposed) arm(1000);
        },
        dispose() { disposed = true; cancel(timer); items = []; pending.clear(); dismissed.clear(); ownedPresentations.clear(); }
    };
}
