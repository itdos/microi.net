const dialogState = new WeakMap();
let runtimeObserver = null;
let pendingFrame = 0;
const pendingNodes = new Set();

function visibleDialog(dialog) {
    if (!(dialog instanceof HTMLElement)) return false;
    const overlay = dialog.closest(".el-overlay");
    return !overlay || window.getComputedStyle(overlay).display !== "none";
}

function fieldSummary(context = {}) {
    const tableName = context.tableName && context.tableName !== context.tableLabel
        ? `表名：${context.tableName}`
        : "";
    return [context.tableLabel, tableName, context.componentLabel, context.description]
        .filter(Boolean)
        .join(" · ");
}

function fieldHeading(dialog, context) {
    const header = dialog.querySelector(":scope > .el-dialog__header");
    if (!header) return;

    const oldTitle = header.querySelector(":scope > .el-dialog__title");
    if (oldTitle) oldTitle.classList.add("mci-field-config-original-title");

    let heading = header.querySelector(":scope > .mci-field-config-heading");
    if (!heading) {
        heading = document.createElement("div");
        heading.className = "mci-field-config-heading";
        heading.innerHTML = "<span></span><h2><strong></strong><em></em></h2><p></p>";
        header.insertBefore(heading, header.firstChild);
    }

    const setText = (selector, value) => {
        const node = heading.querySelector(selector);
        if (node && node.textContent !== value) node.textContent = value;
    };
    setText("span", context.eyebrow || "FIELD SETTINGS");
    setText("strong", context.label || context.name || "字段设置");
    setText("em", context.name || "未命名字段");
    setText("p", fieldSummary(context));
}

function installFallbackDrag(dialog, state) {
    if (state.dragInstalled || dialog.classList.contains("is-draggable")) return;
    const header = dialog.querySelector(":scope > .el-dialog__header");
    if (!header) return;

    const onPointerDown = (event) => {
        if (event.button !== 0) return;
        if (event.target.closest("button, a, input, textarea, select, [role='button'], .el-dialog__headerbtn")) return;

        const rect = dialog.getBoundingClientRect();
        const startX = event.clientX;
        const startY = event.clientY;
        const startLeft = rect.left;
        const startTop = rect.top;
        const maxLeft = Math.max(0, window.innerWidth - rect.width);
        const maxTop = Math.max(0, window.innerHeight - Math.min(rect.height, window.innerHeight));

        dialog.style.position = "fixed";
        dialog.style.margin = "0";
        dialog.style.left = `${startLeft}px`;
        dialog.style.top = `${startTop}px`;
        dialog.style.transform = "none";
        dialog.classList.add("is-dragging");

        const onPointerMove = (moveEvent) => {
            const nextLeft = Math.min(maxLeft, Math.max(0, startLeft + moveEvent.clientX - startX));
            const nextTop = Math.min(maxTop, Math.max(0, startTop + moveEvent.clientY - startY));
            dialog.style.left = `${nextLeft}px`;
            dialog.style.top = `${nextTop}px`;
        };
        const onPointerUp = () => {
            dialog.classList.remove("is-dragging");
            document.removeEventListener("pointermove", onPointerMove);
            document.removeEventListener("pointerup", onPointerUp);
            document.removeEventListener("pointercancel", onPointerUp);
        };

        document.addEventListener("pointermove", onPointerMove);
        document.addEventListener("pointerup", onPointerUp);
        document.addEventListener("pointercancel", onPointerUp);
        event.preventDefault();
    };

    header.addEventListener("pointerdown", onPointerDown);
    dialog.classList.add("mci-runtime-draggable");
    state.dragInstalled = true;
}

/**
 * Apply the platform dialog contract to an existing Element Plus dialog.
 * State is retained outside Vue's rendered class list, so internal draggable
 * re-renders cannot permanently remove the contract or the field heading.
 */
