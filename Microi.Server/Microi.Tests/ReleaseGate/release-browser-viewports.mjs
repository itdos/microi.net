// 默认覆盖常规笔记本与桌面；4K 仅是明确选择后追加的专项，不能替代常规桌面。
export function releaseBrowserWidths(environment = process.env) {
 const selected = environment.MICROI_TEST_BROWSER_4K;
 if (![undefined, '', '0', '1'].includes(selected)) throw Error('MICROI_TEST_BROWSER_4K 必须为 0 或 1');
 return selected === '1' ? [1366, 1920, 3840] : [1366, 1920];
}
