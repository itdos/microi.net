<template>
    <el-tree-select
        ref="tree" class="main-select-tree" :model-value="modelValue" :data="roots"
        :cache-data="selectedRows" :node-key="valueKey" :props="treeProps"
        :multiple="multiple" :show-checkbox="multiple" check-strictly lazy clearable
        :filterable="filterable" :filter-method="search" :filter-node-method="() => true"
        :load="loadChildren" :disabled="disabled" :placeholder="placeholder"
        popper-class="mci-paged-select-tree" @visible-change="onVisible" @update:model-value="select"
    >
        <template #default="{ data }">
            <el-button v-if="data._mciTreeMore" link type="primary" :loading="data._mciTreeBusy"
                @mousedown.prevent.stop @click.prevent.stop="loadMoreChildren(data)">
                {{ $t(data._mciTreeError ? 'Msg.TreePageRetry' : 'Msg.TreePageMoreChildren') }}
            </el-button>
            <span v-else>{{ data[labelKey] ?? data[valueKey] }}</span>
        </template>
        <template #footer>
            <div class="mci-tree-page-controls" @mousedown.prevent>
                <el-button v-if="error" link type="danger" @click.stop="loadRoots(requestedPage)">{{ $t('Msg.TreePageRetry') }}</el-button>
                <span v-else aria-live="polite">{{ busy ? $t('Msg.Loading') : $t(keyword ? 'Msg.TreePageSearch' : 'Msg.TreePageRoots', { page: pageIndex }) }}</span>
                <el-button link :disabled="busy || pageIndex <= 1" @click.stop="loadRoots(pageIndex - 1)">{{ $t('Msg.TreePagePrevious') }}</el-button>
                <el-button link :disabled="busy || !hasMore" @click.stop="loadRoots(pageIndex + 1)">{{ $t('Msg.TreePageNext') }}</el-button>
            </div>
        </template>
        <template #empty><div class="mci-tree-empty">{{ $t(busy ? 'Msg.Loading' : error ? 'Msg.TreePageRetry' : 'Msg.NoData') }}</div></template>
    </el-tree-select>
</template>

<script>
import { markRaw } from 'vue';
import { mergeTreePage, selectTreeKeys } from './select-tree-paging.js';

