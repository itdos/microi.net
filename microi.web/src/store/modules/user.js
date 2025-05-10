import { login, logout, getInfo } from "@/api/user";
import { getToken, setToken, removeToken } from "@/utils/auth.js";
import router, { resetRouter } from "@/router";
import { DiyApi, DiyCommon } from "@/utils/microi.net.import";
const state = {
  token: () => DiyCommon.getToken(),
  name: "",
  avatar: "",
  introduction: "",
  roles: []
};

const mutations = {
  SET_TOKEN: (state, token) => {
    state.token = token;
  },
  SET_INTRODUCTION: (state, introduction) => {
    state.introduction = introduction;
  },
  SET_NAME: (state, name) => {
    state.name = name;
  },
  SET_AVATAR: (state, avatar) => {
    state.avatar = avatar;
  },
  SET_ROLES: (state, roles) => {
    state.roles = roles;
  }
};

const actions = {
  // user login
  login({ commit }, userInfo) {
    const { username, password } = userInfo;
    return new Promise((resolve, reject) => {
      login({ username: username.trim(), password: password })
        .then((response) => {
          const { data } = response;
          commit("SET_TOKEN", data.token);
          setToken(data.token);
          DiyCommon.setToken(data.token);
          resolve();
        })
        .catch((error) => {
          reject(error);
        });
    });
  },

  // get user info
  getInfo({ commit, state }) {
    return new Promise((resolve, reject) => {
      DiyCommon.Post(DiyApi.GetCurrentUser(), {}, function (result) {
        if (DiyCommon.Result(result)) {
          const { roles, name, avatar, introduction } = result.Data;
          //注：服务器端不再返回这些东西，直接写死  by itdos.com
          // commit('SET_ROLES', roles)
          // commit('SET_NAME', name)
          // commit('SET_AVATAR', avatar)
          // commit('SET_INTRODUCTION', introduction)

          commit("SET_ROLES", ["admin"]);
          commit("SET_NAME", "");
          commit("SET_AVATAR", "");
          commit("SET_INTRODUCTION", "");
          resolve(result.Data);
        } else {
          reject(result.Msg);
        }
      });

      // getInfo(state.token).then(response => {
      //     const { data } = response

      //     if (!data) {
      //         reject('Verification failed, please Login again.')
      //     }

      //     const { roles, name, avatar, introduction } = data

      //     // roles must be a non-empty array
      //     if (!roles || roles.length <= 0) {
      //         reject('getInfo: roles must be a non-null array!')
      //     }

      //     commit('SET_ROLES', roles)
      //     commit('SET_NAME', name)
      //     commit('SET_AVATAR', avatar)
      //     commit('SET_INTRODUCTION', introduction)
      //     resolve(data)
      // }).catch(error => {
      //     reject(error)
      // })
    });
  },

  // user logout
  logout({ commit, state, dispatch }) {
    return new Promise((resolve, reject) => {
      // logout(state.token).then(() => {
      commit("SET_TOKEN", "");
      commit("SET_ROLES", []);
      removeToken();
      DiyCommon.removeToken();
      resetRouter();

      // reset visited views and cached views
      dispatch("tagsView/delAllViews", null, { root: true });

      resolve();
      // }).catch(error => {
      //     reject(error)
      // })
    });
  },

  // remove token
  resetToken({ commit }) {
    return new Promise((resolve) => {
      commit("SET_TOKEN", "");
      commit("SET_ROLES", []);
      removeToken();
      DiyCommon.removeToken();
      resetRouter(); //  by itdos.com 新增
      resolve();
    });
  },

  // dynamically modify permissions
  async changeRoles({ commit, dispatch }, role) {
    const token = role + "-token";

    commit("SET_TOKEN", token);
    setToken(token);
    DiyCommon.setToken(token);

    const { roles } = await dispatch("getInfo");

    resetRouter();

    // generate accessible routes map based on roles
    // const accessRoutes = await dispatch('permission/generateRoutes', roles, { root: true })
    const accessRoutes = await dispatch(
      "permission/generateRoutes",
      ["admin"],
      { root: true }
    );
    // dynamically add accessible routes
    router.addRoutes(accessRoutes);

    // reset visited views and cached views
    dispatch("tagsView/delAllViews", null, { root: true });
  }
};

export default {
  namespaced: true,
  state,
  mutations,
  actions
};
