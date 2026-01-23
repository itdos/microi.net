export default {
    // Vue 3: mounted 替代 bind
    mounted(el, binding, vnode) {
        // Vue 3 + Element Plus: el-dialog 使用 Teleport，需要延迟查找 DOM
        // 因为 Teleport 会在 mounted 之后才渲染内容到 body
        setTimeout(() => {
            initDrag(el, binding, vnode);
        }, 100);
    },
    // Vue 3: updated 用于处理 dialog 显示/隐藏
    updated(el, binding, vnode) {
        setTimeout(() => {
            initDrag(el, binding, vnode);
        }, 100);
    }
};

function initDrag(el, binding, vnode) {
    // 尝试在 el 内部查找，或者在 body 中查找最近打开的 dialog
    let dialogHeaderEl = el.querySelector(".el-dialog__header");
    let dragDom = el.querySelector(".el-dialog");

    // 如果在 el 内找不到（因为 Teleport），尝试从 body 查找
    if (!dialogHeaderEl || !dragDom) {
        // Element Plus dialog 会 teleport 到 body，查找 body 下的 dialog
        const dialogs = document.querySelectorAll(".el-dialog");
        if (dialogs.length > 0) {
            // 获取最后一个（最新打开的）dialog
            dragDom = dialogs[dialogs.length - 1];
            dialogHeaderEl = dragDom.querySelector(".el-dialog__header");
        }
    }

    if (!dialogHeaderEl || !dragDom) {
        return;
    }

    // 避免重复绑定
    if (dialogHeaderEl.dataset.dragBound === "true") {
        return;
    }
    dialogHeaderEl.dataset.dragBound = "true";

    dialogHeaderEl.style.cssText += ";cursor:move;";
    dragDom.style.cssText += ";top:0px;";

    // 获取原有属性 ie dom元素.currentStyle 火狐谷歌 window.getComputedStyle(dom元素, null);
    const getStyle = (function () {
        if (window.document.currentStyle) {
            return (dom, attr) => dom.currentStyle[attr];
        } else {
            return (dom, attr) => getComputedStyle(dom, false)[attr];
        }
    })();

    dialogHeaderEl.onmousedown = (e) => {
        // 鼠标按下，计算当前元素距离可视区的距离
        const disX = e.clientX - dialogHeaderEl.offsetLeft;
        const disY = e.clientY - dialogHeaderEl.offsetTop;

        const dragDomWidth = dragDom.offsetWidth;
        const dragDomHeight = dragDom.offsetHeight;

        const screenWidth = document.body.clientWidth;
        const screenHeight = document.body.clientHeight;

        const minDragDomLeft = dragDom.offsetLeft;
        const maxDragDomLeft = screenWidth - dragDom.offsetLeft - dragDomWidth;

        const minDragDomTop = dragDom.offsetTop;
        const maxDragDomTop = screenHeight - dragDom.offsetTop - dragDomHeight;

        // 获取到的值带px 正则匹配替换
        let styL = getStyle(dragDom, "left");
        let styT = getStyle(dragDom, "top");

        if (styL.includes("%")) {
            styL = +document.body.clientWidth * (+styL.replace(/\%/g, "") / 100);
            styT = +document.body.clientHeight * (+styT.replace(/\%/g, "") / 100);
        } else {
            styL = +styL.replace(/\px/g, "");
            styT = +styT.replace(/\px/g, "");
        }

        document.onmousemove = function (e) {
            // 通过事件委托，计算移动的距离
            let left = e.clientX - disX;
            let top = e.clientY - disY;

            // 边界处理
            if (-left > minDragDomLeft) {
                left = -minDragDomLeft;
            } else if (left > maxDragDomLeft) {
                left = maxDragDomLeft;
            }

            if (-top > minDragDomTop) {
                top = -minDragDomTop;
            } else if (top > maxDragDomTop) {
                top = maxDragDomTop;
            }

            // 移动当前元素
            dragDom.style.cssText += `;left:${left + styL}px;top:${top + styT}px;`;

            // Vue 3: 使用自定义事件替代 vnode.child.$emit
            // 如果需要触发事件，可以通过 el 触发自定义事件
            el.dispatchEvent(new CustomEvent("dragDialog"));
        };

        document.onmouseup = function (e) {
            document.onmousemove = null;
            document.onmouseup = null;
        };
    };
}
