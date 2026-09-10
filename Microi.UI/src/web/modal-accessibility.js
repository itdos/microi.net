// 多层弹窗共用一个焦点栈；最上层独占交互，关闭时逐级恢复，不改变原本已 inert 的宿主区域。
const stack = [];
const originalInert = new Map();
let originalOverflow = '';
const selectors = 'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
const focusables = panel => [...panel.querySelectorAll(selectors)].filter(node => node.getClientRects().length && !node.closest('[inert]'));
function syncLayers() {
  const top = stack.at(-1);
  for (const child of document.body.children) {
    if (!originalInert.has(child)) originalInert.set(child, child.inert);
    child.inert = !!top && !child.contains(top.dialog);
  }
  if (!top) {
    for (const [element, inert] of originalInert) element.inert = inert;
    originalInert.clear(); document.body.style.overflow = originalOverflow;
  }
}
function keydown(event) {
  const active = stack.at(-1); if (!active) return;
  if (event.key === 'Escape' && active.closeOnEscape()) { event.preventDefault(); event.stopPropagation(); active.close(); return; }
  if (event.key !== 'Tab') return;
  const nodes = focusables(active.panel), index = nodes.indexOf(document.activeElement);
  if (!nodes.length) { event.preventDefault(); active.panel.focus(); }
  else if (event.shiftKey && index <= 0) { event.preventDefault(); nodes.at(-1).focus(); }
  else if (!event.shiftKey && (index === nodes.length - 1 || index === -1)) { event.preventDefault(); nodes[0].focus(); }
}
export function activateMciDialog(dialog, panel, header, options) {
  const previous = document.activeElement;
  const entry = { dialog, panel, close: options.close, closeOnEscape: options.closeOnEscape };
  if (!stack.length) { originalOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; document.addEventListener('keydown', keydown, true); }
  stack.push(entry); syncLayers();
  const initial = panel.querySelector('[autofocus],input:not([disabled]),textarea:not([disabled]),select:not([disabled])') || focusables(panel)[0] || panel;
  initial.focus({ preventScroll: true });
  let drag = null, moved = false, x = 0, y = 0;
  const reposition = (left, top) => {
    const rect = panel.getBoundingClientRect();
    const actualLeft = Math.max(16, Math.min(innerWidth - rect.width - 16, left));
    const actualTop = Math.max(16, Math.min(innerHeight - rect.height - 16, top));
    x = actualLeft - (innerWidth - rect.width) / 2; y = actualTop - (innerHeight - rect.height) / 2;
    panel.style.animation = 'none'; panel.style.transform = `translate(${x}px, ${y}px)`;
  };
  const down = event => {
    if (!options.draggable() || innerWidth <= 600 || event.button !== 0 || event.target.closest('button,a,input,select,textarea')) return;
    const rect = panel.getBoundingClientRect(); drag = { id:event.pointerId, left:rect.left, top:rect.top, x:event.clientX, y:event.clientY };
    header.setPointerCapture(event.pointerId); event.preventDefault();
  };
  const move = event => { if (drag?.id === event.pointerId) { moved = true; reposition(drag.left + event.clientX - drag.x, drag.top + event.clientY - drag.y); } };
  const up = event => { if (drag?.id === event.pointerId) { if (header.hasPointerCapture(event.pointerId)) header.releasePointerCapture(event.pointerId); drag = null; } };
  const resize = () => { if (moved) { const rect = panel.getBoundingClientRect(); reposition((innerWidth - rect.width) / 2 + x, (innerHeight - rect.height) / 2 + y); } };
  header?.addEventListener('pointerdown',down); header?.addEventListener('pointermove',move); header?.addEventListener('pointerup',up); header?.addEventListener('pointercancel',up); window.addEventListener('resize',resize);
  const observer = new ResizeObserver(resize); observer.observe(panel);
  return () => {
    header?.removeEventListener('pointerdown',down); header?.removeEventListener('pointermove',move); header?.removeEventListener('pointerup',up); header?.removeEventListener('pointercancel',up); window.removeEventListener('resize',resize); observer.disconnect();
    const index = stack.indexOf(entry); if (index >= 0) stack.splice(index,1);
    syncLayers(); if (!stack.length) document.removeEventListener('keydown',keydown,true);
    if (previous?.isConnected && !previous.closest('[inert]')) previous.focus({ preventScroll:true });
    else stack.at(-1)?.panel.focus({ preventScroll:true });
  };
}
