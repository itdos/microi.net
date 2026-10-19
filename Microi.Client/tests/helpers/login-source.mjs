import { readFileSync } from "node:fs";

// 保留原有登录契约断言：模板与共享业务迁移后仍作为同一个实际入口检查。
export function readLoginSourceSync() {
    const component = readFileSync(new URL("../../src/views/login/index.vue", import.meta.url), "utf8");
    const business = readFileSync(new URL("../../src/views/login/login-business.mixin.js", import.meta.url), "utf8");
    return component.replace(/<script>[\s\S]*?<\/script>/, () => `<script>\n${business}\n</script>`);
}
