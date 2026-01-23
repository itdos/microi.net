import waves from "./waves";

// Vue 3 兼容：app.use() 会传入 app 实例
const install = function (app) {
    app.directive("waves", waves);
};

waves.install = install;
export default waves;
