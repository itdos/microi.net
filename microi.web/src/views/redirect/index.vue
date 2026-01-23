<script>
// Vue 3: 需要从 vue 中导入 h 函数
import { h } from "vue";

export default {
    created() {
        const { params, query } = this.$route;
        const { path } = params;
        this.$router.replace({ path: "/" + path, query });
    },
    render() {
        return h("div"); // Vue 3: render 函数需要返回 vnode
    }
};
</script>
