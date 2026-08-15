<template>
    <div class="blueprint-designer">
        <!-- 顶部工具栏 -->
        <div class="toolbar">
            <el-button-group>
                <el-button @click="$router.back()" :icon="ArrowLeft">返回</el-button>
            </el-button-group>
            <el-divider direction="vertical" />
            <el-input v-model="form.Name" placeholder="蓝图名称" style="width: 220px;" size="default" />
            <el-input v-model="form.Code" placeholder="编码（可选）" style="width: 160px; margin-left: 6px;"
                size="default" />
            <el-input v-model="form.Version" placeholder="版本" style="width: 92px; margin-left: 6px;" maxlength="20"
                size="default" />
            <el-input v-model="form.ChangeSummary" placeholder="本次变更说明" style="width: 180px; margin-left: 6px;"
                maxlength="2000" size="default" />
            <el-divider direction="vertical" />
            <el-button-group>
                <el-button :type="layer === 'domain' ? 'primary' : ''" @click="switchLayer('domain')"
                    :icon="Grid">领域层</el-button>
                <el-button :type="layer === 'process' ? 'primary' : ''" @click="switchLayer('process')"
                    :icon="Connection">流程层</el-button>
                <el-button :type="layer === 'behavior' ? 'primary' : ''" @click="switchLayer('behavior')"
                    :icon="Lightning">行为层</el-button>
            </el-button-group>
            <el-divider direction="vertical" />
            <el-button-group>
                <el-button @click="addNodeFromToolbar('table')" :icon="Coin">表节点</el-button>
                <el-button @click="addNodeFromToolbar('engine')" :icon="Cpu">接口引擎</el-button>
                <el-button @click="addNodeFromToolbar('process')" :icon="Operation">流程</el-button>
                <el-button @click="addNodeFromToolbar('note')" :icon="EditPen">注释</el-button>
            </el-button-group>
            <el-divider direction="vertical" />
            <el-button-group>
                <el-button @click="undo" :icon="RefreshLeft" title="撤销 Ctrl+Z" />
                <el-button @click="redo" :icon="RefreshRight" title="重做 Ctrl+Y" />
                <el-button @click="zoomIn" :icon="ZoomIn" title="放大" />
                <el-button @click="zoomOut" :icon="ZoomOut" title="缩小" />
                <el-button @click="zoomToFit" :icon="FullScreen" title="适应屏幕" />
                <el-button @click="autoLayout" :icon="MagicStick" title="自动布局" />
            </el-button-group>
            <el-divider direction="vertical" />
            <el-button-group>
                <el-button @click="deleteSelected" :icon="Delete" title="删除选中 Del" />
                <el-button @click="onCopy" :icon="DocumentCopy" title="复制 Ctrl+C" />
                <el-button @click="onPaste" :icon="DocumentAdd" title="粘贴 Ctrl+V" />
            </el-button-group>
            <el-divider direction="vertical" />
            <el-button type="success" @click="onSave" :icon="Check">保存</el-button>
            <el-button type="warning" @click="onValidate" :disabled="!form.Id" :icon="WarningFilled">验证</el-button>
            <el-button type="primary" plain @click="openHistory" :disabled="!form.Id" :icon="Clock">历史</el-button>
            <el-button type="info" @click="showJsonDialog = true" :icon="DataLine">JSON</el-button>
            <span class="zoom-tip">缩放：{{ Math.round(zoom * 100) }}%</span>
        </div>

        <!-- 画布主体 -->
        <div class="canvas-wrapper">
            <!-- 左侧 stencil（节点库） -->
            <div class="stencil">
                <div class="stencil-title">节点库</div>
                <div class="stencil-hint">拖入画布或点击工具栏添加</div>
                <div class="stencil-item" draggable="true" @dragstart="onStencilDrag($event, 'table')">
                    <div class="stencil-preview" :style="{ background: SHAPE_STYLE.table.fill, border: '1.5px solid ' + SHAPE_STYLE.table.stroke }">表</div>
                    <span>表节点</span>
                </div>
                <div class="stencil-item" draggable="true" @dragstart="onStencilDrag($event, 'engine')">
                    <div class="stencil-preview" :style="{ background: SHAPE_STYLE.engine.fill, border: '1.5px solid ' + SHAPE_STYLE.engine.stroke }">API</div>
                    <span>接口引擎</span>
                </div>
                <div class="stencil-item" draggable="true" @dragstart="onStencilDrag($event, 'process')">
                    <div class="stencil-preview" :style="{ background: SHAPE_STYLE.process.fill, border: '1.5px solid ' + SHAPE_STYLE.process.stroke }">流程</div>
                    <span>流程节点</span>
                </div>
                <div class="stencil-item" draggable="true" @dragstart="onStencilDrag($event, 'note')">
                    <div class="stencil-preview" :style="{ background: SHAPE_STYLE.note.fill, border: '1.5px dashed ' + SHAPE_STYLE.note.stroke }">备注</div>
                    <span>注释</span>
                </div>
                <el-divider />
                <div class="stencil-title">当前层节点 ({{ currentNodes.length }})</div>
                <div class="node-list">
                    <div v-for="n in currentNodes" :key="n.id" class="node-list-item" @click="focusNode(n.id)"
                        :class="{ active: selectedNodeId === n.id }">
                        <span class="node-list-kind" :style="{ background: (SHAPE_STYLE[n.shape] || SHAPE_STYLE.table).fill }">{{ kindLabel(n.shape) }}</span>
                        {{ n.label || '(未命名)' }}
                    </div>
                </div>
            </div>

            <!-- 中间画布 -->
            <div ref="graphContainer" class="graph-container"
                @dragover.prevent
                @drop="onCanvasDrop"></div>

            <!-- 右侧属性面板 -->
            <div class="side-panel">
                <div v-if="selectedNode" class="prop-panel">
                    <h4>节点属性</h4>
                    <el-form label-width="80px" size="small">
                        <el-form-item label="类型">
                            <el-tag :type="kindTagType(selectedNode.shape)">{{ kindLabel(selectedNode.shape) }}</el-tag>
                        </el-form-item>
                        <el-form-item label="名称">
                            <el-input v-model="selectedNode.label" @input="onLabelInput" />
                        </el-form-item>
                        <el-form-item label="编码">
                            <el-input v-model="selectedNode.code" placeholder="可选" @input="syncRefsToCell" />
                        </el-form-item>
                        <el-form-item label="说明">
                            <el-input type="textarea" :rows="2" v-model="selectedNode.description"
                                @input="syncRefsToCell" />
                        </el-form-item>
                    </el-form>
                    <el-divider content-position="left">资源引用</el-divider>
                    <el-form label-width="80px" size="small">
                        <el-form-item v-if="selectedNode.shape === 'table'" label="表">
                            <el-select v-model="selectedNode.refs.tables" multiple filterable allow-create
                                placeholder="diy_table 名称" @change="syncRefsToCell" style="width: 100%">
                                <el-option v-for="t in resourceCache.tables" :key="t" :label="t" :value="t" />
                            </el-select>
                        </el-form-item>
                        <el-form-item v-if="selectedNode.shape === 'engine'" label="接口引擎">
                            <el-select v-model="selectedNode.refs.engines" multiple filterable allow-create
                                placeholder="ApiEngineKey" @change="syncRefsToCell" style="width: 100%">
                                <el-option v-for="e in resourceCache.engines" :key="e" :label="e" :value="e" />
                            </el-select>
                        </el-form-item>
                        <el-form-item v-if="selectedNode.shape === 'process'" label="菜单">
                            <el-select v-model="selectedNode.refs.menus" multiple filterable allow-create
                                placeholder="菜单 Id 或名称" @change="syncRefsToCell" style="width: 100%">
                                <el-option v-for="m in resourceCache.menus" :key="m" :label="m" :value="m" />
                            </el-select>
                        </el-form-item>
                        <el-form-item label="V8 事件">
                            <el-select v-model="selectedNode.refs.v8Events" multiple filterable allow-create
                                placeholder="V8 事件 key" @change="syncRefsToCell" style="width: 100%" />
                        </el-form-item>
                        <el-form-item label="高级">
                            <el-input type="textarea" :rows="6" v-model="selectedNodeRefsJson"
                                placeholder='{"tables":[],"fields":[],"engines":[],"menus":[],"v8Events":[],"dataSources":[]}'
                                @change="onRefsJsonChange" />
                        </el-form-item>
                    </el-form>
                </div>
                <div v-else-if="selectedEdge" class="prop-panel">
                    <h4>连线属性</h4>
                    <el-form label-width="80px" size="small">
                        <el-form-item label="标签">
                            <el-input v-model="selectedEdge.label" @input="onEdgeLabelChange" />
                        </el-form-item>
                        <el-form-item label="说明">
                            <el-input type="textarea" :rows="2" v-model="selectedEdge.description" />
                        </el-form-item>
                    </el-form>
                </div>
                <div v-else class="prop-panel-empty">
                    <el-icon><InfoFilled /></el-icon>
                    <p>请在画布上点选节点或连线</p>
                    <el-divider />
                    <h4>使用说明</h4>
                    <ul class="usage-tips">
                        <li>从左侧"节点库"拖入画布</li>
                        <li>鼠标悬停节点出现 <b>4 个端口</b>，从端口拖出连线到目标节点</li>
                        <li><kbd>Shift+滚轮</kbd> 缩放，<kbd>空格+拖</kbd> 平移</li>
                        <li><kbd>Del</kbd> 删除选中，<kbd>Ctrl+Z/Y</kbd> 撤销/重做</li>
                        <li><kbd>Ctrl+点</kbd> 多选，鼠标框选多选</li>
                        <li>编辑节点名称：双击节点</li>
                    </ul>
                </div>
            </div>
        </div>

        <!-- 验证结果弹窗 -->
        <el-dialog v-model="validateVisible" title="蓝图验证结果" width="640px">
            <div v-if="validateResult">
                <el-alert v-if="validateResult.Passed" type="success"
                    :title="`✓ 验证通过（共检查 ${validateResult.CheckedRefs} 个引用）`" :closable="false" show-icon />
                <el-alert v-else type="error"
                    :title="`✗ 发现 ${(validateResult.errors || validateResult.Errors)?.length || 0} 个错误`"
                    :closable="false" show-icon />
                <ul v-if="(validateResult.errors || validateResult.Errors)?.length" class="result-list">
                    <li v-for="(e, i) in (validateResult.errors || validateResult.Errors)" :key="'e' + i"
                        class="result-error">{{ e }}</li>
                </ul>
                <ul v-if="(validateResult.warnings || validateResult.Warnings)?.length" class="result-list">
                    <li v-for="(w, i) in (validateResult.warnings || validateResult.Warnings)" :key="'w' + i"
                        class="result-warn">{{ w }}</li>
                </ul>
            </div>
        </el-dialog>

        <!-- JSON 弹窗 -->
        <el-dialog v-model="showJsonDialog" title="蓝图 JSON" width="760px">
            <el-input type="textarea" :rows="22" v-model="jsonText" style="font-family: Consolas, monospace;" />
            <template #footer>
                <el-button @click="showJsonDialog = false">关闭</el-button>
                <el-button type="warning" @click="applyJson">应用 JSON 到画布</el-button>
            </template>
        </el-dialog>

        <!-- 不可变历史、差异与回滚 -->
        <el-dialog v-model="historyVisible" title="蓝图版本历史" width="min(1080px, calc(100vw - 48px))"
            align-center draggable append-to-body>
            <div class="history-summary">
                <div>
                    <span class="history-label">当前版本</span>
                    <strong>{{ form.Version || '1.0' }}</strong>
                </div>
                <div>
                    <span class="history-label">当前内容 Hash</span>
                    <code>{{ shortHash(currentHash) }}</code>
                </div>
                <el-button size="small" @click="loadHistoryPage(historyPage)" :loading="historyLoading">刷新</el-button>
            </div>
            <el-table v-mci-loading:table="historyLoading" :data="historyItems" stripe max-height="520">
                <el-table-column prop="Version" label="版本" width="110" />
                <el-table-column prop="ChangeSummary" label="变更说明" min-width="220" show-overflow-tooltip />
                <el-table-column prop="CreateUserName" label="保存人" width="120" />
                <el-table-column prop="CreateTime" label="保存时间" width="168" />
                <el-table-column label="内容" width="150">
                    <template #default="scope">
                        <code :title="scope.row.ContentHash">{{ shortHash(scope.row.ContentHash) }}</code>
                        <div class="history-bytes">{{ formatBytes(scope.row.ContentLength) }}</div>
                    </template>
                </el-table-column>
                <el-table-column label="操作" width="244" fixed="right">
                    <template #default="scope">
                        <el-button link type="primary" @click="compareHistory(scope.row)">比较当前</el-button>
                        <el-button link @click="viewHistory(scope.row)">查看</el-button>
                        <el-button link type="danger" :loading="rollbackLoadingId === scope.row.Id"
                            @click="confirmRollback(scope.row)">回滚</el-button>
                    </template>
                </el-table-column>
            </el-table>
            <div class="history-pagination" v-if="historyTotal > historyPageSize">
                <el-pagination background layout="prev, pager, next, total" :total="historyTotal"
                    :page-size="historyPageSize" :current-page="historyPage"
                    @current-change="loadHistoryPage" />
            </div>
        </el-dialog>

        <el-dialog v-model="diffVisible" title="蓝图语义差异" width="min(1180px, calc(100vw - 48px))"
            align-center draggable append-to-body>
            <div v-if="diffResult" class="diff-panel">
                <div class="diff-summary">
                    <el-tag type="success">新增 {{ diffResult.Added || 0 }}</el-tag>
                    <el-tag type="danger">删除 {{ diffResult.Removed || 0 }}</el-tag>
                    <el-tag type="warning">修改 {{ diffResult.Changed || 0 }}</el-tag>
                    <span>{{ diffResult.Left?.Version || '-' }} → {{ diffResult.Right?.Version || '-' }}</span>
                    <span v-if="diffResult.Truncated" class="diff-truncated">结果过多，仅展示前 {{ diffResult.ReturnedChanges }} 项</span>
                </div>
                <el-empty v-if="diffResult.Equal" description="两个版本的业务内容一致" />
                <el-table v-else :data="diffResult.Changes || []" stripe max-height="560">
                    <el-table-column prop="Type" label="类型" width="88">
                        <template #default="scope">
                            <el-tag :type="diffTagType(scope.row.Type)" size="small">{{ diffTypeLabel(scope.row.Type) }}</el-tag>
                        </template>
                    </el-table-column>
                    <el-table-column prop="Path" label="语义路径" min-width="280" show-overflow-tooltip />
                    <el-table-column label="变更前" min-width="300">
                        <template #default="scope"><pre class="diff-value">{{ formatDiffValue(scope.row.Before) }}</pre></template>
                    </el-table-column>
                    <el-table-column label="变更后" min-width="300">
                        <template #default="scope"><pre class="diff-value">{{ formatDiffValue(scope.row.After) }}</pre></template>
                    </el-table-column>
                </el-table>
            </div>
        </el-dialog>

        <el-dialog v-model="historyDetailVisible" title="历史快照 JSON"
            width="min(920px, calc(100vw - 48px))" align-center draggable append-to-body>
            <el-input type="textarea" :rows="24" v-model="historyDetailText" readonly
                style="font-family: Consolas, monospace;" />
        </el-dialog>

        <!-- 节点重命名（双击） -->
        <el-dialog v-model="renameVisible" title="重命名节点" width="360px">
            <el-input v-model="renameText" @keyup.enter="confirmRename" autofocus />
            <template #footer>
                <el-button @click="renameVisible = false">取消</el-button>
                <el-button type="primary" @click="confirmRename">确定</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script>
