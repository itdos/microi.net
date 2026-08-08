function readElementExtent(element) {
    let rect = null;
    try {
        rect = element?.getBoundingClientRect?.() || null;
    } catch (_) {
        rect = null;
    }
    return {
        width: Number(rect?.width || element?.scrollWidth || element?.clientWidth || 0),
        height: Number(rect?.height || element?.scrollHeight || element?.clientHeight || 0)
    };
}

function hasVisibleContent(element, getComputedStyle) {
    if (!element) return false;
    const hasDom = Number(element.childElementCount || 0) > 0
        || String(element.textContent || "").trim().length > 0;
    if (!hasDom) return false;

    let style = null;
    try {
        style = typeof getComputedStyle === "function" ? getComputedStyle(element) : null;
    } catch (_) {
        style = null;
    }
    if (style?.display === "none" || style?.visibility === "hidden") return false;

    const extent = readElementExtent(element);
    return extent.width > 0 && extent.height > 0;
}

/**
 * micro-app 的 mounted/ready 只证明生命周期或子应用脚本已执行，不能证明
 * iframe 容器已有用户可见内容。宿主必须以真实 DOM 与几何尺寸作为最终事实。
 */
export function hasRenderableMicroAppContent(app, getComputedStyle) {
    if (!app || typeof app.querySelector !== "function") return false;
    const body = app.querySelector("micro-app-body")
        || app.shadowRoot?.querySelector?.("micro-app-body");
    // iframe 沙箱异步创建 micro-app-body；缺失表示仍在渲染，绝不是成功。
    if (!body) return false;

    const appRoot = body.querySelector?.("#app");
    if (appRoot) return hasVisibleContent(appRoot, getComputedStyle);

    return Array.from(body.children || []).some((element) => {
        if (["SCRIPT", "STYLE", "LINK"].includes(String(element.tagName || "").toUpperCase())) {
            return false;
        }
        return hasVisibleContent(element, getComputedStyle);
    });
}

export function shouldAutoRecoverMicroApp(retryCount, entryUrl) {
    return Number(retryCount || 0) < 1 && String(entryUrl || "").trim().length > 0;
}
