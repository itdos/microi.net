import { readonly, ref } from "vue";

const LOADING_STATE = Symbol("mci-loading-state");
const VALID_VARIANTS = new Set(["table", "cards", "form", "detail", "page", "stats", "list", "tree", "compact"]);
const HOST_VARIANT_CLASSES = Array.from(VALID_VARIANTS, variant => `mci-loading-host--${variant}`);
const SERVICE_BUSY_STATE = new WeakMap();

function appendBlock(parent, className) {
    const block = document.createElement("span");
    block.className = `mci-loading-skeleton__block ${className || ""}`.trim();
    block.setAttribute("aria-hidden", "true");
    parent.appendChild(block);
    return block;
}

function appendRows(parent, rowCount, cellCount, rowClass = "") {
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
        const row = document.createElement("div");
        row.className = `mci-loading-skeleton__row ${rowClass}`.trim();
        for (let cellIndex = 0; cellIndex < cellCount; cellIndex += 1) {
            appendBlock(row, `is-cell is-cell-${cellIndex + 1}`);
        }
        parent.appendChild(row);
    }
}

function appendCards(parent, count) {
    const grid = document.createElement("div");
    grid.className = "mci-loading-skeleton__cards";
    for (let index = 0; index < count; index += 1) {
        const card = document.createElement("div");
        card.className = "mci-loading-skeleton__card";
        appendBlock(card, "is-avatar");
        const copy = document.createElement("div");
        copy.className = "mci-loading-skeleton__copy";
        appendBlock(copy, "is-title");
        appendBlock(copy, "is-text");
        appendBlock(copy, "is-text is-short");
        card.appendChild(copy);
        grid.appendChild(card);
    }
    parent.appendChild(grid);
}

function appendFields(parent, count) {
    const grid = document.createElement("div");
    grid.className = "mci-loading-skeleton__fields";
    for (let index = 0; index < count; index += 1) {
        const field = document.createElement("div");
        field.className = "mci-loading-skeleton__field";
        appendBlock(field, "is-label");
        appendBlock(field, "is-input");
        grid.appendChild(field);
    }
    parent.appendChild(grid);
}

function buildSkeletonLayout(variant) {
    const layout = document.createElement("div");
    layout.className = `mci-loading-skeleton__layout is-${variant}`;

    if (variant === "table") {
        appendRows(layout, 1, 5, "is-header");
        appendRows(layout, 7, 5);
    } else if (variant === "cards") {
        appendCards(layout, 6);
    } else if (variant === "form" || variant === "detail") {
        appendBlock(layout, "is-form-title");
        appendFields(layout, variant === "detail" ? 6 : 8);
        appendBlock(layout, "is-form-action");
    } else if (variant === "page") {
        appendBlock(layout, "is-page-title");
        appendBlock(layout, "is-page-subtitle");
        appendCards(layout, 4);
        const panels = document.createElement("div");
        panels.className = "mci-loading-skeleton__panels";
        appendRows(panels, 5, 4);
        layout.appendChild(panels);
    } else if (variant === "stats") {
        appendCards(layout, 4);
    } else if (variant === "tree") {
        appendRows(layout, 8, 2, "is-tree-row");
    } else {
        appendRows(layout, variant === "compact" ? 3 : 6, variant === "compact" ? 2 : 3);
    }

    return layout;
}

function normalizeOptions(binding) {
    const raw = binding && binding.value;
    const config = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const requestedVariant = binding && binding.arg ? binding.arg : config.variant;
    return {
        active: config.loading !== undefined ? Boolean(config.loading) : Boolean(raw),
        label: config.label || "内容加载中",
        variant: VALID_VARIANTS.has(requestedVariant) ? requestedVariant : "list"
    };
}

function createOverlay(variant, label, fullscreen = false) {
    const overlay = document.createElement("div");
    overlay.className = `mci-loading-skeleton mci-loading-skeleton--${variant}${fullscreen ? " is-fullscreen" : ""}`;
    overlay.setAttribute("role", "status");
    overlay.setAttribute("aria-live", "polite");
    overlay.setAttribute("aria-label", label);
    overlay.dataset.mciLoadingVariant = variant;
    overlay.appendChild(buildSkeletonLayout(variant));
    const accessibleLabel = document.createElement("span");
    accessibleLabel.className = "mci-loading-skeleton__sr-only";
    accessibleLabel.textContent = label;
    overlay.appendChild(accessibleLabel);
    return overlay;
}

function restoreHost(el, state) {
    el.classList.remove("mci-loading-host", "mci-loading-host--relative", ...HOST_VARIANT_CLASSES);
    if (state.previousAriaBusy === null) el.removeAttribute("aria-busy");
    else el.setAttribute("aria-busy", state.previousAriaBusy);
}

