// Pinia Store - User
import { defineStore } from "pinia";
import { getToken, setToken, removeToken } from "@/utils/auth.js";
import router, { resetRouter } from "@/router";
import { DiyApi, DiyCommon } from "@/utils/microi.net.import";
import { useTagsViewStore } from "./tagsView";
import { usePermissionStore } from "./permission";

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

        // get user info
        getInfo() {
            return new Promise((resolve, reject) => {
                DiyCommon.Post(DiyApi.GetCurrentUser(), {}, (result) => {
                    if (DiyCommon.Result(result)) {
                        // 服务器端不再返回这些东西，直接写死  by itdos.com
                        this.setRoles(["admin"]);
                        this.setName("");
                        this.setAvatar("");
                        this.setIntroduction("");
                        resolve(result.Data);
                    } else {
                        reject(result.Msg);
                    }
                });
            });
        },

        // user logout
        logout() {
            return new Promise((resolve) => {
                this.setToken("");
                this.setRoles([]);
                removeToken();
                DiyCommon.removeToken();
                resetRouter();

                // reset visited views and cached views
                const tagsViewStore = useTagsViewStore();
                tagsViewStore.delAllViews();

                resolve();
            });
        },

        // remove token
        resetToken() {
            return new Promise((resolve) => {
                this.setToken("");
                this.setRoles([]);
                removeToken();
                DiyCommon.removeToken();
                resetRouter();
                resolve();
            });
        },

        // dynamically modify permissions
        async changeRoles(role) {
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
