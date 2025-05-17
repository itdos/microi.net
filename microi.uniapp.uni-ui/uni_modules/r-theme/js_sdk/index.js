import { ref } from "vue";
import baseData from "./theme/default/modules/base";

const files = import.meta.glob("./theme/*/index.js", { eager: true });
const datas = ref(
  (() =>
    Object.keys(files).reduce(
      (pre, key) => ({ ...pre, [key]: files[key].default?.value }),
      []
    ))()
);

export const getThemeCssVar = (name = "default") => {
  const useTheme =
    datas.value[Object.keys(datas.value).find((m) => m.indexOf(name) >= 0)];

  let cssVar = {};
  if (useTheme) {
    let keys = Object.keys(useTheme);

    keys.forEach((t) => {
      cssVar[`--${t}`] = useTheme[t];
    });
  }
  console.log("datas getThemeCssVar", datas.value, cssVar);
  return cssVar;
};

export const getComponentThemeCssVar = (
  themeName = "default",
  componentName
) => {
  const useTheme =
    datas.value[
      Object.keys(datas.value).find((m) => m.indexOf(themeName) >= 0)
    ];

  let cssVar = {};
  if (componentName != "r-base") {
    let keys = Object.keys(useTheme).filter(
      (m) => m.indexOf(componentName) >= 0
    );

    keys.forEach((t) => {
      cssVar[`--${t}`] = useTheme[t];
    });
  } else {
    let keys = Object.keys(useTheme).filter((m) =>
      Object.keys(baseData.value).some((t) => t == m)
    );

    keys.forEach((t) => {
      cssVar[`--${t}`] = useTheme[t];
    });
  }

  return cssVar;
};
