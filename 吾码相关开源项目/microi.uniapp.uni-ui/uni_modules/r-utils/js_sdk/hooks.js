import { getComponentThemeCssVar } from "@/uni_modules/r-theme/js_sdk/index.js";
import { CONFIG_PROVIDER_KEY } from "./constant";
import { inject } from "vue";
export const useComponentThemeStyle = (propThemeName, componentsName) => {
  let themeName = "default";
  const themeInject = inject(CONFIG_PROVIDER_KEY, {});

  if (themeInject?.value?.themeName) {
    //传递过来的有就用传递了
    themeName = themeInject?.value?.themeName;
  }
  if (propThemeName != "default") {
    //单独设置了组件的 就用单独设置的
    themeName = propThemeName;
  }

  return {
    ...getComponentThemeCssVar(themeName, "r-base"),
    ...getComponentThemeCssVar(themeName, componentsName),
  };
};
