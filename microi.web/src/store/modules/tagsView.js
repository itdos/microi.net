// 最大缓存页面数量，防止 keep-alive 缓存过多导致内存泄漏
const MAX_CACHED_VIEWS = 15;
// 最大访问记录数量
const MAX_VISITED_VIEWS = 20;

const state = {
    visitedViews: [],
    cachedViews: []
};

const mutations = {
    ADD_VISITED_VIEW: (state, view) => {
        if (state.visitedViews.some((v) => v.fullPath === view.fullPath)) return;
        // 如果超过最大数量，移除最早的非固定标签
        if (state.visitedViews.length >= MAX_VISITED_VIEWS) {
            const oldestNonAffix = state.visitedViews.find((v) => !v.meta.affix);
            if (oldestNonAffix) {
                const index = state.visitedViews.indexOf(oldestNonAffix);
                state.visitedViews.splice(index, 1);
            }
        }
        state.visitedViews.push(
            Object.assign({}, view, {
                title: view.meta.title || "no-name"
            })
        );
    },
    ADD_CACHED_VIEW: (state, view) => {
        if (state.cachedViews.includes(view.name)) return;
        if (!view.meta.noCache) {
            // 如果超过最大缓存数量，移除最早缓存的页面
            if (state.cachedViews.length >= MAX_CACHED_VIEWS) {
                state.cachedViews.shift();
            }
            state.cachedViews.push(view.name);
        }
    },

    DEL_VISITED_VIEW: (state, view) => {
        for (const [i, v] of state.visitedViews.entries()) {
            if (v.fullPath === view.fullPath) {
                state.visitedViews.splice(i, 1);
                break;
            }
        }
    },
    DEL_CACHED_VIEW: (state, view) => {
        const index = state.cachedViews.indexOf(view.name);
        index > -1 && state.cachedViews.splice(index, 1);
    },

    DEL_OTHERS_VISITED_VIEWS: (state, view) => {
        state.visitedViews = state.visitedViews.filter((v) => {
            return v.meta.affix || v.fullPath === view.fullPath;
        });
    },
    DEL_OTHERS_CACHED_VIEWS: (state, view) => {
        const index = state.cachedViews.indexOf(view.name);
        if (index > -1) {
            state.cachedViews = state.cachedViews.slice(index, index + 1);
        } else {
            // if index = -1, there is no cached tags
            state.cachedViews = [];
        }
    },

    DEL_ALL_VISITED_VIEWS: (state) => {
        // keep affix tags
        const affixTags = state.visitedViews.filter((tag) => tag.meta.affix);
        state.visitedViews = affixTags;
    },
    DEL_ALL_CACHED_VIEWS: (state) => {
        state.cachedViews = [];
    },

    UPDATE_VISITED_VIEW: (state, view) => {
        for (let v of state.visitedViews) {
            if (v.fullPath === view.fullPath) {
                v = Object.assign(v, view);
                break;
            }
        }
    }
};

const actions = {
    addView({ dispatch }, view) {
        dispatch("addVisitedView", view);
        dispatch("addCachedView", view);
    },
    addVisitedView({ commit }, view) {
        commit("ADD_VISITED_VIEW", view);
    },
    addCachedView({ commit }, view) {
        commit("ADD_CACHED_VIEW", view);
    },

    delView({ dispatch, state }, view) {
        return new Promise((resolve) => {
            dispatch("delVisitedView", view);
            dispatch("delCachedView", view);
            resolve({
                visitedViews: [...state.visitedViews],
                cachedViews: [...state.cachedViews]
            });
        });
    },
    delVisitedView({ commit, state }, view) {
        return new Promise((resolve) => {
            commit("DEL_VISITED_VIEW", view);
            resolve([...state.visitedViews]);
        });
    },
    delCachedView({ commit, state }, view) {
        return new Promise((resolve) => {
            commit("DEL_CACHED_VIEW", view);
            resolve([...state.cachedViews]);
        });
    },

    delOthersViews({ dispatch, state }, view) {
        return new Promise((resolve) => {
            dispatch("delOthersVisitedViews", view);
            dispatch("delOthersCachedViews", view);
            resolve({
                visitedViews: [...state.visitedViews],
                cachedViews: [...state.cachedViews]
            });
        });
    },
    delOthersVisitedViews({ commit, state }, view) {
        return new Promise((resolve) => {
            commit("DEL_OTHERS_VISITED_VIEWS", view);
            resolve([...state.visitedViews]);
        });
    },
    delOthersCachedViews({ commit, state }, view) {
        return new Promise((resolve) => {
            commit("DEL_OTHERS_CACHED_VIEWS", view);
            resolve([...state.cachedViews]);
        });
    },

    delAllViews({ dispatch, state }, view) {
        return new Promise((resolve) => {
            dispatch("delAllVisitedViews", view);
            dispatch("delAllCachedViews", view);
            resolve({
                visitedViews: [...state.visitedViews],
                cachedViews: [...state.cachedViews]
            });
        });
    },
    delAllVisitedViews({ commit, state }) {
        return new Promise((resolve) => {
            commit("DEL_ALL_VISITED_VIEWS");
            resolve([...state.visitedViews]);
        });
    },
    delAllCachedViews({ commit, state }) {
        return new Promise((resolve) => {
            commit("DEL_ALL_CACHED_VIEWS");
            resolve([...state.cachedViews]);
        });
    },

    updateVisitedView({ commit }, view) {
        commit("UPDATE_VISITED_VIEW", view);
    }
};

export default {
    namespaced: true,
    state,
    mutations,
    actions
};
