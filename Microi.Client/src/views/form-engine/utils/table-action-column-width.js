const ACTION_CONTENT = '.diy-table-action-content';
const ACTION_HEADER = '.action-column-settings-trigger';

function pixels(value) {
    return Number.parseFloat(value) || 0;
}

function visible(element, getStyle) {
    return element.getClientRects().length > 0 && getStyle(element).visibility !== 'hidden';
}

function horizontalChrome(element, getStyle) {
    if (!element) return 0;
    const style = getStyle(element);
    return pixels(style.paddingLeft) + pixels(style.paddingRight)
        + pixels(style.borderLeftWidth) + pixels(style.borderRightWidth);
}

function cellChrome(content, getStyle) {
    const cell = content.closest('.cell');
    return horizontalChrome(content, getStyle)
        + horizontalChrome(cell, getStyle)
        + horizontalChrome(content.closest('td, th'), getStyle);
}

function ownElements(root, selector) {
    // 子表可能嵌入同一个组件树；只量本 Element Plus 表格，不能被子表按钮撑宽。
    return [...root.querySelectorAll(selector)].filter(element => element.closest('.el-table') === root);
}

/** 使用已经布局的按钮边界，自动包含字体、密度、图标、间距及角标溢出。 */
export function measureActionColumnWidth(root) {
    const view = root?.ownerDocument?.defaultView;
    if (!view || !root.getClientRects().length) return null;
    const getStyle = element => view.getComputedStyle(element);
    let width = 56;
    for (const content of ownElements(root, ACTION_CONTENT)) {
        if (!visible(content, getStyle)) continue;
        const buttons = [...content.children].filter(element => visible(element, getStyle));
        let left = Infinity;
        let right = -Infinity;
        for (const button of buttons) {
            const rect = button.getBoundingClientRect();
            const style = getStyle(button);
            left = Math.min(left, rect.left - pixels(style.marginLeft));
            right = Math.max(right, rect.right + pixels(style.marginRight));
            for (const badge of button.querySelectorAll('.button-stat-badge')) {
                if (!visible(badge, getStyle)) continue;
                const badgeRect = badge.getBoundingClientRect();
                left = Math.min(left, badgeRect.left);
                right = Math.max(right, badgeRect.right);
            }
        }
        if (buttons.length) width = Math.max(width, right - left + cellChrome(content, getStyle));
    }
    for (const header of ownElements(root, ACTION_HEADER)) {
        if (!visible(header, getStyle)) continue;
        const children = [...header.children].filter(element => visible(element, getStyle));
        let naturalWidth = 0;
        for (const child of children) {
            // 标题是 flex 填充项，量文字 Range 而不是它当前被列宽撑大的盒子，允许翻译切回短文案后收窄。
            const range = root.ownerDocument.createRange();
            range.selectNodeContents(child);
            const textWidth = range.getBoundingClientRect().width;
            range.detach?.();
            const style = getStyle(child);
            naturalWidth += (child.classList.contains('col-header-label') ? textWidth : child.getBoundingClientRect().width)
                + pixels(style.marginLeft) + pixels(style.marginRight);
        }
        naturalWidth += Math.max(0, children.length - 1) * pixels(getStyle(header).columnGap);
        width = Math.max(width, naturalWidth + cellChrome(header, getStyle));
    }
    // 亚像素布局与表格列宽取整采用向上取整，避免最后一像素被固定列裁掉。
    return Math.ceil(width + 1);
}

/** 每个表格只持有一组观察器；所有变化合并到一帧，宽度未变不写 Vue 状态。 */
export function observeActionColumnWidth(root, onWidth) {
    const document = root.ownerDocument;
    const view = document.defaultView;
    let stopped = false;
    let frame = null;
    let lastWidth = null;
    const observed = new Set();
    const schedule = () => {
        if (stopped || frame !== null) return;
        frame = view.requestAnimationFrame(() => {
            frame = null;
            if (stopped) return;
            refreshTargets();
            const width = measureActionColumnWidth(root);
            if (width !== null && width !== lastWidth) {
                lastWidth = width;
                onWidth(width);
            }
        });
    };
    const resizeObserver = view.ResizeObserver ? new view.ResizeObserver(schedule) : null;
    const refreshTargets = () => {
        if (!resizeObserver) return;
        const next = new Set([root, ...ownElements(root,
            `${ACTION_CONTENT} > *, ${ACTION_CONTENT} .button-stat-badge, ${ACTION_HEADER} > *`)]);
        for (const element of observed) {
            if (!next.has(element)) {
                resizeObserver.unobserve(element);
                observed.delete(element);
            }
        }
        for (const element of next) {
            if (!observed.has(element)) {
                observed.add(element);
                resizeObserver.observe(element);
            }
        }
    };
    const mutationObserver = view.MutationObserver ? new view.MutationObserver(schedule) : null;
    mutationObserver?.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    // 密度写在 html token 上，媒体查询 gap 也可能变化；不依赖 Pinia/翻译实现的内部状态。
    mutationObserver?.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-mci-ui-density', 'lang', 'dir'] });
    view.addEventListener('resize', schedule);
    document.fonts?.addEventListener?.('loadingdone', schedule);
    schedule();
    return {
        schedule,
        stop() {
            if (stopped) return;
            stopped = true;
            if (frame !== null) view.cancelAnimationFrame(frame);
            frame = null;
            resizeObserver?.disconnect();
            mutationObserver?.disconnect();
            observed.clear();
            view.removeEventListener('resize', schedule);
            document.fonts?.removeEventListener?.('loadingdone', schedule);
        }
    };
}
