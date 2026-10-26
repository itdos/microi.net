import { observeActionColumnWidth } from '../utils/table-action-column-width.js';

// 不将 DOM/观察器放进响应式 data，避免 Vue 代理原生对象并产生布局反馈循环。
const observers = new WeakMap();
const paused = new WeakSet();

export default {
    data() {
        return { MeasuredActionColumnWidth: 0 };
    },
    mounted() {
        this.SyncActionColumnMeasurement();
    },
    updated() {
        this.SyncActionColumnMeasurement();
    },
    activated() {
        paused.delete(this);
        this.SyncActionColumnMeasurement();
    },
    deactivated() {
        paused.add(this);
        this.StopActionColumnMeasurement();
    },
    beforeUnmount() {
        paused.add(this);
        this.StopActionColumnMeasurement();
    },
    methods: {
        SyncActionColumnMeasurement() {
            if (paused.has(this)) return;
            const table = this.$refs['diy-table-' + this.TableId];
            const root = table?.$el;
            const current = observers.get(this);
            if (current?.root === root) {
                current.observer.schedule();
                return;
            }
            this.StopActionColumnMeasurement();
            if (!root?.matches?.('.el-table')) return;
            // 卡片/表格切换及新表根节点使用自己的测量结果，保留旧估算仅作首帧兼容。
            this.MeasuredActionColumnWidth = 0;
            const observer = observeActionColumnWidth(root, width => {
                this.MeasuredActionColumnWidth = width;
                this.$nextTick(() => {
                    if (!paused.has(this) && this.$refs['diy-table-' + this.TableId] === table) table.doLayout?.();
                });
            });
            observers.set(this, { root, observer });
        },
        StopActionColumnMeasurement() {
            observers.get(this)?.observer.stop();
            observers.delete(this);
        }
    }
};
