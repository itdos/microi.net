export default {
    methods: {
LoadFabPosition() {
            try {
                var raw = localStorage.getItem('microi_fab_position_form');
                if (raw) {
                    var pos = JSON.parse(raw);
                    if (pos && typeof pos.right == 'number' && typeof pos.bottom == 'number') {
                        this.fabPosition = this.ClampFabPosition(pos.right, pos.bottom);
                    }
                }
            } catch (e) { /* ignore */ }
        },
SaveFabPosition() {
            try {
                if (this.fabPosition) {
                    localStorage.setItem('microi_fab_position_form', JSON.stringify(this.fabPosition));
                }
            } catch (e) { /* ignore */ }
        },
GetFabContainerStyle() {
            if (this.fabPosition) {
                return { right: this.fabPosition.right + 'px', bottom: this.fabPosition.bottom + 'px' };
            }
            return {};
        },
ClampFabPosition(right, bottom, btnSize) {
            var size = btnSize || 54;
            var minMargin = 8;
            // 底部保留：兼顾底部操作条 + 底部安全区
            var bottomBarEl = document.querySelector('.mobile-form-bottom-bar');
            var bottomReserved = bottomBarEl && bottomBarEl.offsetHeight ? (bottomBarEl.offsetHeight + 8) : minMargin;
            var topReserved = 60; // 顶部导航预留
            var maxRight = Math.max(minMargin, window.innerWidth - size - minMargin);
            var maxBottom = Math.max(bottomReserved, window.innerHeight - size - topReserved);
            return {
                right: Math.max(minMargin, Math.min(maxRight, right)),
                bottom: Math.max(bottomReserved, Math.min(maxBottom, bottom))
            };
        },
OnFabPointerDown(e) {
            var self = this;
            var isTouch = e.type === 'touchstart';
            if (!isTouch && e.button !== 0) return;
            var pt = isTouch ? e.touches[0] : e;
            var startX = pt.clientX, startY = pt.clientY;
            var btnEl = e.currentTarget;
            var containerEl = btnEl.closest('.mobile-fab-container');
            if (!containerEl) return;
            var rect = btnEl.getBoundingClientRect();
            var btnW = rect.width, btnH = rect.height;
            var startRight = window.innerWidth - rect.right;
            var startBottom = window.innerHeight - rect.bottom;
            var moved = false;
            var threshold = 5;
            var minMargin = 8;
            var bottomBarEl = document.querySelector('.mobile-form-bottom-bar');
            var bottomReserved = bottomBarEl && bottomBarEl.offsetHeight ? (bottomBarEl.offsetHeight + 8) : minMargin;
            var topReserved = 60;
            var maxRight = window.innerWidth - btnW - minMargin;
            var maxBottom = window.innerHeight - btnH - topReserved;
            var lastRight = startRight, lastBottom = startBottom;
            var rafId = null;

            var applyDom = function() {
                rafId = null;
                containerEl.style.right = lastRight + 'px';
                containerEl.style.bottom = lastBottom + 'px';
            };
            var moveHandler = function(ev) {
                var p = isTouch ? (ev.touches[0] || ev.changedTouches[0]) : ev;
                if (!p) return;
                var dx = p.clientX - startX;
                var dy = p.clientY - startY;
                if (!moved && Math.hypot(dx, dy) > threshold) moved = true;
                if (moved) {
                    lastRight = Math.max(minMargin, Math.min(maxRight, startRight - dx));
                    lastBottom = Math.max(bottomReserved, Math.min(maxBottom, startBottom - dy));
                    if (rafId == null) rafId = requestAnimationFrame(applyDom);
                    if (ev.cancelable) ev.preventDefault();
                }
            };
            var upHandler = function() {
                if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
                if (isTouch) {
                    document.removeEventListener('touchmove', moveHandler, { passive: false });
                    document.removeEventListener('touchend', upHandler);
                    document.removeEventListener('touchcancel', upHandler);
                } else {
                    document.removeEventListener('mousemove', moveHandler);
                    document.removeEventListener('mouseup', upHandler);
                }
                if (moved) {
                    self._fabDragJustMoved = true;
                    self.fabPosition = { right: lastRight, bottom: lastBottom };
                    self.SaveFabPosition();
                    setTimeout(function() { self._fabDragJustMoved = false; }, 50);
                }
            };
            if (isTouch) {
                document.addEventListener('touchmove', moveHandler, { passive: false });
                document.addEventListener('touchend', upHandler);
                document.addEventListener('touchcancel', upHandler);
            } else {
                document.addEventListener('mousemove', moveHandler);
                document.addEventListener('mouseup', upHandler);
            }
        },
OnFabClick() {
            if (this._fabDragJustMoved) return;
            this.showMobileFabMenu = !this.showMobileFabMenu;
        },
    }
};
