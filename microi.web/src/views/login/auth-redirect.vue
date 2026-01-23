<script>
// Vue 3: 需要从 vue 中导入 h 函数
import { h } from "vue";

export default {
    name: "AuthRedirect",
    created() {
        const hash = window.location.search.slice(1);
        if (window.localStorage) {
            window.localStorage.setItem("x-admin-oauth-code", hash);
            window.close();
        }
    },
    render() {
        return h("div"); // Vue 3: render 函数需要返回 vnode
    }
};
</script>
