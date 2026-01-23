import Clipboard from "./clipboard";

// Vue 3 兼容：app.use() 会传入 app 实例
const install = function (app) {
    app.directive("Clipboard", Clipboard);
};

Clipboard.install = install;
export default Clipboard;
