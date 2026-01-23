import permission from "./permission";

// Vue 3 兼容：app.use() 会传入 app 实例
const install = function (app) {
    app.directive("permission", permission);
};

permission.install = install;
export default permission;
