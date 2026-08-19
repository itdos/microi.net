export function scheduleTableInit(context, args) {
    if (!context || typeof context.Init !== "function") {
        return Promise.resolve();
    }

    context._pendingTableInitArgs = Array.isArray(args) ? args : [];
    if (context._tableInitScheduled) {
        return context._tableInitPromise || Promise.resolve();
    }

    context._tableInitScheduled = true;
    var run = async function() {
        context._tableInitScheduled = false;
        var pendingArgs = context._pendingTableInitArgs || [];
        context._pendingTableInitArgs = null;
        if (context._isDestroyed || context._isBeingDestroyed || context.ParentFormLoadFinish === false) {
            return;
        }
        return context.Init.apply(context, pendingArgs);
    };

    context._tableInitPromise = typeof context.$nextTick === "function"
        ? context.$nextTick(run)
        : Promise.resolve().then(run);
    return context._tableInitPromise;
}
