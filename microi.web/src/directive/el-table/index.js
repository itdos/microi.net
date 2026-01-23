import adaptive from "./adaptive";

// Vue 3 兼容：app.use() 会传入 app 实例
const install = function (app) {
    app.directive("el-height-adaptive-table", adaptive);
};

adaptive.install = install;
export default adaptive;