import { Graph, Shape } from "@antv/x6";
import { Selection } from "@antv/x6-plugin-selection";
import { Keyboard } from "@antv/x6-plugin-keyboard";
import { History } from "@antv/x6-plugin-history";
import { Snapline } from "@antv/x6-plugin-snapline";
import { Clipboard } from "@antv/x6-plugin-clipboard";
import { Transform } from "@antv/x6-plugin-transform";
import {
    ArrowLeft, Check, WarningFilled, Grid, Connection, Lightning, Coin, Cpu, Operation,
    EditPen, RefreshLeft, RefreshRight, ZoomIn, ZoomOut, FullScreen, MagicStick,
    Delete, DocumentCopy, DocumentAdd, DataLine, InfoFilled, Clock
} from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { BlueprintApi } from "./api.js";

const LAYER_CONFIG = {
    domain: { label: "领域层（ER）", diagramId: "diag_domain" },
    process: { label: "流程层", diagramId: "diag_process" },
    behavior: { label: "行为层（V8）", diagramId: "diag_behavior" }
};

const SHAPE_STYLE = {
    table:   { fill: "#e3f2fd", stroke: "#1976d2", textColor: "#0d47a1" },
    engine:  { fill: "#fff3e0", stroke: "#f57c00", textColor: "#e65100" },
    process: { fill: "#f1f8e9", stroke: "#558b2f", textColor: "#33691e" },
    note:    { fill: "#fffde7", stroke: "#fbc02d", textColor: "#f57f17" }
};

