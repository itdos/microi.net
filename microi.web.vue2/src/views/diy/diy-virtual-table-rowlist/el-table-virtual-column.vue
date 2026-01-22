<template>
    <el-table-column v-bind="$attrs" v-on="$listeners" :type="getColumnType()" :class-name="getClassName">
        <!-- 列头部 -->
        <template slot="header" slot-scope="scope">
            <slot v-if="$scopedSlots['header']" name="header" v-bind="scope"></slot>
            <template v-else>
                <!-- 多选类型-全选 -->
                <el-checkbox v-if="$attrs.type === 'selection'" :value="isCheckedAll" :indeterminate="isCheckedImn" @change="onCheckAllRows"> </el-checkbox>
                <template v-else>
                    {{ scope.column.label }}
                </template>
            </template>
        </template>
        <!-- 列嵌套 -->
        <template v-if="isNested">
            <slot></slot>
        </template>
        <!-- 列内容 -->
        <template slot-scope="scope">
            <!-- v-tree类型 -->
            <template v-if="isTree">
                <span class="el-table__indent" :style="{ paddingLeft: `${getTreeState(scope.row).level * indent}px` }"></span>
                <!-- treeNodeKey 用来更新视图的 -->
                <div
                    v-if="canExpand(scope.row) && treeNodeKey"
                    class="el-table__expand-icon"
                    :class="getTreeState(scope.row).expanded ? 'el-table__expand-icon--expanded' : ''"
                    @click="onTreeNodeExpand(scope.row)"
                >
                    <i class="el-icon-loading" v-if="getTreeState(scope.row).loading"></i>
                    <i class="el-icon-arrow-right" v-else></i>
                </div>
                <span v-else class="el-table__placeholder"></span>
            </template>
            <slot v-if="$scopedSlots['default']" v-bind="setScope(scope)"></slot>
            <template v-else>
                <!-- 多选类型 -->
                <el-checkbox
                    @click.native.stop
                    v-if="$attrs.type === 'selection'"
                    :value="scope.row.$v_checked || false"
                    :disabled="getDisabled(scope)"
                    @change="onCheckRow(scope, !scope.row.$v_checked)"
                >
                </el-checkbox>
                <!-- 单选类型 -->
                <el-radio v-if="$attrs.type === 'radio'" :label="true" :value="virtualScroll.curRow === scope.row" @change="onRadioChange(scope.row)">
                    <span></span>
                </el-radio>
                <!-- v-index类型 -->
                <span v-else-if="$attrs.type === 'index'">
                    {{ getIndex(scope) }}
                </span>
                <!-- 有formatter参数的情况 -->
                <template v-else-if="scope.column.formatter">
                    <!-- formatter结果为VNode的情况 -->
                    <el-table-virtual-column-formatter v-if="isVNode(getFormatterResult(scope))" :v-node="getFormatterResult(scope)" />
                    <!-- formatter结果为String的情况 -->
                    <template v-else>{{ getFormatterResult(scope) }}</template>
                </template>
                <template v-else>
                    {{ scope.row[scope.column.property] }}
                </template>
            </template>
        </template>
    </el-table-column>
</template>

<script>
import { TableColumn, Checkbox, Radio } from "element-ui";
import ElTableVirtualColumnFormatter from "./el-table-virtual-column-formatter.vue";

// 用于获取formatter结果的临时对象，不可挂载到vue实例中，否则会导致循环更新的问题
const formatterTempObj = {
    scope: null, // 缓存键 当前scope参数
    result: null // 缓存值 formatter的调用结果
};