export function enhanceMciDialog(dialog, context = null) {
    if (!(dialog instanceof HTMLElement)) return null;
    const overlay = dialog.closest(".el-overlay");
    const previous = dialogState.get(dialog) || (overlay && dialogState.get(overlay)) || {};
    const state = { ...previous };
    if (context) state.context = { ...(state.context || {}), ...context };
    dialogState.set(dialog, state);
    if (overlay) dialogState.set(overlay, state);

    dialog.classList.add("mci-unified-dialog", "mci-native-title-dialog");
    // Element Plus rebuilds the whole dialog class attribute when its
    // draggable state changes. A data attribute is not part of that computed
    // class list, so it gives the visual contract a stable CSS anchor during
    // and after dragging (and prevents a one-frame square-dialog flash).
    dialog.dataset.mciDialogContract = state.context?.variant || "dialog";
    if (state.context?.variant === "field") {
        dialog.classList.add("mci-field-config-dialog");
        dialog.dataset.mciTableName = String(state.context.tableName || "");
        fieldHeading(dialog, state.context);
    }
    if (overlay) {
        overlay.classList.add("mci-unified-overlay");
        overlay.dataset.mciDialogContract = state.context?.variant || "dialog";
        if (state.context?.variant === "field") overlay.classList.add("mci-field-config-overlay");
    }
    installFallbackDrag(dialog, state);
    return dialog;
}

function enhanceTree(node) {
    if (!(node instanceof Element)) return;
    if (node.matches(".el-dialog")) enhanceMciDialog(node);
    else node.querySelectorAll?.(".el-dialog").forEach((dialog) => enhanceMciDialog(dialog));
}

function completePendingDialogStructure(target) {
    const element = target instanceof Element ? target : target?.parentElement;
    if (!(element instanceof Element)) return;
    const dialog = element.closest(".el-dialog");
    if (!dialog || !visibleDialog(dialog)) return;
    const state = dialogState.get(dialog) || dialogState.get(dialog.closest(".el-overlay"));
    if (!state) return;
    const overlay = dialog.closest(".el-overlay");
    const missingDialogContract = !dialog.classList.contains("mci-unified-dialog")
        || (state.context?.variant === "field" && !dialog.classList.contains("mci-field-config-dialog"));
    const missingOverlayContract = overlay && (!overlay.classList.contains("mci-unified-overlay")
        || (state.context?.variant === "field" && !overlay.classList.contains("mci-field-config-overlay")));
    const missingDragHandle = !state.dragInstalled && dialog.querySelector(":scope > .el-dialog__header");
    const missingFieldHeading = state.context?.variant === "field"
        && !dialog.querySelector(":scope > .el-dialog__header .mci-field-config-heading");
    const staleFieldSummary = state.context?.variant === "field"
        && dialog.querySelector(":scope > .el-dialog__header .mci-field-config-heading p")?.textContent !== fieldSummary(state.context);
    if (missingDialogContract || missingOverlayContract || missingDragHandle || missingFieldHeading || staleFieldSummary) {
        enhanceMciDialog(dialog, state.context || null);
    }
}

function flushPendingDialogs() {
    pendingFrame = 0;
    const nodes = Array.from(pendingNodes);
    pendingNodes.clear();
    nodes.forEach((node) => {
        enhanceTree(node);
        completePendingDialogStructure(node);
    });
}

function queueDialogNode(node) {
    if (!(node instanceof Element)) return;
    if (!node.matches(".el-dialog, .el-overlay, .el-dialog__header")
        && !node.querySelector?.(".el-dialog")) return;
    pendingNodes.add(node);
    if (!pendingFrame) pendingFrame = window.requestAnimationFrame(flushPendingDialogs);
}

export function installMciDialogRuntime() {
    if (runtimeObserver || typeof MutationObserver === "undefined") return;
    const start = () => {
        document.querySelectorAll(".el-dialog").forEach((dialog) => enhanceMciDialog(dialog));
        runtimeObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach(queueDialogNode);
                if (mutation.target instanceof Element && mutation.target.closest(".el-dialog")) {
                    queueDialogNode(mutation.target);
                }
            });
        });
        runtimeObserver.observe(document.body, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ["class"]
        });
    };
    if (document.body) start();
    else document.addEventListener("DOMContentLoaded", start, { once: true });
}
