// Pinia Store - Tags View
import { defineStore } from "pinia";

// 最大缓存页面数量，防止 keep-alive 缓存过多导致内存泄漏
const MAX_CACHED_VIEWS = 15;
// 最大访问记录数量
const MAX_VISITED_VIEWS = 20;

export const useTagsViewStore = defineStore("tagsView", {
    state: () => ({
        visitedViews: [],
        cachedViews: []
    }),

    actions: {
        addVisitedView(view) {
            if (this.visitedViews.some((v) => v.fullPath === view.fullPath)) return;
            // 如果超过最大数量，移除最早的非固定标签
            if (this.visitedViews.length >= MAX_VISITED_VIEWS) {
                const oldestNonAffix = this.visitedViews.find((v) => !v.meta?.affix);
                if (oldestNonAffix) {
                    const index = this.visitedViews.indexOf(oldestNonAffix);
                    this.visitedViews.splice(index, 1);
                }
            }
            this.visitedViews.push(
                Object.assign({}, view, {
                    title: view.meta?.title || "no-name"
                })
            );
        },

        addCachedView(view) {
            if (this.cachedViews.includes(view.name)) return;
            if (!view.meta?.noCache) {
                // 如果超过最大缓存数量，移除最早缓存的页面
                if (this.cachedViews.length >= MAX_CACHED_VIEWS) {
                    this.cachedViews.shift();
                }
                this.cachedViews.push(view.name);
            }
        },

        addView(view) {
            this.addVisitedView(view);
            this.addCachedView(view);
        },

        delVisitedView(view) {
            return new Promise((resolve) => {
                for (const [i, v] of this.visitedViews.entries()) {
                    if (v.fullPath === view.fullPath) {
                        this.visitedViews.splice(i, 1);
                        break;
                    }
                }
                resolve([...this.visitedViews]);
            });
        },

        delCachedView(view) {
            return new Promise((resolve) => {
                const index = this.cachedViews.indexOf(view.name);
                index > -1 && this.cachedViews.splice(index, 1);
                resolve([...this.cachedViews]);
            });
        },

        delView(view) {
            return new Promise((resolve) => {
                this.delVisitedView(view);
                this.delCachedView(view);
                resolve({
                    visitedViews: [...this.visitedViews],
                    cachedViews: [...this.cachedViews]
                });
            });
        },

        delOthersVisitedViews(view) {
            return new Promise((resolve) => {
                this.visitedViews = this.visitedViews.filter((v) => {
                    return v.meta?.affix || v.fullPath === view.fullPath;
                });
                resolve([...this.visitedViews]);
            });
        },

        delOthersCachedViews(view) {
            return new Promise((resolve) => {
                const index = this.cachedViews.indexOf(view.name);
                if (index > -1) {
                    this.cachedViews = this.cachedViews.slice(index, index + 1);
                } else {
                    this.cachedViews = [];
                }
                resolve([...this.cachedViews]);
            });
        },

        delOthersViews(view) {
            return new Promise((resolve) => {
                this.delOthersVisitedViews(view);
                this.delOthersCachedViews(view);
                resolve({
                    visitedViews: [...this.visitedViews],
                    cachedViews: [...this.cachedViews]
                });
            });
        },

        delAllVisitedViews() {
            return new Promise((resolve) => {
                // keep affix tags
                const affixTags = this.visitedViews.filter((tag) => tag.meta?.affix);
                this.visitedViews = affixTags;
                resolve([...this.visitedViews]);
            });
        },

        delAllCachedViews() {
            return new Promise((resolve) => {
                this.cachedViews = [];
                resolve([...this.cachedViews]);
            });
        },

        delAllViews(view) {
            return new Promise((resolve) => {
                this.delAllVisitedViews();
                this.delAllCachedViews();
                resolve({
                    visitedViews: [...this.visitedViews],
                    cachedViews: [...this.cachedViews]
                });
            });
        },

        updateVisitedView(view) {
            for (let v of this.visitedViews) {
                if (v.fullPath === view.fullPath) {
                    v = Object.assign(v, view);
                    break;
                }
            }
        }
    }
});
