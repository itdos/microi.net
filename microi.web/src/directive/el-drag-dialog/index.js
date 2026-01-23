import drag from "./drag";

// Vue 3 兼容：app.use() 会传入 app 实例
const install = function (app) {
    app.directive("el-drag-dialog", drag);
};

drag.install = install;
export default drag;
