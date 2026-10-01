// Older workflow rows may contain unitless coordinates or no coordinates at all.
// Keep stored values intact; give every node a usable position while rendering.
export function workflowNodePosition(node, index = 0) {
    const pixel = (value, fallback) => {
        const text = String(value ?? "").trim();
        return /^(?:\d+(?:\.\d+)?)(?:px)?$/.test(text) ? `${parseFloat(text)}px` : `${fallback}px`;
    };
    return {
        left: pixel(node?.PositionLeft, 80 + index * 240),
        top: pixel(node?.PositionTop, 160)
    };
}