export default {
    name: "el-table-virtual-column",
    components: {
        ElCheckbox: Checkbox,
        ElRadio: Radio,
        ElTableVirtualColumnFormatter
    },
    inject: ["virtualScroll"],
    props: {
        selectable: {
            type: Function
        },
        reserveSelection: {
            type: Boolean,
            default: false
        }
    },
    data() {
        return {
            isCheckedAll: false, // 全选
            isCheckedImn: false, // 控制半选样式
            isTree: false, // 树结构
            isNested: false, // 是否列嵌套
            treeNodeKey: 1 // 更新树节点视图
        };
    },
    computed: {
        getClassName() {
            const classnames = [];
            const classname = this.$attrs["class-name"] || this.$attrs.className;
            classname && classnames.push(classname);
            this.isTree && classnames.push("el-table__row--level");
            let vfixed = this.$attrs.vfixed;
            if (vfixed === true || vfixed === "") vfixed = "left";
            if (vfixed) classnames.push("virtual-column__fixed-" + vfixed);
            return classnames.join(" ");
        },
        indent() {
            return (this.virtualScroll.elTable || {}).indent || 16;
        }
    },
    methods: {
        getColumnType() {
            const { type } = this.$attrs;
            // 自定义的类型需转为空传到 el-table-column，否则会导致某些bug，如筛选按钮不亮
            return ["index", "selection", "radio", "tree"].includes(type) ? "" : type;
        },
        // 获取多选禁用状态
        getDisabled(scope) {
            if (this.selectable) {
                const index = this.getIndex(scope, false);
                return !this.selectable(scope.row, index);
            }
            return false;
        },

        // 获取节点的所有父节点
        getParentNodes(row, list) {
            const parents = [];
            // const { children = 'children', hasChildren = 'hasChildren' } = this.virtualScroll.treeProps || {}
            const _Child = this.virtualScroll.treeProps.children;

            const findParent = (data, target) => {
                for (let item of data) {
                    const children = item._Child || [];
                    // if (children.includes(target)) {
                    const Ids = children.map((item) => item.Id) || [];
                    if (Ids.includes(target.Id)) {
                        parents.push(item);
                        findParent(list, item);
                        break;
                    } else if (children.length) {
                        findParent(children, target);
                    }
                }
            };
            findParent(list, row);
            return parents;
        },

        // 获取节点的所有子节点
        getChildNodes(row) {
            const children = [];
            const _Child = this.virtualScroll.treeProps.children;

            const getChildren = (node) => {
                const nodeChildren = node?._Child || [];
                children.push(...nodeChildren);
                nodeChildren.forEach((child) => getChildren(child));
            };
            getChildren(row);
            return children;
        },

        // 检查节点的所有直接子节点是否都被选中
        checkChildrenAllSelected(row) {
            const children = row._children || row.children || [];
            return children.length > 0 && children.every((child) => child.$v_checked);
        },

        // 选择表格所有行
        onCheckAllRows(val) {
            const { selectOnIndeterminate = true } = this.virtualScroll.elTable;
            if (selectOnIndeterminate) {
                val = this.isCheckedImn ? true : !this.isCheckedAll;
            } else {
                val = this.isCheckedImn ? false : !this.isCheckedAll;
            }

            const list = this.virtualScroll.getData(false);
            const getAllNodes = (data) => {
                let nodes = [];
                data.forEach((item) => {
                    nodes.push(item);
                    const children = item._Child || [];
                    if (Array.isArray(children) && children.length) {
                        nodes = nodes.concat(getAllNodes(children));
                    }
                });
                return nodes;
            };

            if (this.selectable) {
                // 筛选出可选的行
                const selectableList = getAllNodes(list).filter((row, index) => this.selectable(row, index));
                this.virtualScroll.checkAll(val, selectableList, true);
            } else {
                const allNodes = getAllNodes(list);
                this.virtualScroll.checkAll(val, allNodes, true);
            }

            const selection = this.virtualScroll.getSelection();
            this.isCheckedImn = !val && selection.length > 0;
            this.isCheckedAll = val;
        },

        // 选择表格某行
        onCheckRow(scope, val) {
            const row = scope.row;
            const index = this.getIndex(scope, false);

            // 检查是否可选
            if (this.selectable) {
                const isSelectable = this.selectable(row, index);
                if (!isSelectable) return;
            }

            // 获取所有数据
            const list = this.virtualScroll.getData(false);

            // 1. 处理当前节点
            this.virtualScroll.checkRow(row, val, true, true);

            // 2. 处理子节点 - 子节点状态跟随当前节点
            const childNodes = this.getChildNodes(row);
            childNodes.forEach((child) => {
                if (!this.selectable || this.selectable(child, index)) {
                    this.virtualScroll.checkRow(child, val, true, false);
                }
            });
            console.log("node", scope.row, val, list);

            // 3. 处理父节点
            var parentNodes = this.getParentNodes(row, list);
            console.log("parentNodes", parentNodes);
            // parentNodes.$v_checked = true;
            parentNodes.forEach((parent) => {
                // 检查父节点的所有直接子节点是否都被选中
                const shouldCheck = this.checkChildrenAllSelected(parent);
                this.virtualScroll.checkRow(parent, shouldCheck, true, false);
                // parent._Child.map(item=>item.$v_checked).includes(true)
                const hasCheck = parent._Child.map((item) => item.$v_checked).includes(true);
                console.log("hasCheck", hasCheck);
                // if()
                // indeterminate
                parent.$v_checked = hasCheck;
                // hasCheck && this.syncCheckStatus();
            });
            // 4. 同步选中状态
            this.syncCheckStatus();
        },

        // 单选
        onRadioChange(row) {
            this.virtualScroll.setCurrentRow(row);
        },
        // 获取索引值; add1 - 是否加1
        getIndex(scope, add1 = true) {
            const index = this.virtualScroll.start + scope.$index;
            if (typeof this.$attrs.index === "function") {
                return this.$attrs.index(index);
            }
            return index + (add1 ? 1 : 0);
        },
        // 设置正确索引值
        setScope(scope) {
            scope.$index = this.virtualScroll.start + scope.$index;
            return scope;
        },
        // 获取树节点状态
        getTreeState(row) {
            return row.$v_tree || {};
        },
        // 是否可展开
        canExpand(row) {
            const { children = "children", hasChildren = "hasChildren" } = this.virtualScroll.treeProps || {};
            const treeState = row.$v_tree || {};
            return (row[children] || []).length > 0 || (row[hasChildren] && !treeState.loaded);
        },
        // 展开树节点
        async onTreeNodeExpand(row) {
            const treeState = row.$v_tree;
            if (treeState) {
                const { treeProps } = this.virtualScroll;
                const { hasChildren = "hasChildren" } = treeProps;
                if (treeState.loading) return;
                if (!treeState.expanded && row[hasChildren] && !treeState.loaded) {
                    await this.loadChildNodes(row);
                } else {
                    treeState.expanded = !treeState.expanded;
                    this.renderTreeNode();
                    this.virtualScroll.update();
                }
                this.virtualScroll.elTable.$emit("expand-change", row, treeState.expanded);
            }
        },
        // 加载子节点
        async loadChildNodes(row) {
            return new Promise((resolve) => {
                const { treeProps } = this.virtualScroll;
                const { load } = this.virtualScroll.elTable;
                if (!load) return resolve();

                const { children = "children" } = treeProps;
                const treeState = row.$v_tree;
                treeState.loading = true;
                this.renderTreeNode();

                function resolveFn(data) {
                    if (!Array.isArray(data)) {
                        throw new Error("[ElTable] data must be an array");
                    }

                    treeState.loading = false;
                    treeState.loaded = true;
                    treeState.expanded = true;
                    this.renderTreeNode();
                    if (!Array.isArray(data)) {
                        resolve();
                        return;
                    }
                    this.$set(row, children, data);
                    this.virtualScroll.update();
                    resolve();
                }
                load(row, treeState, resolveFn.bind(this));
            });
        },
        // 由于$v_tree不是响应式数据，$v_tree状态的变更需要手动触发视图的更新
        renderTreeNode() {
            this.treeNodeKey = this.treeNodeKey === 1 ? 2 : 1;
        },
        // 判断内容是否为VNode
        isVNode(vNode) {
            return this._vnode.constructor === vNode?.constructor;
        },
        // 获取formatter结果，相同的scope使用缓存的结果，避免重复调用formatter函数
        getFormatterResult(scope) {
            if (formatterTempObj.scope === scope) {
                return formatterTempObj.result;
            } else {
                formatterTempObj.scope = scope;
                formatterTempObj.result = scope.column.formatter(scope.row, scope.column, scope.row[scope.column.property], scope.$index);
                return formatterTempObj.result;
            }
        },
        // 是否自定义多选
        isSelection() {
            return this.$attrs.type === "selection";
        },
        // 同步选中状态
        syncCheckStatus() {
            const list = this.virtualScroll.getData(false);

            // 获取所有节点(包括子节点)
            const getAllNodes = (data) => {
                let nodes = [];
                data.forEach((item) => {
                    nodes.push(item);
                    const children = item._Child || [];
                    if (Array.isArray(children) && children.length) {
                        nodes = nodes.concat(getAllNodes(children));
                    }
                });
                return nodes;
            };

            const allNodes = getAllNodes(list);
            const checkedLen = allNodes.filter((row) => row.$v_checked === true).length;
            const selection = this.virtualScroll.getSelection();
            if (checkedLen && checkedLen === allNodes.length) {
                // 全部选中
                this.isCheckedAll = true;
            } else if (checkedLen && this.selectable) {
                // 可选的全部选中
                this.isCheckedAll = allNodes.every((row, index) => {
                    const enable = this.selectable(row, index);
                    if (!enable) return true;
                    return row.$v_checked;
                });
            } else {
                // 没有选中
                this.isCheckedAll = false;
            }

            this.isCheckedImn = !this.isCheckedAll && selection.length > 0;
        }
    },
    beforeCreate() {
        const globalComponents = this.$root.$options.components;
        // 当全局有引入ElTableColumn，就不用局部再引入了
        if (!globalComponents.ElTableColumn) {
            this.$options.components.ElTableColumn = TableColumn;
        }
    },
    created() {
        this.isNested = !!this.$slots.default; // 是否列嵌套
        this.virtualScroll.addColumn(this);

        const { type } = this.$attrs;
        if (type === "expand") {
            this.virtualScroll.useExpandTable();
        } else if (type === "tree") {
            this.isTree = true;
            this.virtualScroll.useCustomTree();
        } else if (type === "selection") {
            this.virtualScroll.useCustomSelection();
        }
    },
    beforeDestroy() {
        this.virtualScroll.removeColumn(this);
        // 清除formatter相关的缓存
        formatterTempObj.scope = null;
        formatterTempObj.result = null;
    }
};
</script>

