// 从 SCSS 变量导出给 JavaScript 使用
// 这些值需要与 variables.scss 中的值保持同步

const variables = {
    menuText: "#fff",
    menuActiveText: "var(--color-primary, #409eff)",
    subMenuActiveText: "var(--color-primary, #409eff)",
    menuBg: "transparent",
    menuHover: "var(--color-primary, #409eff)",
    subMenuBg: "transparent",
    subMenuHover: "var(--color-primary, #409eff)",
    sideBarWidth: "240px"
};

export default variables;
