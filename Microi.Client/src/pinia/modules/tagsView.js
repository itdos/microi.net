// Pinia Store - Tags View
import { defineStore } from "pinia";
import { releaseMicroAppRuntimeCacheForView } from "@/utils/microAppRuntimeCache.js";
import { shouldReusePageTabRoute } from "@/utils/page-tab-route-runtime.js";
import { shouldReuseRecordWorkbenchRoute } from "@/utils/record-id.js";

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
            // 页面多 Tab 与记录工作台都属于同一个业务入口。RecordId/ViewMode 只切换
            // 当前模块的记录或展示方式，query 变化时更新现有标签而不是创建重复标签。
            if (shouldReusePageTabRoute(view) || shouldReuseRecordWorkbenchRoute(view)) {
                const reusableIndex = this.visitedViews.findIndex((item) => (
                    item.path === view.path && item.name === view.name
                ));
                if (reusableIndex >= 0) {
                    const previous = this.visitedViews[reusableIndex];
                    this.visitedViews.splice(reusableIndex, 1, Object.assign({}, previous, view, {
                        title: view.meta?.title || previous.title || "no-name"
                    }));
                    return;
                }
            }
            // 使用 fullPath 精确匹配（包含所有路径、参数、query）
            // 只有完全相同的 URL 才会被认为是同一个标签
            if (this.visitedViews.some((v) => v.fullPath === view.fullPath)) return;
            
            // 如果超过最大数量，移除最早的非固定标签
            if (this.visitedViews.length >= MAX_VISITED_VIEWS) {
                const oldestNonAffix = this.visitedViews.find((v) => !v.meta?.affix);
                if (oldestNonAffix) {
                    const index = this.visitedViews.indexOf(oldestNonAffix);
                    this.visitedViews.splice(index, 1);
                    void releaseMicroAppRuntimeCacheForView(oldestNonAffix, "visited-view-limit");
                }
            }
            this.visitedViews.push(
                Object.assign({}, view, {
                    title: view.meta?.title || "no-name"
                })
            );
        },

        addCachedView(view) {
            // Micro-app menu pages deliberately bypass Vue keep-alive. Their
            // child state is owned by the bounded native micro-app cache, so
            // they must not consume or evict slots from the regular Vue cache.
            if (view.meta?.microAppHost === true || view.meta?.keepAlive === false) return;
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

        async delView(view) {
            await Promise.all([
                this.delVisitedView(view),
                this.delCachedView(view),
                releaseMicroAppRuntimeCacheForView(view, "tab-close")
            ]);
            return {
                visitedViews: [...this.visitedViews],
                cachedViews: [...this.cachedViews]
            };
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

        async delOthersViews(view) {
            const removedViews = this.visitedViews.filter((candidate) => {
                return !candidate.meta?.affix && candidate.fullPath !== view.fullPath;
            });
            await Promise.all([
                this.delOthersVisitedViews(view),
                this.delOthersCachedViews(view),
                ...removedViews.map((candidate) => releaseMicroAppRuntimeCacheForView(candidate, "close-other-tabs"))
            ]);
            return {
                visitedViews: [...this.visitedViews],
                cachedViews: [...this.cachedViews]
            };
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

        async delAllViews() {
            const removedViews = this.visitedViews.filter((candidate) => !candidate.meta?.affix);
            await Promise.all([
                this.delAllVisitedViews(),
                this.delAllCachedViews(),
                ...removedViews.map((candidate) => releaseMicroAppRuntimeCacheForView(candidate, "close-all-tabs"))
            ]);
            return {
                visitedViews: [...this.visitedViews],
                cachedViews: [...this.cachedViews]
            };
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