export default {
    name: 'PagedSelectTree',
    props: {
        modelValue: [String, Number, Array], field: { type: Object, required: true },
        formData: { type: Object, default: () => ({}) }, disabled: Boolean, placeholder: String
    },
    emits: ['change'],
    data() {
        return {
            roots: [], selectedRows: [], pageIndex: 1, requestedPage: 1, hasMore: false,
            keyword: '', busy: false, error: false, initialized: false, visible: false,
            revision: 0, lookupRevision: 0, disposed: false,
            rowsByKey: markRaw(new Map()), childPages: markRaw(new Map()),
            pendingChildren: markRaw(new Map()), queryTimer: null
        };
    },
    computed: {
        valueKey() { return this.field.Config.SelectSaveField || this.field.Config.SelectTree.Value || 'Id'; },
        labelKey() { return this.field.Config.SelectLabel || this.field.Config.SelectTree.Label || this.valueKey; },
        multiple() { return this.field.Config.SelectTree.Multiple === true; },
        filterable() { return this.field.Config.SelectTree.Filterable === true || this.field.Config.DataSourceSqlRemote === true; },
        pageSize() { return Math.min(200, Math.max(1, Number(this.field.Config.SelectTree.PageSize) || 50)); },
        treeProps() {
            const cfg = this.field.Config.SelectTree;
            return {
                value: this.valueKey, label: this.labelKey, children: cfg.Children || '_Child',
                isLeaf: data => data._mciTreeMore ? true : [true, 1, '1', 'true'].includes(data[cfg.Leaf || '_Leaf']),
                disabled: data => !!data._mciTreeMore || (cfg.Disabled ? !!data[cfg.Disabled] : false)
            };
        },
        // 字段 SQL 可以依赖当前表单；仅监听实际引用的字段，选择父级本身不会重载整个下拉树。
        sourceContext() {
            const names = [...String(this.field.Config.Sql || '').matchAll(/\$V8\.Form\.([^$]+)\$/g)].map(match => match[1]);
            return JSON.stringify([this.field.Id, this.field.Config, this.field._TableChildAuth,
                names.map(name => [name, this.formData[name]])]);
        }
    },
    watch: {
        modelValue: { handler() { this.hydrateSelection(); }, immediate: true, deep: true },
        sourceContext() {
            ++this.revision;
            ++this.lookupRevision;
            clearTimeout(this.queryTimer);
            this.initialized = false;
            this.busy = false;
            this.error = false;
            this.hasMore = false;
            this.roots = [];
            this.selectedRows = [];
            this.rowsByKey.clear();
            this.hydrateSelection();
            if (this.visible) this.loadRoots(1);
        }
    },
    beforeUnmount() {
        this.disposed = true;
        ++this.revision;
        ++this.lookupRevision;
        clearTimeout(this.queryTimer);
    },
    methods: {
        request(params) {
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error('分类加载超时')), 30000);
                this.DiyCommon.Post(this.DiyApi.GetDiyFieldSqlData, {
                    _FieldId: this.field.Id, _TableChildAuth: this.field._TableChildAuth || null,
                    _FormData: this.formData, _PageSize: this.pageSize, ...params
                }, result => {
                    clearTimeout(timer);
                    if (result?.Code === 1 && Array.isArray(result.Data)) resolve(result);
                    else reject(new Error(result?.Msg || '分类加载失败'));
                }, () => { clearTimeout(timer); reject(new Error('分类加载失败')); });
            });
        },
        remember(rows) {
            for (const row of rows) this.rowsByKey.set(String(row[this.valueKey]), row);
        },
        async hydrateSelection() {
            const revision = ++this.lookupRevision;
            const keys = selectTreeKeys(this.modelValue, this.valueKey);
            this.selectedRows = keys.map(key => this.rowsByKey.get(String(key))).filter(Boolean);
            const missing = keys.filter(key => !this.rowsByKey.has(String(key)));
            if (!missing.length) return;
            try {
                for (let i = 0; i < missing.length; i += 200) {
                    const result = await this.request({ _SelectTreeValues: missing.slice(i, i + 200).map(String) });
                    if (this.disposed || revision !== this.lookupRevision) return;
                    this.remember(result.Data);
                    this.selectedRows = keys.map(key => this.rowsByKey.get(String(key))).filter(Boolean);
                }
            } catch { /* 保留原始存储值；展开时可再次尝试回填，不触发写入或字段 V8。 */ }
        },
        onVisible(visible) {
            this.visible = visible;
            if (visible) {
                this.hydrateSelection();
                if (!this.initialized && !this.busy) this.loadRoots(1);
            } else if (this.keyword) {
                clearTimeout(this.queryTimer);
                ++this.revision;
                this.keyword = '';
                this.initialized = false;
                this.busy = false;
                this.roots = [];
            }
        },
        async loadRoots(page = 1) {
            clearTimeout(this.queryTimer);
            const revision = ++this.revision;
            this.requestedPage = page;
            this.busy = true;
            this.error = false;
            this.hasMore = false;
            this.roots = [];
            this.childPages.clear();
            this.pendingChildren.clear();
            // 只保留选中项缓存，翻页不会累计挂载数千个根节点。
            this.rowsByKey.clear();
            this.remember(this.selectedRows);
            try {
                const result = await this.request({ _ParentValue: '', _PageIndex: page, _Keyword: this.keyword });
                if (this.disposed || revision !== this.revision) return;
                this.remember(result.Data);
                this.roots = result.Data;
                this.pageIndex = page;
                this.hasMore = result.DataAppend?.HasMore === true;
                this.initialized = true;
                this.hydrateSelection();
            } catch {
                if (!this.disposed && revision === this.revision) this.error = true;
            } finally {
                if (!this.disposed && revision === this.revision) this.busy = false;
            }
        },
        search(keyword = '') {
            if (keyword === this.keyword) return;
            this.keyword = keyword;
            ++this.revision; // 输入时即淘汰旧请求，覆盖防抖期间旧响应返回的窗口。
            clearTimeout(this.queryTimer);
            this.busy = true;
            this.queryTimer = setTimeout(() => this.loadRoots(1), 300);
        },
        pageChildren(parent, page) {
            const key = `${this.revision}:${parent}:${page}`;
            if (this.pendingChildren.has(key)) return this.pendingChildren.get(key);
            const request = this.request({ _ParentValue: String(parent), _PageIndex: page })
                .finally(() => this.pendingChildren.delete(key));
            this.pendingChildren.set(key, request);
            return request;
        },
        moreNode(parent, page) {
            return {
                [this.valueKey]: `__mci_tree_more_${this.field.Id}_${parent}_${page}`,
                _mciTreeMore: { parent, page, revision: this.revision }, _mciTreeBusy: false, _mciTreeError: false
            };
        },
        async loadChildren(node, resolve, reject) {
            if (node.level === 0) { resolve(this.roots); return; }
            if (node.data._mciTreeMore) { resolve([]); return; }
            const revision = this.revision;
            const parent = node.data[this.valueKey];
            try {
                const result = await this.pageChildren(parent, 1);
                if (this.disposed || revision !== this.revision) { reject?.(); return; }
                this.remember(result.Data);
                this.childPages.set(String(parent), result.Data);
                resolve(result.DataAppend?.HasMore ? [...result.Data, this.moreNode(parent, 2)] : result.Data);
            } catch {
                if (!this.disposed && revision === this.revision) this.DiyCommon.Tips(this.$t('Msg.TreePageChildRetry'), false);
                // Element Plus 的 reject 保留未加载状态，允许用户重新展开。
                reject?.();
            }
        },
        async loadMoreChildren(data) {
            if (data._mciTreeBusy) return;
            const { parent, page, revision } = data._mciTreeMore;
            data._mciTreeBusy = true;
            try {
                const result = await this.pageChildren(parent, page);
                if (this.disposed || revision !== this.revision) return;
                this.remember(result.Data);
                const rows = mergeTreePage(this.childPages.get(String(parent)) || [], result.Data, this.valueKey);
                this.childPages.set(String(parent), rows);
                // append/remove 保留先前已展开的子树，不用 updateKeyChildren 重建整支。
                const tree = this.$refs.tree;
                tree.remove(data);
                for (const row of result.Data) if (!tree.getNode(row[this.valueKey])) tree.append(row, parent);
                if (result.DataAppend?.HasMore) tree.append(this.moreNode(parent, page + 1), parent);
            } catch { data._mciTreeError = true; }
            finally { data._mciTreeBusy = false; }
        },
        select(value) {
            const keys = selectTreeKeys(value, this.valueKey);
            const rows = keys.map(key => this.rowsByKey.get(String(key)) || { [this.valueKey]: key });
            this.selectedRows = rows;
            this.$emit('change', this.multiple ? rows : (rows[0] || null));
        }
    }
};
</script>

<style>
.mci-paged-select-tree .mci-tree-page-controls { display: flex; gap: 12px; align-items: center; justify-content: space-between; font-size: 12px; white-space: nowrap; }
.mci-paged-select-tree .mci-tree-empty { padding: 16px; text-align: center; color: var(--el-text-color-secondary); }
</style>
