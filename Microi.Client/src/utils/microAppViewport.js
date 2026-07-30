export function resolveMicroAppHostViewport(rect = {}, visualViewport, fallbackViewportHeight = 0) {
    const width = Math.max(0, Number(rect.width) || 0);
    const measuredHeight = Math.max(0, Number(rect.height) || 0);
    const viewportTop = Math.max(0, Number(visualViewport?.offsetTop) || 0);
    const viewportHeight = Math.max(
        0,
        Number(visualViewport?.height) || Number(fallbackViewportHeight) || measuredHeight
    );
    const viewportBottom = viewportTop + viewportHeight;
    const hostTop = Math.max(viewportTop, Number(rect.top) || 0);
    const availableHeight = Math.max(0, viewportBottom - hostTop);

    return {
        width: Math.round(width),
        height: Math.round(availableHeight > 0 ? availableHeight : measuredHeight),
        safeAreaBottom: 0
    };
}