<style lang="scss">
.el-table-virtual-scroll {
    .virtual-column__fixed-left,
    .virtual-column__fixed-right {
        position: sticky !important;
        z-index: 2 !important;
        background: #fff;
    }

    &.is-scrolling-left {
        .is-last-column {
            &:before {
                box-shadow: none;
            }
        }
    }

    &.is-scrolling-right,
    &.is-scrolling-middle {
        .is-last-column {
            border-right: none;
        }
    }

    &.is-scrolling-right {
        .is-first-column {
            &:before {
                box-shadow: none;
            }
        }
    }

    &.is-scrolling-left,
    &.is-scrolling-middle {
        .is-first-column {
            border-left: none;
        }
    }

    .is-last-column,
    .is-first-column {
        overflow: visible !important;

        &:before {
            content: "";
            position: absolute;
            top: 0px;
            width: 10px;
            bottom: -1px;
            overflow-x: hidden;
            overflow-y: hidden;
            touch-action: none;
            pointer-events: none;
        }
    }

    .is-last-column {
        &:before {
            right: -10px;
            box-shadow: inset 10px 0 10px -10px rgba(0, 0, 0, 0.12);
        }
    }

    .is-first-column {
        &:before {
            left: -10px;
            box-shadow: inset -10px 0 10px -10px rgba(0, 0, 0, 0.12);
        }
    }

    &.is-scrolling-none {
        .is-last-column,
        .is-first-column {
            &:before {
                content: none;
            }
        }
    }
}
</style>