const KIND_LABEL = { table: "表", engine: "API", process: "流程", note: "注释" };

// 4 个隐藏端口（hover 时显示）
const PORTS_CONFIG = {
    groups: {
        top: { position: "top", attrs: { circle: { r: 5, magnet: true, stroke: "#5F95FF", strokeWidth: 1.5, fill: "#fff", style: { visibility: "hidden" } } } },
        right: { position: "right", attrs: { circle: { r: 5, magnet: true, stroke: "#5F95FF", strokeWidth: 1.5, fill: "#fff", style: { visibility: "hidden" } } } },
        bottom: { position: "bottom", attrs: { circle: { r: 5, magnet: true, stroke: "#5F95FF", strokeWidth: 1.5, fill: "#fff", style: { visibility: "hidden" } } } },
        left: { position: "left", attrs: { circle: { r: 5, magnet: true, stroke: "#5F95FF", strokeWidth: 1.5, fill: "#fff", style: { visibility: "hidden" } } } }
    },
    items: [
        { id: "port-top", group: "top" },
        { id: "port-right", group: "right" },
        { id: "port-bottom", group: "bottom" },
        { id: "port-left", group: "left" }
    ]
};

const NODE_WIDTH = 150;
const NODE_HEIGHT = 56;

export default {
    name: "BlueprintDesigner",
    components: {
        ArrowLeft, Check, WarningFilled, Grid, Connection, Lightning, Coin, Cpu, Operation,
        EditPen, RefreshLeft, RefreshRight, ZoomIn, ZoomOut, FullScreen, MagicStick,
        Delete, DocumentCopy, DocumentAdd, DataLine, InfoFilled, Clock
    },
    data() {
        return {
            ArrowLeft, Check, WarningFilled, Grid, Connection, Lightning, Coin, Cpu, Operation,
            EditPen, RefreshLeft, RefreshRight, ZoomIn, ZoomOut, FullScreen, MagicStick,
            Delete, DocumentCopy, DocumentAdd, DataLine, InfoFilled, Clock,
            SHAPE_STYLE,
            LAYER_CONFIG,
            graph: null,
            layer: "domain",
            form: { Id: "", Name: "", Code: "", Description: "", Version: "1.0", Status: 1, ChangeSummary: "" },
            // 三层图：仅保存"序列化"的 nodes/edges，画布以 x6 内部状态为准
            diagrams: {
                domain: { nodes: [], edges: [] },
                process: { nodes: [], edges: [] },
                behavior: { nodes: [], edges: [] }
            },
            currentNodes: [],   // 视图层（来自 graph.getNodes 的快照，给左侧列表用）
            selectedNodeId: "",
            selectedNode: null,
            selectedEdge: null,
            selectedNodeRefsJson: "{}",
            validateVisible: false,
            validateResult: null,
            showJsonDialog: false,
            jsonText: "",
            renameVisible: false,
            renameText: "",
            renameTargetId: "",
            zoom: 1,
            resourceCache: { tables: [], engines: [], menus: [] },
            historyVisible: false,
            historyLoading: false,
            historyItems: [],
            historyPage: 1,
            historyPageSize: 50,
            historyTotal: 0,
            currentHash: "",
            rollbackLoadingId: "",
            diffVisible: false,
            diffResult: null,
            historyDetailVisible: false,
            historyDetailText: ""
        };
    },
    computed: {
        layerLabel() { return LAYER_CONFIG[this.layer].label; }
    },
    mounted() {
        this.$nextTick(() => {
            this.initGraph();
            const id = this.$route.params.id;
            if (id && id !== "new") this.loadBlueprint(id);
            this.loadResourceCache();
        });
    },
    beforeUnmount() {
        if (this.graph) {
            try { this.graph.dispose(); } catch (e) { /* ignore */ }
            this.graph = null;
        }
    },
    methods: {
        kindLabel(k) { return KIND_LABEL[k] || k; },
        kindTagType(k) {
            return { table: "primary", engine: "warning", process: "success", note: "info" }[k] || "";
        },
        shortHash(value) {
            const text = String(value || "");
            return text ? `${text.slice(0, 10)}…${text.slice(-6)}` : "-";
        },
        formatBytes(value) {
            const size = Number(value || 0);
            if (size < 1024) return `${size} B`;
            if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
            return `${(size / 1024 / 1024).toFixed(1)} MB`;
        },
        diffTagType(type) {
            return { Added: "success", Removed: "danger", Changed: "warning" }[type] || "info";
        },
        diffTypeLabel(type) {
            return { Added: "新增", Removed: "删除", Changed: "修改" }[type] || type;
        },
        formatDiffValue(value) {
            if (value === null || value === undefined) return "—";
            if (typeof value === "string") return value;
            try { return JSON.stringify(value, null, 2); } catch (e) { return String(value); }
        },

        initGraph() {
            const container = this.$refs.graphContainer;
            if (!container) return;
            const rect = container.getBoundingClientRect();
            this.graph = new Graph({
                container,
                width: Math.max(rect.width || container.clientWidth || 800, 400),
                height: Math.max(rect.height || container.clientHeight || 600, 400),
                autoResize: true,
                background: { color: "#f5f7fa" },
                grid: { visible: true, size: 10, type: "doubleMesh", args: [
                    { color: "#e2e6eb", thickness: 1 },
                    { color: "#cfd6de", thickness: 1, factor: 4 }
                ]},
                panning: { enabled: true, modifiers: ["space"] },
                mousewheel: { enabled: true, modifiers: ["shift"], minScale: 0.3, maxScale: 2.5, factor: 1.1 },
                connecting: {
                    router: { name: "manhattan", args: { padding: 16 } },
                    connector: { name: "rounded", args: { radius: 6 } },
                    anchor: "center",
                    connectionPoint: "anchor",
                    snap: { radius: 24 },
                    allowBlank: false,
                    allowLoop: false,
                    allowMulti: "withPort",
                    allowEdge: false,
                    allowNode: false,
                    highlight: true,
                    createEdge: () => this.createEdgeShape(),
                    validateConnection: ({ sourceCell, targetCell, sourceMagnet, targetMagnet }) => {
                        if (!sourceCell || !targetCell) return false;
                        if (sourceCell.id === targetCell.id) return false;
                        if (!sourceMagnet || !targetMagnet) return false;
                        return true;
                    }
                },
                highlighting: {
                    magnetAvailable: {
                        name: "stroke",
                        args: { attrs: { fill: "#fff", stroke: "#52c41a", strokeWidth: 4 } }
                    },
                    magnetAdsorbed: {
                        name: "stroke",
                        args: { attrs: { fill: "#fff", stroke: "#1890ff", strokeWidth: 4 } }
                    }
                },
                interacting: { nodeMovable: true, edgeMovable: true, edgeLabelMovable: true }
            });

            // ✅ 插件
            this.graph.use(new Selection({ enabled: true, rubberband: true, showNodeSelectionBox: true, modifiers: "ctrl", multiple: true }));
            this.graph.use(new Keyboard({ enabled: true }));
            this.graph.use(new History({ enabled: true, beforeAddCommand: (event, args) => {
                // 忽略端口显隐导致的样式变更，避免污染历史
                if (args && args.key === "ports") return false;
                return true;
            }}));
            this.graph.use(new Snapline({ enabled: true, sharp: true }));
            this.graph.use(new Clipboard({ enabled: true }));
            this.graph.use(new Transform({ resizing: { enabled: true, minWidth: 80, minHeight: 40, maxWidth: 360, maxHeight: 200 } }));

            this.bindGraphEvents();
            this.bindKeyboard();
            // 兜底 resize
            setTimeout(() => {
                try {
                    const r2 = container.getBoundingClientRect();
                    if (r2.width > 0 && r2.height > 0) this.graph.resize(r2.width, r2.height);
                } catch (e) { /* ignore */ }
            }, 60);
        },

        createEdgeShape() {
            return new Shape.Edge({
                attrs: {
                    line: {
                        stroke: "#8c8c8c",
                        strokeWidth: 1.6,
                        targetMarker: { name: "block", width: 10, height: 8 }
                    }
                },
                router: { name: "manhattan" },
                connector: { name: "rounded", args: { radius: 6 } },
                zIndex: 0
            });
        },

        bindGraphEvents() {
            const g = this.graph;
            // hover 显示端口
            g.on("node:mouseenter", ({ node }) => this.togglePorts(node, true));
            g.on("node:mouseleave", ({ node }) => this.togglePorts(node, false));

            // 选中节点 / 边
            g.on("node:click", ({ node }) => this.selectNode(node));
            g.on("edge:click", ({ edge }) => this.selectEdge(edge));
            g.on("blank:click", () => { this.clearSelection(); });

            // 双击重命名
            g.on("node:dblclick", ({ node }) => {
                this.renameTargetId = node.id;
                this.renameText = node.attr("label/text") || "";
                this.renameVisible = true;
            });

            // 拖动/缩放后同步数据快照（不再用 renderGraphFromData 重建画布）
            g.on("node:added", () => this.refreshCurrentNodes());
            g.on("node:removed", () => this.refreshCurrentNodes());
            g.on("node:change:position", () => this.refreshCurrentNodes());
            g.on("edge:connected", () => this.refreshCurrentNodes());

            // 缩放变化
            g.on("scale", ({ sx }) => { this.zoom = sx; });
        },

        bindKeyboard() {
            const g = this.graph;
            g.bindKey(["delete", "backspace"], () => { this.deleteSelected(); return false; });
            g.bindKey(["ctrl+z", "command+z"], () => { this.undo(); return false; });
            g.bindKey(["ctrl+y", "ctrl+shift+z", "command+shift+z"], () => { this.redo(); return false; });
            g.bindKey(["ctrl+c", "command+c"], () => { this.onCopy(); return false; });
            g.bindKey(["ctrl+v", "command+v"], () => { this.onPaste(); return false; });
            g.bindKey(["ctrl+a", "command+a"], () => { g.select(g.getNodes()); return false; });
            g.bindKey(["ctrl+s", "command+s"], () => { this.onSave(); return false; });
        },

        togglePorts(node, visible) {
            const ports = node.getPorts();
            ports.forEach(p => {
                node.setPortProp(p.id, "attrs/circle/style/visibility", visible ? "visible" : "hidden");
            });
        },

        // ========== 节点 CRUD ==========
        // 关键修复：直接调用 graph.addNode，不再重建整张画布，彻底解决"拖错节点 / 多出一个"的 BUG
        addNodeToGraph(kind, x, y, label, refs, id, width, height) {
            const style = SHAPE_STYLE[kind] || SHAPE_STYLE.table;
            const nid = id || `n_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
            const node = this.graph.addNode({
                id: nid,
                shape: "rect",
                x: x ?? 100,
                y: y ?? 100,
                width: width || NODE_WIDTH,
                height: height || NODE_HEIGHT,
                attrs: {
                    body: {
                        fill: style.fill,
                        stroke: style.stroke,
                        strokeWidth: 1.6,
                        rx: 8, ry: 8,
                        strokeDasharray: kind === "note" ? "4,3" : null
                    },
                    label: {
                        text: label || (kind === "table" ? "新表" : kind === "engine" ? "新接口" : kind === "process" ? "新流程" : "注释"),
                        fontSize: 13,
                        fill: style.textColor,
                        fontWeight: 600
                    }
                },
                ports: PORTS_CONFIG,
                data: { kind, refs: refs || {}, code: "", description: "" }
            });
            return node;
        },

        addNodeFromToolbar(kind) {
            // 在画布中心偏移位置放置（避免重叠）
            const center = this.canvasCenter();
            const offset = (this.graph.getNodes().length % 8) * 28;
            this.addNodeToGraph(kind, center.x + offset, center.y + offset);
        },

        onStencilDrag(ev, kind) {
            ev.dataTransfer.effectAllowed = "copy";
            ev.dataTransfer.setData("application/x-blueprint-kind", kind);
        },

        onCanvasDrop(ev) {
            ev.preventDefault();
            const kind = ev.dataTransfer.getData("application/x-blueprint-kind");
            if (!kind) return;
            // 屏幕坐标 → 画布坐标（兼容 X6 v3）
            const pt = this.graph.clientToLocal({ x: ev.clientX, y: ev.clientY });
            this.addNodeToGraph(kind, pt.x - NODE_WIDTH / 2, pt.y - NODE_HEIGHT / 2);
        },

        canvasCenter() {
            const ts = this.graph.translate();
            const sc = this.graph.zoom();
            const w = (this.graph.options.width || 800) / sc;
            const h = (this.graph.options.height || 600) / sc;
            return { x: w / 2 - ts.tx / sc, y: h / 2 - ts.ty / sc };
        },

        // ========== 选中 / 编辑 ==========
        selectNode(node) {
            this.selectedEdge = null;
            this.selectedNodeId = node.id;
            const data = node.getData() || {};
            this.selectedNode = {
                id: node.id,
                shape: data.kind || "table",
                label: node.attr("label/text") || "",
                code: data.code || "",
                description: data.description || "",
                refs: this.normalizeRefs(data.refs)
            };
            this.selectedNodeRefsJson = JSON.stringify(this.selectedNode.refs, null, 2);
        },
        selectEdge(edge) {
            this.selectedNode = null;
            this.selectedNodeId = "";
            const labelText = edge.getLabels()?.[0]?.attrs?.label?.text || "";
            const data = edge.getData() || {};
            this.selectedEdge = {
                id: edge.id,
                label: labelText,
                description: data.description || ""
            };
        },
        clearSelection() {
            this.selectedNode = null;
            this.selectedEdge = null;
            this.selectedNodeId = "";
        },
        normalizeRefs(refs) {
            return Object.assign({ tables: [], fields: [], engines: [], menus: [], v8Events: [], dataSources: [] }, refs || {});
        },

        onLabelInput() {
            if (!this.selectedNode) return;
            const cell = this.graph.getCellById(this.selectedNode.id);
            if (cell) cell.attr("label/text", this.selectedNode.label);
        },
        syncRefsToCell() {
            if (!this.selectedNode) return;
            const cell = this.graph.getCellById(this.selectedNode.id);
            if (!cell) return;
            const data = cell.getData() || {};
            data.refs = { ...this.selectedNode.refs };
            data.code = this.selectedNode.code;
            data.description = this.selectedNode.description;
            cell.setData(data);
            this.selectedNodeRefsJson = JSON.stringify(this.selectedNode.refs, null, 2);
        },
        onRefsJsonChange() {
            try {
                const refs = JSON.parse(this.selectedNodeRefsJson || "{}");
                this.selectedNode.refs = this.normalizeRefs(refs);
                this.syncRefsToCell();
            } catch (e) {
                ElMessage.error("引用 JSON 格式错误：" + e.message);
            }
        },
        onEdgeLabelChange() {
            if (!this.selectedEdge) return;
            const edge = this.graph.getCellById(this.selectedEdge.id);
            if (!edge) return;
            const txt = this.selectedEdge.label || "";
            edge.setLabels(txt ? [{ attrs: { label: { text: txt, fontSize: 12, fill: "#555" } } }] : []);
        },

        confirmRename() {
            const cell = this.graph.getCellById(this.renameTargetId);
            if (cell) cell.attr("label/text", this.renameText);
            if (this.selectedNode && this.selectedNode.id === this.renameTargetId) {
                this.selectedNode.label = this.renameText;
            }
            this.renameVisible = false;
        },

        focusNode(id) {
            const cell = this.graph.getCellById(id);
            if (!cell) return;
            this.graph.cleanSelection();
            this.graph.select(cell);
            this.selectNode(cell);
            this.graph.centerCell(cell);
        },

        // ========== 工具栏功能 ==========
        undo() { if (this.graph.canUndo()) this.graph.undo(); },
        redo() { if (this.graph.canRedo()) this.graph.redo(); },
        zoomIn() { this.graph.zoom(0.1); this.zoom = this.graph.zoom(); },
        zoomOut() { this.graph.zoom(-0.1); this.zoom = this.graph.zoom(); },
        zoomToFit() {
            this.graph.zoomToFit({ padding: 30, maxScale: 1.5 });
            this.zoom = this.graph.zoom();
        },
        deleteSelected() {
            const cells = this.graph.getSelectedCells();
            if (cells.length) {
                this.graph.removeCells(cells);
                this.clearSelection();
            }
        },
        onCopy() {
            const cells = this.graph.getSelectedCells();
            if (cells.length) {
                this.graph.copy(cells, { deep: true });
                ElMessage.success(`已复制 ${cells.length} 个对象`);
            }
        },
        onPaste() {
            if (!this.graph.isClipboardEmpty()) {
                const cells = this.graph.paste({ offset: 32 });
                this.graph.cleanSelection();
                this.graph.select(cells);
            }
        },
        autoLayout() {
            // 简单网格布局：按节点数分行列
            const nodes = this.graph.getNodes();
            if (!nodes.length) return;
            const cols = Math.ceil(Math.sqrt(nodes.length));
            const gapX = 200, gapY = 100;
            nodes.forEach((n, i) => {
                const r = Math.floor(i / cols);
                const c = i % cols;
                n.position(80 + c * gapX, 80 + r * gapY, { silent: false });
            });
            setTimeout(() => this.zoomToFit(), 50);
        },

        // ========== 层切换 / 序列化 ==========
        switchLayer(layer) {
            if (layer === this.layer) return;
            this.persistGraphToData();
            this.layer = layer;
            this.renderLayerFromData();
            this.clearSelection();
        },

        persistGraphToData() {
            if (!this.graph) return;
            const nodes = this.graph.getNodes().map(n => {
                const pos = n.position();
                const size = n.size();
                const data = n.getData() || {};
                return {
                    id: n.id,
                    shape: data.kind || "table",
                    label: n.attr("label/text") || "",
                    x: pos.x, y: pos.y,
                    width: size.width, height: size.height,
                    code: data.code || "",
                    description: data.description || "",
                    refs: data.refs || {}
                };
            });
            const edges = this.graph.getEdges().map(e => {
                const label = e.getLabels()?.[0]?.attrs?.label?.text || "";
                return {
                    id: e.id,
                    source: e.getSourceCellId(),
                    target: e.getTargetCellId(),
                    sourcePort: e.getSourcePortId(),
                    targetPort: e.getTargetPortId(),
                    label,
                    description: (e.getData() || {}).description || ""
                };
            });
            this.diagrams[this.layer] = { nodes, edges };
        },

        renderLayerFromData() {
            if (!this.graph) return;
            this.graph.disableHistory();
            this.graph.clearCells();
            const data = this.diagrams[this.layer] || { nodes: [], edges: [] };
            const idMap = {};
            for (const n of data.nodes) {
                const cell = this.addNodeToGraph(n.shape, n.x, n.y, n.label, n.refs, n.id, n.width, n.height);
                const cellData = cell.getData() || {};
                cellData.code = n.code || "";
                cellData.description = n.description || "";
                cell.setData(cellData);
                idMap[n.id] = cell;
            }
            for (const e of data.edges) {
                if (idMap[e.source] && idMap[e.target]) {
                    const edgeOpts = {
                        id: e.id,
                        source: { cell: e.source, port: e.sourcePort || "port-right" },
                        target: { cell: e.target, port: e.targetPort || "port-left" },
                        attrs: {
                            line: {
                                stroke: "#8c8c8c", strokeWidth: 1.6,
                                targetMarker: { name: "block", width: 10, height: 8 }
                            }
                        },
                        router: { name: "manhattan" },
                        connector: { name: "rounded", args: { radius: 6 } },
                        data: { description: e.description || "" }
                    };
                    if (e.label) {
                        edgeOpts.labels = [{ attrs: { label: { text: e.label, fontSize: 12, fill: "#555" } } }];
                    }
                    this.graph.addEdge(edgeOpts);
                }
            }
            this.graph.enableHistory();
            this.refreshCurrentNodes();
        },

        refreshCurrentNodes() {
            if (!this.graph) return;
            this.currentNodes = this.graph.getNodes().map(n => {
                const data = n.getData() || {};
                return { id: n.id, shape: data.kind || "table", label: n.attr("label/text") || "" };
            });
        },

        // ========== 加载 / 保存 ==========
        async loadBlueprint(id) {
            const res = await BlueprintApi.get(id);
            if (res.Code !== 1) {
                ElMessage.error(res.Msg || "加载失败");
                return;
            }
            this.form = {
                Id: res.Data.Id, Name: res.Data.Name, Code: res.Data.Code || "",
                Description: res.Data.Description || "", Version: res.Data.Version || "1.0",
                Status: res.Data.Status ?? 1, ChangeSummary: ""
            };
            this.diagrams = {
                domain: { nodes: [], edges: [] },
                process: { nodes: [], edges: [] },
                behavior: { nodes: [], edges: [] }
            };
            try {
                const bd = res.Data.BlueprintData ? JSON.parse(res.Data.BlueprintData) : null;
                if (bd && Array.isArray(bd.diagrams)) {
                    for (const d of bd.diagrams) {
                        const layerKey = Object.keys(LAYER_CONFIG).find(k => LAYER_CONFIG[k].diagramId === d.id);
                        if (layerKey) {
                            this.diagrams[layerKey] = { nodes: d.nodes || [], edges: d.edges || [] };
                        }
                    }
                }
            } catch (e) { console.warn("BlueprintData parse failed:", e); }
            this.renderLayerFromData();
        },

        buildPayload() {
            this.persistGraphToData();
            return {
                ...this.form,
                BlueprintData: JSON.stringify({
                    diagrams: Object.keys(LAYER_CONFIG).map(k => ({
                        id: LAYER_CONFIG[k].diagramId,
                        type: k,
                        name: LAYER_CONFIG[k].label,
                        nodes: this.diagrams[k].nodes,
                        edges: this.diagrams[k].edges
                    }))
                })
            };
        },

        async onSave() {
            if (!this.form.Name) { ElMessage.warning("请填写蓝图名称"); return; }
            const payload = this.buildPayload();
            const res = await BlueprintApi.save(payload);
            if (res.Code === 1) {
                this.form.Id = res.Data?.Id || this.form.Id;
                this.form.ChangeSummary = "";
                ElMessage.success("保存成功");
            } else {
                ElMessage.error(res.Msg || "保存失败");
            }
        },

        async onValidate() {
            if (!this.form.Id) { ElMessage.warning("请先保存"); return; }
            const res = await BlueprintApi.validate(this.form.Id);
            if (res.Code === 1) {
                this.validateResult = res.Data;
                this.validateVisible = true;
            } else {
                ElMessage.error(res.Msg || "验证失败");
            }
        },

        async openHistory() {
            if (!this.form.Id) { ElMessage.warning("请先保存蓝图"); return; }
            this.historyVisible = true;
            await this.loadHistoryPage(1);
        },

        async loadHistoryPage(page = 1) {
            if (!this.form.Id) return;
            this.historyLoading = true;
            try {
                const res = await BlueprintApi.listHistory(this.form.Id, page, this.historyPageSize);
                if (res.Code !== 1) {
                    ElMessage.error(res.Msg || "读取历史失败");
                    return;
                }
                this.historyItems = res.Data?.Items || [];
                this.historyTotal = Number(res.Data?.DataCount || 0);
                this.historyPage = Number(res.Data?.PageIndex || page);
                this.currentHash = res.Data?.CurrentHash || "";
            } catch (e) {
                ElMessage.error("读取历史失败：" + e.message);
            } finally {
                this.historyLoading = false;
            }
        },

        async compareHistory(row) {
            const res = await BlueprintApi.compare(this.form.Id, row.Id);
            if (res.Code !== 1) {
                ElMessage.error(res.Msg || "比较失败");
                return;
            }
            this.diffResult = res.Data;
            this.diffVisible = true;
        },

        async viewHistory(row) {
            const res = await BlueprintApi.getHistory(this.form.Id, row.Id);
            if (res.Code !== 1) {
                ElMessage.error(res.Msg || "读取历史快照失败");
                return;
            }
            try {
                const data = res.Data || {};
                const blueprintData = data.BlueprintData ? JSON.parse(data.BlueprintData) : null;
                this.historyDetailText = JSON.stringify({
                    Id: data.Id,
                    Version: data.Version,
                    ChangeSummary: data.ChangeSummary,
                    CreateTime: data.CreateTime,
                    CreateUserName: data.CreateUserName,
                    ContentHash: data.ContentHash,
                    BlueprintData: blueprintData
                }, null, 2);
            } catch (e) {
                this.historyDetailText = String(res.Data?.BlueprintData || "");
            }
            this.historyDetailVisible = true;
        },

        async confirmRollback(row) {
            if (!this.currentHash) {
                await this.loadHistoryPage(this.historyPage);
                if (!this.currentHash) return;
            }
            try {
                await ElMessageBox.confirm(
                    `将当前蓝图回滚到版本 ${row.Version || "-"}。系统会先保存当前快照，历史记录不会被修改。`,
                    "确认回滚蓝图",
                    {
                        type: "warning",
                        confirmButtonText: "回滚并保留当前快照",
                        cancelButtonText: "取消",
                        autofocus: false
                    }
                );
            } catch (e) {
                return;
            }
            this.rollbackLoadingId = row.Id;
            try {
                const res = await BlueprintApi.rollback(this.form.Id, row.Id, this.currentHash, {
                    newVersion: row.Version || this.form.Version || "1.0",
                    changeSummary: `设计器回滚到历史版本 ${row.Version || "-"}`
                });
                if (res.Code !== 1) {
                    ElMessage.error(res.Msg || "回滚失败");
                    await this.loadHistoryPage(this.historyPage);
                    return;
                }
                ElMessage.success("回滚成功，回滚前内容已自动保存为历史快照");
                await this.loadBlueprint(this.form.Id);
                await this.loadHistoryPage(1);
            } catch (e) {
                ElMessage.error("回滚失败：" + e.message);
            } finally {
                this.rollbackLoadingId = "";
            }
        },

        applyJson() {
            try {
                const obj = JSON.parse(this.jsonText);
                if (obj.BlueprintData) {
                    const bd = typeof obj.BlueprintData === "string" ? JSON.parse(obj.BlueprintData) : obj.BlueprintData;
                    if (Array.isArray(bd.diagrams)) {
                        for (const d of bd.diagrams) {
                            const layerKey = Object.keys(LAYER_CONFIG).find(k => LAYER_CONFIG[k].diagramId === d.id);
                            if (layerKey) {
                                this.diagrams[layerKey] = { nodes: d.nodes || [], edges: d.edges || [] };
                            }
                        }
                    }
                    if (obj.Name) this.form.Name = obj.Name;
                    if (obj.Code) this.form.Code = obj.Code;
                }
                this.renderLayerFromData();
                this.showJsonDialog = false;
                ElMessage.success("已应用 JSON");
            } catch (e) {
                ElMessage.error("JSON 解析失败：" + e.message);
            }
        },

        async loadResourceCache() {
            // 异步预拉 diy_table / sys_apiengine / sys_menu 名称列表，给资源引用下拉用
            try {
                const { DiyCommon } = await import("@/utils/diy.common");
                const wrap = (url, params) => new Promise(r => { try { DiyCommon.Post(url, params || {}, r); } catch (e) { r({ Code: 0 }); } });
                const [tableRes, menuRes, engineRes] = await Promise.all([
                    DiyCommon.FormEngine.GetTableData("diy_table", {
                        _SelectFields: ["Id", "Name", "Description"],
                        _Where: [["IsDeleted", "<>", 1]],
                        _OrderBy: "Name",
                        _OrderByType: "ASC",
                        _PageSize: 500
                    }),
                    DiyCommon.FormEngine.GetTableData("sys_menu", {
                        _SelectFields: ["Id", "Name"],
                        _Where: [["IsDeleted", "<>", 1]],
                        _OrderBy: "Name",
                        _OrderByType: "ASC",
                        _PageSize: 500
                    }),
                    wrap("/api/V8Engine/GetApiEngineList", {})
                ]);
                if (tableRes?.Code === 1 && Array.isArray(tableRes.Data)) {
                    this.resourceCache.tables = tableRes.Data.map(t => t.Name || t.name).filter(Boolean);
                }
                if (menuRes?.Code === 1 && Array.isArray(menuRes.Data)) {
                    this.resourceCache.menus = menuRes.Data.map(m => m.Name || m.name || m.Id || m.id).filter(Boolean);
                }
                const engineRows = Array.isArray(engineRes?.Data)
                    ? engineRes.Data
                    : (Array.isArray(engineRes?.Data?.List) ? engineRes.Data.List : []);
                if (engineRes?.Code === 1) {
                    this.resourceCache.engines = engineRows.map(e => e.ApiEngineKey || e.apiEngineKey).filter(Boolean);
                }
            } catch (e) { /* 静默 */ }
        }
    },
    watch: {
        showJsonDialog(v) {
            if (v) {
                const p = this.buildPayload();
                this.jsonText = JSON.stringify({ Name: p.Name, Code: p.Code, BlueprintData: JSON.parse(p.BlueprintData) }, null, 2);
            }
        }
    }
};
</script>

<style scoped>
.blueprint-designer {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: calc(100vh - 100px);
    background: #fff;
}

.toolbar {
    padding: 8px 12px;
    background: #fff;
    border-bottom: 1px solid #ebeef5;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
}

.zoom-tip {
    margin-left: auto;
    color: #909399;
    font-size: 12px;
}

.canvas-wrapper {
    flex: 1;
    display: flex;
    overflow: hidden;
    min-height: 600px;
}

.stencil {
    width: 200px;
    background: #fafbfc;
    border-right: 1px solid #ebeef5;
    padding: 10px;
    overflow-y: auto;
}

.stencil-title {
    font-size: 12px;
    color: #303133;
    font-weight: 600;
    margin: 4px 0;
}

.stencil-hint {
    font-size: 11px;
    color: #909399;
    margin-bottom: 8px;
}

.stencil-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 6px;
    cursor: grab;
    margin-bottom: 4px;
    background: #fff;
    border: 1px dashed #dcdfe6;
    transition: all 0.15s;
    user-select: none;
}

.stencil-item:hover {
    border-color: #409eff;
    background: #ecf5ff;
}

.stencil-item:active {
    cursor: grabbing;
}

.stencil-preview {
    width: 40px;
    height: 26px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 600;
    color: #333;
}

.node-list {
    max-height: 360px;
    overflow-y: auto;
}

.node-list-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 6px;
    font-size: 12px;
    cursor: pointer;
    border-radius: 4px;
}

.node-list-item:hover {
    background: #ecf5ff;
}

.node-list-item.active {
    background: #d9ecff;
    color: #409eff;
    font-weight: 600;
}

.node-list-kind {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 10px;
    color: #555;
}

.graph-container {
    flex: 1;
    min-height: 500px;
    height: 100%;
    position: relative;
    overflow: hidden;
}

.side-panel {
    width: 320px;
    border-left: 1px solid #ebeef5;
    padding: 12px;
    overflow-y: auto;
    background: #fff;
}

.prop-panel h4 {
    margin: 6px 0 12px;
    color: #303133;
}

.prop-panel-empty {
    text-align: center;
    color: #909399;
    padding-top: 20px;
}

.prop-panel-empty .el-icon {
    font-size: 36px;
    color: #c0c4cc;
}

.usage-tips {
    list-style: none;
    padding: 0;
    text-align: left;
    font-size: 12px;
    line-height: 1.8;
    color: #606266;
}

.usage-tips kbd {
    background: #f4f4f5;
    border: 1px solid #dcdfe6;
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 11px;
    font-family: Consolas, monospace;
}

.result-list {
    margin-top: 12px;
    padding-left: 20px;
}

.result-error { color: #f56c6c; margin: 4px 0; }
.result-warn { color: #e6a23c; margin: 4px 0; }

.history-summary,
.diff-summary {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 14px;
}

.history-summary > div {
    display: flex;
    align-items: center;
    gap: 6px;
}

.history-label,
.history-bytes {
    color: #909399;
    font-size: 12px;
}

.history-pagination {
    display: flex;
    justify-content: flex-end;
    margin-top: 14px;
}

.diff-panel {
    min-height: 180px;
}

.diff-summary > span {
    color: #606266;
    font-size: 13px;
}

.diff-summary .diff-truncated {
    color: #e6a23c;
}

.diff-value {
    margin: 0;
    max-height: 140px;
    overflow: auto;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font: 12px/1.5 Consolas, "Microsoft YaHei", monospace;
    color: #303133;
}

@media (max-width: 900px) {
    .toolbar .el-input {
        max-width: calc(50vw - 20px);
    }
    .history-summary {
        align-items: flex-start;
        flex-direction: column;
    }
}
</style>
