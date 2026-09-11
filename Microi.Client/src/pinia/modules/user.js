// Pinia Store - User
import { defineStore } from "pinia";
import { getToken, setToken, removeToken } from "@/utils/auth.js";
import router, { resetRouter } from "@/router";
import { DiyApi, DiyCommon } from "@/utils/microi.net.import";
import { useTagsViewStore } from "./tagsView";
import { usePermissionStore } from "./permission";
import { useDiyStore } from "./diy";
import { clearMicroAppRuntimeCache } from "@/utils/microAppRuntimeCache.js";
import {
    hasCurrentUserAuthorizationSnapshot,
    isAuthorizationResponseForActiveIdentity,
    markCurrentUserAuthorizationRepairRequired
} from "@/utils/current-user-state.js";

export const useUserStore = defineStore("user", {
    state: () => ({
        token: DiyCommon.getToken(),
        name: "",
        avatar: "",
        introduction: "",
        roles: []
    }),

    actions: {
        setToken(token) {
            this.token = token;
        },

        setIntroduction(introduction) {
            this.introduction = introduction;
        },

        setName(name) {
            this.name = name;
        },

        setAvatar(avatar) {
            this.avatar = avatar;
        },

        setRoles(roles) {
            this.roles = roles;
        },

        async ensureAuthorizationSnapshot(candidateUser) {
            const diyStore = useDiyStore();
            const candidate = candidateUser || {};
            if (hasCurrentUserAuthorizationSnapshot(candidate)) return candidate;

            const previous = diyStore.GetCurrentUser || {};
            // Preserve a same-user last-known-good snapshot for rendering while keeping
            // an explicit repair marker. The marker is cleared only by a clean full
            // authorization response, never by a preference-only user patch.
            diyStore.setCurrentUser(markCurrentUserAuthorizationRepairRequired(candidate));

            const requestToken = DiyCommon.getToken();
            let repairResult;
            try {
                repairResult = await DiyCommon.PostAsync(
                    "/api/SysUser/refreshToken",
                    { authorization: requestToken }
                );
            } catch (error) {
                repairResult = { Code: 0, Msg: error?.message || String(error) };
            }

            if (repairResult
                && Number(repairResult.Code) === 1
                && hasCurrentUserAuthorizationSnapshot(repairResult.Data)
                && isAuthorizationResponseForActiveIdentity(
                    requestToken,
                    DiyCommon.getToken(),
                    repairResult.Data)) {
                return repairResult.Data;
            }

            if ([1001, 1002].includes(Number(repairResult?.Code))) {
                const authError = new Error(repairResult?.Msg || "登录身份已失效，请重新登录。");
                authError.code = Number(repairResult.Code);
                authError.Code = Number(repairResult.Code);
                authError.Msg = authError.message;
                authError.isAuthFailure = true;
                throw authError;
            }

            const fallback = diyStore.GetCurrentUser || {};
            if (hasCurrentUserAuthorizationSnapshot(previous)
                && String(previous.Id || "") === String(candidate.Id || "")
                && String(fallback.Id || "") === String(candidate.Id || "")) {
                // Server-side CRUD authorization remains authoritative. Keeping the
                // prior UI snapshot for one retry window is safer than replacing it
                // with a known technical failure; the repair marker forces a retry.
                return fallback;
            }

            const error = new Error(
                repairResult?.Msg || "用户权限快照刷新失败，请稍后重试。"
            );
            error.code = repairResult?.Code;
            error.Code = repairResult?.Code;
            error.Msg = error.message;
            throw error;
        },

        // get user info
        async getInfo() {
            // 首次身份确认由守卫统一处理失败和登录跳转，重试不能每次都弹全局通知。
            // PostAsync 同时传播业务和传输错误，不留下永久 pending 的初始化 Promise。
            const result = await DiyCommon.PostAsync(DiyApi.GetCurrentUser(), {}, null, null, "json", {
                suppressAuthFailure: true,
                suppressErrorNotification: true
            });
            if (Number(result?.Code) === 1 || result?.Success || result?.IsSuccess) {
                const currentUser = await this.ensureAuthorizationSnapshot(result.Data || {});
                this.setRoles(currentUser._AccessKeySession === true ? ["access-key"] : ["admin"]);
                this.setName("");
                this.setAvatar("");
                this.setIntroduction("");
                useDiyStore().setCurrentUser(currentUser);
                return currentUser;
            }
            const error = new Error(result?.Msg || result?.Message || "获取当前登录身份失败。");
            error.code = result?.Code;
            error.Code = result?.Code;
            error.Msg = result?.Msg || result?.Message || error.message;
            error.DataAppend = result?.DataAppend;
            error.isAuthFailure = [1001, 1002].includes(Number(result?.Code));
            throw error;
        },

        // user logout
        async logout() {
            // 先让后端吊销当前终端并记录本次登录时长；即使网络异常也必须继续清理本地登录态。
            try {
                await DiyCommon.PostAsync(DiyApi.Logout(), {}, null, null, "json");
            } catch (e) {}
            await clearMicroAppRuntimeCache("logout");
            return new Promise((resolve) => {
                this.setToken("");
                this.setRoles([]);
                removeToken();
                DiyCommon.removeToken();
                resetRouter();

                const permissionStore = usePermissionStore();
                permissionStore.resetRoutes();

                const diyStore = useDiyStore();
                diyStore.setCurrentUser({});
                diyStore.removeToken();
                diyStore.setTokenExpires("");

                // reset visited views and cached views
                const tagsViewStore = useTagsViewStore();
                tagsViewStore.delAllViews();

                resolve();
            });
        },

        // remove token
        async resetToken() {
            await clearMicroAppRuntimeCache("token-reset");
            return new Promise((resolve) => {
                this.setToken("");
                this.setRoles([]);
                removeToken();
                DiyCommon.removeToken();
                resetRouter();

                const permissionStore = usePermissionStore();
                permissionStore.resetRoutes();

                const diyStore = useDiyStore();
                diyStore.setCurrentUser({});
                diyStore.removeToken();
                diyStore.setTokenExpires("");
                resolve();
            });
        },

        // dynamically modify permissions
        async changeRoles(role) {
            await clearMicroAppRuntimeCache("role-change");
            const token = role + "-token";

            this.setToken(token);
            setToken(token);
            DiyCommon.setToken(token);

            const { roles } = await this.getInfo();

            resetRouter();

            // generate accessible routes map based on roles
            const permissionStore = usePermissionStore();
            const accessRoutes = await permissionStore.generateRoutes(["admin"]);

            // dynamically add accessible routes
            accessRoutes.forEach((route) => {
                router.addRoute(route);
            });

            // reset visited views and cached views
            const tagsViewStore = useTagsViewStore();
            tagsViewStore.delAllViews();
        }
    }
});
