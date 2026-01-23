import LazySlideCaptcha from "./index.vue";

/* istanbul ignore next */
// Vue 3: 参数从 Vue 改为 app (createApp 返回值)
LazySlideCaptcha.install = function (app) {
    app.component(LazySlideCaptcha.name, LazySlideCaptcha);
};

export default LazySlideCaptcha;
