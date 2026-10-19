import { getUiDensitySnapshot } from './ui-density.js';

// iframe 不继承宿主 CSS。通过既有主题消息发送可序列化的外观值，
// 菜单页和弹窗复用同一快照，不读取子应用或父窗口的私有 DOM。
export function getMicroAppAppearance(root = document.documentElement) {
    return {
        uiDensity: getUiDensitySnapshot(),
        cornerStyle: root.dataset.mciCornerStyle || 'round',
        disableGradient: root.dataset.mciDisableGradient === 'true',
        disableShadow: root.dataset.mciDisableShadow === 'true',
        disableButtonIcon: root.dataset.mciDisableButtonIcon === 'true',
    };
}