function removeState(el) {
    const state = el[LOADING_STATE];
    if (!state) return;
    if (state.overlay && state.overlay.parentNode) state.overlay.parentNode.removeChild(state.overlay);
    restoreHost(el, state);
    delete el[LOADING_STATE];
}

function updateLoading(el, binding) {
    const options = normalizeOptions(binding);
    let state = el[LOADING_STATE];

    if (!state) {
        state = {
            overlay: null,
            variant: "",
            previousAriaBusy: el.getAttribute("aria-busy")
        };
        el[LOADING_STATE] = state;
    }

    if (!options.active) {
        if (state.overlay) state.overlay.hidden = true;
        restoreHost(el, state);
        return;
    }

    if (!state.overlay || state.variant !== options.variant) {
        if (state.overlay && state.overlay.parentNode) state.overlay.parentNode.removeChild(state.overlay);
        state.overlay = createOverlay(options.variant, options.label);
        state.variant = options.variant;
        el.appendChild(state.overlay);
    }

    state.overlay.hidden = false;
    state.overlay.setAttribute("aria-label", options.label);
    state.overlay.querySelector(".mci-loading-skeleton__sr-only").textContent = options.label;
    el.classList.add("mci-loading-host");
    el.classList.remove(...HOST_VARIANT_CLASSES);
    el.classList.add(`mci-loading-host--${options.variant}`);
    if (typeof window !== "undefined" && window.getComputedStyle && window.getComputedStyle(el).position === "static") {
        el.classList.add("mci-loading-host--relative");
    }
    el.setAttribute("aria-busy", "true");
}

export const MciLoadingDirective = {
    mounted: updateLoading,
    updated: updateLoading,
    beforeUnmount: removeState
};

export function openMciLoading(options = {}) {
    const target = typeof options.target === "string"
        ? document.querySelector(options.target)
        : options.target || document.body;
    if (!target) return { close() {} };

    const variant = VALID_VARIANTS.has(options.variant) ? options.variant : "page";
    const overlay = createOverlay(variant, options.label || "内容加载中", Boolean(options.fullscreen));
    const shouldLockBody = target === document.body && Boolean(options.fullscreen);
    let busyState = SERVICE_BUSY_STATE.get(target);
    if (!busyState) {
        busyState = { count: 0, lockCount: 0, previousAriaBusy: target.getAttribute("aria-busy") };
        SERVICE_BUSY_STATE.set(target, busyState);
    }
    busyState.count += 1;
    if (shouldLockBody) busyState.lockCount += 1;
    target.setAttribute("aria-busy", "true");
    target.appendChild(overlay);
    if (shouldLockBody) document.body.classList.add("mci-loading-service-active");

    let closed = false;
    return {
        close() {
            if (closed) return;
            closed = true;
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            const currentBusyState = SERVICE_BUSY_STATE.get(target);
            if (currentBusyState) {
                currentBusyState.count = Math.max(0, currentBusyState.count - 1);
                if (shouldLockBody) currentBusyState.lockCount = Math.max(0, currentBusyState.lockCount - 1);
                if (shouldLockBody && currentBusyState.lockCount === 0) document.body.classList.remove("mci-loading-service-active");
                if (currentBusyState.count === 0) {
                    if (currentBusyState.previousAriaBusy === null) target.removeAttribute("aria-busy");
                    else target.setAttribute("aria-busy", currentBusyState.previousAriaBusy);
                    SERVICE_BUSY_STATE.delete(target);
                }
            }
        }
    };
}

const routeLoadingState = ref(false);
let routeShowTimer = null;
let routeHideTimer = null;
let routeVisibleAt = 0;

export const routeLoading = readonly(routeLoadingState);

export function startRouteLoading() {
    if (routeHideTimer) {
        clearTimeout(routeHideTimer);
        routeHideTimer = null;
    }
    if (routeShowTimer || routeLoadingState.value) return;
    routeShowTimer = setTimeout(() => {
        routeShowTimer = null;
        routeVisibleAt = Date.now();
        routeLoadingState.value = true;
    }, 90);
}

export function finishRouteLoading() {
    if (routeShowTimer) {
        clearTimeout(routeShowTimer);
        routeShowTimer = null;
        routeLoadingState.value = false;
        return;
    }
    if (!routeLoadingState.value) return;
    const remaining = Math.max(0, 180 - (Date.now() - routeVisibleAt));
    routeHideTimer = setTimeout(() => {
        routeHideTimer = null;
        routeLoadingState.value = false;
    }, remaining);
}
