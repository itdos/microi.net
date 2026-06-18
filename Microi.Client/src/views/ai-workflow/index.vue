<template>
    <div class="aiwf-page">
        <header class="aiwf-toolbar">
            <div class="aiwf-title">
                <el-icon><Connection /></el-icon>
                <span>AI工作流总览</span>
                <el-tag size="small" effect="plain">{{ overview?.OsClient || "Current" }}</el-tag>
            </div>
            <div class="aiwf-tools">
                <el-input
                    v-model="keyword"
                    clearable
                    class="aiwf-search"
                    placeholder="搜索表、菜单、接口、流程"
                    :prefix-icon="Search"
                    @keyup.enter="loadOverview(true)"
                />
                <el-switch
                    v-model="showEventNodes"
                    inline-prompt
                    active-text="V8节点"
                    inactive-text="主干图"
                    @change="loadOverview(true)"
                />
                <el-select
                    v-model="selectedSavedId"
                    class="aiwf-saved"
                    filterable
                    clearable
                    placeholder="已保存"
                    @change="loadSavedFlow"
                >
                    <el-option
                        v-for="item in savedFlows"
                        :key="item.Id"
                        :label="item.Name"
                        :value="item.Id"
                    />
                </el-select>
                <el-button :icon="Refresh" :loading="loading" @click="loadOverview(true)">刷新</el-button>
                <el-button type="primary" :icon="MagicStick" @click="promptDialogVisible = true">AI描述生成</el-button>
                <el-button :icon="DocumentChecked" :disabled="!graphData.Nodes.length" @click="openSaveDialog">保存</el-button>
            </div>
        </header>

        <section class="aiwf-statbar">
            <div v-for="item in statItems" :key="item.key" class="aiwf-stat">
                <span>{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
            </div>
        </section>

        <section class="aiwf-workbench">
            <aside class="aiwf-resource-panel">
                <div class="aiwf-panel-header">
                    <span>资源</span>
                    <el-input
                        v-model="resourceKeyword"
                        size="small"
                        clearable
                        placeholder="筛选"
                        :prefix-icon="Search"
                    />
                </div>
                <el-tabs v-model="resourceTab" class="aiwf-tabs">
                    <el-tab-pane label="表" name="tables" />
                    <el-tab-pane label="菜单" name="menus" />
                    <el-tab-pane label="接口" name="engines" />
                    <el-tab-pane label="流程" name="workflows" />
                </el-tabs>
                <div class="aiwf-resource-list">
                    <button
                        v-for="item in resourceList"
                        :key="item.__id"
                        class="aiwf-resource-item"
                        type="button"
                        @click="focusResource(item)"
                    >
                        <span class="aiwf-dot" :class="'is-' + item.__type" />
                        <span class="aiwf-resource-main">
                            <strong>{{ item.__label }}</strong>
                            <small>{{ item.__sub || "-" }}</small>
                        </span>
                    </button>
                </div>
            </aside>

            <main ref="canvasWrap" class="aiwf-canvas-wrap">
                <div class="aiwf-canvas-toolbar">
                    <el-button-group>
                        <el-tooltip content="放大" placement="bottom">
                            <el-button :icon="ZoomIn" @click="zoomIn" />
                        </el-tooltip>
                        <el-tooltip content="缩小" placement="bottom">
                            <el-button :icon="ZoomOut" @click="zoomOut" />
                        </el-tooltip>
                        <el-tooltip content="适应画布" placement="bottom">
                            <el-button :icon="FullScreen" @click="zoomToFit" />
                        </el-tooltip>
                    </el-button-group>
                    <el-tag size="small" effect="plain">{{ graphData.Nodes.length }} 节点 / {{ graphData.Edges.length }} 连线</el-tag>
                </div>
                <div ref="graphContainer" class="aiwf-graph" />
                <div v-if="selectedNode" class="aiwf-node-bubbles" :style="actionStyle">
                    <el-tooltip content="详情" placement="top">
                        <el-button circle :icon="View" @click="showDetail('overview')" />
                    </el-tooltip>
                    <el-tooltip content="字段" placement="top">
                        <el-button circle :icon="Tickets" @click="showDetail('fields')" />
                    </el-tooltip>
                    <el-tooltip content="V8" placement="top">
                        <el-button circle :icon="Cpu" @click="showDetail('v8')" />
                    </el-tooltip>
                    <el-tooltip content="调用" placement="top">
                        <el-button circle :icon="Share" @click="showDetail('calls')" />
                    </el-tooltip>
                    <el-tooltip content="流程" placement="top">
                        <el-button circle :icon="Operation" @click="showDetail('workflow')" />
                    </el-tooltip>
                </div>
            </main>
        </section>

        <el-drawer
            v-model="detailVisible"
            class="aiwf-detail-drawer"
            direction="rtl"
            size="430px"
            :with-header="false"
        >
            <template v-if="selectedNode">
                <div class="aiwf-detail-head">
                    <span class="aiwf-node-type" :class="'is-' + selectedNode.Type">{{ typeLabel(selectedNode.Type) }}</span>
                    <h3>{{ selectedNode.Label }}</h3>
                    <p>{{ selectedNode.Key || selectedNode.Description || "-" }}</p>
                </div>
                <div v-if="detailLoading" class="aiwf-loading">
                    <el-skeleton :rows="8" animated />
                </div>
                <el-tabs v-else v-model="activeDetail" class="aiwf-detail-tabs">
                    <el-tab-pane label="概览" name="overview">
                        <div class="aiwf-kv">
                            <span>类型</span><strong>{{ selectedNode.Type }}</strong>
                            <span>编码</span><strong>{{ selectedNode.Key || "-" }}</strong>
                            <span>说明</span><strong>{{ selectedNode.Description || "-" }}</strong>
                        </div>
                        <div class="aiwf-mini-grid">
                            <div v-for="(value, key) in selectedNode.Stats" :key="key">
                                <span>{{ key }}</span>
                                <strong>{{ value }}</strong>
                            </div>
                        </div>
                    </el-tab-pane>
                    <el-tab-pane label="字段" name="fields">
                        <div class="aiwf-field-list">
                            <div v-for="field in selectedFields" :key="field.Id || field.Name" class="aiwf-field">
                                <strong>{{ field.Label || field.Name }}</strong>
                                <span>{{ field.Name }} · {{ field.Component || field.Type || "-" }}</span>
                            </div>
                            <el-empty v-if="!selectedFields.length" :image-size="80" description="无字段明细" />
                        </div>
                    </el-tab-pane>
                    <el-tab-pane label="V8" name="v8">
                        <div class="aiwf-event-list">
                            <div v-for="(event, index) in selectedEvents" :key="`${event.EventType}_${index}`" class="aiwf-event">
                                <div class="aiwf-event-title">
                                    <strong>{{ event.EventName || event.EventType }}</strong>
                                    <el-tag v-if="event.ApiCalls?.length" size="small" type="success">{{ event.ApiCalls.length }} 调用</el-tag>
                                </div>
                                <pre v-if="event.Code">{{ event.Code }}</pre>
                                <span v-else>未配置</span>
                            </div>
                            <el-empty v-if="!selectedEvents.length" :image-size="80" description="无V8事件" />
                        </div>
                    </el-tab-pane>
                    <el-tab-pane label="调用" name="calls">
                        <div class="aiwf-call-list">
                            <div v-for="key in selectedApiCalls" :key="key" class="aiwf-call">
                                <el-icon><Cpu /></el-icon>
                                <span>{{ key }}</span>
                            </div>
                            <el-empty v-if="!selectedApiCalls.length" :image-size="80" description="无接口调用" />
                        </div>
                    </el-tab-pane>
                    <el-tab-pane label="流程" name="workflow">
                        <div class="aiwf-field-list">
                            <div v-for="node in selectedWorkflowNodes" :key="node.Id || node.FlowName || node.LineName" class="aiwf-field">
                                <strong>{{ node.FlowName || node.NodeName || node.LineName }}</strong>
                                <span>{{ node.NodeType || node.LineValue || node.Category || "-" }}</span>
                            </div>
                            <el-empty v-if="!selectedWorkflowNodes.length" :image-size="80" description="无流程明细" />
                        </div>
                    </el-tab-pane>
                </el-tabs>
            </template>
        </el-drawer>

        <el-dialog v-model="promptDialogVisible" title="AI描述生成" width="620px">
            <el-input
                v-model="prompt"
                type="textarea"
                :rows="6"
                placeholder="例如：生成采购到付款的业务工作流，并突出供应商、采购订单、入库、付款相关接口"
            />
            <template #footer>
                <el-button @click="promptDialogVisible = false">取消</el-button>
                <el-button type="primary" :loading="generating" :icon="MagicStick" @click="generateFromPrompt">生成</el-button>
            </template>
        </el-dialog>

        <el-dialog v-model="saveDialogVisible" title="保存AI工作流" width="520px">
            <el-form label-width="88px">
                <el-form-item label="名称">
                    <el-input v-model="saveForm.Name" />
                </el-form-item>
                <el-form-item label="编码">
                    <el-input v-model="saveForm.Code" placeholder="AIWF_xxx" />
                </el-form-item>
                <el-form-item label="说明">
                    <el-input v-model="saveForm.Description" type="textarea" :rows="3" />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="saveDialogVisible = false">取消</el-button>
                <el-button type="primary" :loading="saving" :icon="DocumentChecked" @click="saveCurrentFlow">保存</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script>
import { Graph } from "@antv/x6";
import "@antv/x6/dist/index.css";
import {
    Connection,
    Cpu,
    DocumentChecked,
    FullScreen,
    MagicStick,
    Operation,
    Refresh,
    Search,
    Share,
    Tickets,
    View,
    ZoomIn,
    ZoomOut
} from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import AiWorkFlowApi from "./api";

const TYPE_STYLE = {
    menu: { fill: "#eef6ff", stroke: "#2f80ed", text: "#1b4f9c" },
    table: { fill: "#eefaf4", stroke: "#2fa36b", text: "#17613d" },
    field: { fill: "#fff8e8", stroke: "#d69b24", text: "#7a520a" },
    "v8-event": { fill: "#f4f1ff", stroke: "#7c6ee6", text: "#4c3dad" },
    engine: { fill: "#eef7f8", stroke: "#1e9aa6", text: "#11636b" },
    "engine-missing": { fill: "#fff0f0", stroke: "#d94c4c", text: "#9b2020" },
    workflow: { fill: "#f2f5ff", stroke: "#526be0", text: "#2d3d9b" },
    page: { fill: "#f6f7f9", stroke: "#7b8494", text: "#3d4655" },
    print: { fill: "#f8f3ee", stroke: "#b7773c", text: "#754318" }
};

export default {
    name: "AiWorkFlowIndex",
    components: {
        Connection,
        Cpu
    },
    data() {
        return {
            Search,
            Refresh,
            MagicStick,
            DocumentChecked,
            ZoomIn,
            ZoomOut,
            FullScreen,
            View,
            Tickets,
            Cpu,
            Share,
            Operation,
            loading: false,
            detailLoading: false,
            generating: false,
            saving: false,
            keyword: "",
            resourceKeyword: "",
            resourceTab: "tables",
            showEventNodes: false,
            overview: null,
            graphData: { Nodes: [], Edges: [] },
            graph: null,
            resizeObserver: null,
            selectedNode: null,
            selectedCell: null,
            detailVisible: false,
            activeDetail: "overview",
            actionStyle: { left: "24px", top: "72px" },
            promptDialogVisible: false,
            prompt: "",
            saveDialogVisible: false,
            saveForm: {
                Name: "",
                Code: "",
                Description: ""
            },
            savedFlows: [],
            selectedSavedId: ""
        };
    },
    computed: {
        statItems() {
            const stats = this.overview?.Stats || {};
            const elapsed = this.overview?.ElapsedMs ? `${this.overview.ElapsedMs}ms` : "-";
            return [
                { key: "tables", label: "表", value: stats.TableCount || 0 },
                { key: "menus", label: "菜单", value: stats.MenuCount || 0 },
                { key: "engines", label: "接口", value: stats.ApiEngineCount || 0 },
                { key: "flows", label: "流程", value: stats.WorkflowCount || 0 },
                { key: "nodes", label: "节点", value: stats.GraphNodeCount || this.graphData.Nodes.length },
                { key: "elapsed", label: "耗时", value: elapsed }
            ];
        },
        inventory() {
            return this.overview?.Inventory || {};
        },
        resourceList() {
            const map = {
                tables: this.normalizeResource(this.inventory.Tables, "table", "Name", "Description"),
                menus: this.normalizeResource(this.inventory.Menus, "menu", "Name", "ComponentPath"),
                engines: this.normalizeResource(this.inventory.ApiEngines, "engine", "ApiName", "ApiEngineKey"),
                workflows: this.normalizeResource(this.inventory.Workflows, "workflow", "FlowName", "Category")
            };
            const list = map[this.resourceTab] || [];
            const kw = (this.resourceKeyword || "").trim().toLowerCase();
            if (!kw) return list;
            return list.filter(item => `${item.__label} ${item.__sub}`.toLowerCase().includes(kw));
        },
        selectedFields() {
            return this.selectedNode?.Details?.Fields || [];
        },
        selectedEvents() {
            const details = this.selectedNode?.Details || {};
            const events = [];
            const pushEvents = list => (list || []).forEach(item => {
                if (item.HasCode || item.Code) events.push(item);
            });
            pushEvents(details.Events);
            pushEvents(details.MenuEvents);
            pushEvents(details.ButtonEvents);
            pushEvents(details.WorkflowEvents);
            (details.FieldEvents || []).forEach(item => events.push({
                ...item,
                EventName: `${item.FieldLabel || item.FieldName}.${item.EventType}`
            }));
            return events;
        },
        selectedApiCalls() {
            const set = new Set();
            this.selectedEvents.forEach(item => {
                (item.ApiCalls || []).forEach(key => set.add(key));
            });
            (this.selectedNode?.Details?.ApiCalls || []).forEach(key => set.add(key));
            return Array.from(set).sort();
        },
        selectedWorkflowNodes() {
            const details = this.selectedNode?.Details || {};
            return [
                ...(details.Workflows || []),
                ...(details.WorkflowNodes || []),
                ...(details.WorkflowLines || [])
            ];
        }
    },
    mounted() {
        this.initGraph();
        this.loadSavedList();
        this.loadOverview();
    },
    beforeUnmount() {
        if (this.resizeObserver) this.resizeObserver.disconnect();
        if (this.graph) this.graph.dispose();
    },
    methods: {
        async loadOverview(forceRefresh = false) {
            this.loading = true;
            try {
                const result = await AiWorkFlowApi.overview({
                    Keyword: this.keyword,
                    Lite: !this.showEventNodes,
                    IncludeEventNodes: this.showEventNodes,
                    IncludeFieldNodes: false,
                    IncludeInventoryDetails: false,
                    IncludePeripheralNodes: false,
                    Refresh: forceRefresh === true
                });
                if (this.isOk(result)) {
                    this.applyOverview(result.Data || {});
                } else {
                    ElMessage.error(result.Msg || "生成AI工作流失败");
                }
            } catch (e) {
                ElMessage.error(e?.message || "生成AI工作流失败");
            } finally {
                this.loading = false;
            }
        },
        async loadSavedList() {
            try {
                const result = await AiWorkFlowApi.list("");
                if (this.isOk(result)) this.savedFlows = result.Data || [];
            } catch (e) {
                console.warn("[AIWorkFlow] load saved list failed", e);
            }
        },
        async loadSavedFlow(id) {
            if (!id) return;
            this.loading = true;
            try {
                const result = await AiWorkFlowApi.get(id);
                if (!this.isOk(result)) {
                    ElMessage.error(result.Msg || "读取已保存工作流失败");
                    return;
                }
                const row = result.Data || {};
                const payload = this.safeJson(row.BlueprintData, {});
                const graph = payload.graph || payload.Graph || {};
                this.applyOverview({
                    OsClient: row.OsClient,
                    GeneratedAt: row.UpdateTime,
                    Graph: graph,
                    Inventory: payload.inventory || payload.Inventory || {},
                    Stats: this.countStats(graph)
                });
                this.saveForm = {
                    Name: row.Name || "",
                    Code: row.Code || "",
                    Description: row.Description || ""
                };
            } finally {
                this.loading = false;
            }
        },
        applyOverview(data) {
            this.overview = data;
            this.graphData = data.Graph || { Nodes: [], Edges: [] };
            this.selectedNode = null;
            this.selectedCell = null;
            this.detailVisible = false;
            this.activeDetail = "overview";
            this.$nextTick(() => this.renderGraph());
        },
        initGraph() {
            if (!this.$refs.graphContainer || this.graph) return;
            this.graph = new Graph({
                container: this.$refs.graphContainer,
                autoResize: true,
                grid: false,
                panning: {
                    enabled: true,
                    eventTypes: ["leftMouseDown", "rightMouseDown", "mouseWheel"]
                },
                mousewheel: {
                    enabled: true,
                    minScale: 0.2,
                    maxScale: 1.8,
                    factor: 1.08
                },
                interacting: {
                    nodeMovable: false,
                    edgeMovable: false,
                    magnetConnectable: false
                },
                connecting: {
                    router: "normal",
                    connector: "normal"
                }
            });
            this.graph.on("node:click", ({ node }) => this.selectGraphNode(node));
            this.graph.on("blank:click", () => this.clearSelection());
            this.graph.on("scale", () => this.updateActionPosition());
            this.graph.on("translate", () => this.updateActionPosition());
            if (window.ResizeObserver) {
                this.resizeObserver = new ResizeObserver(() => {
                    if (this.graph) this.graph.resize();
                });
                this.resizeObserver.observe(this.$refs.graphContainer);
            }
        },
        renderGraph() {
            this.initGraph();
            if (!this.graph) return;
            const nodes = this.graphData.Nodes || [];
            const nodeIds = new Set(nodes.map(item => item.Id));
            const cells = [
                ...nodes.map(item => this.nodeToCell(item)),
                ...(this.graphData.Edges || [])
                    .filter(edge => nodeIds.has(edge.Source) && nodeIds.has(edge.Target))
                    .map(edge => this.edgeToCell(edge))
            ];
            if (this.graph.freeze) this.graph.freeze();
            this.graph.clearCells({ silent: true });
            this.graph.fromJSON({ cells });
            if (this.graph.unfreeze) this.graph.unfreeze();
            window.requestAnimationFrame(() => this.zoomToFit());
        },
        nodeToCell(node) {
            const style = TYPE_STYLE[node.Type] || TYPE_STYLE.table;
            return {
                id: node.Id,
                shape: "rect",
                x: node.X || 80,
                y: node.Y || 60,
                width: node.Width || 180,
                height: node.Height || 54,
                data: node,
                attrs: {
                    body: {
                        rx: 6,
                        ry: 6,
                        fill: style.fill,
                        stroke: style.stroke,
                        strokeWidth: 1.2,
                        magnet: false
                    },
                    label: {
                        text: this.nodeLabel(node),
                        fill: style.text,
                        fontSize: 11,
                        fontWeight: 600,
                        refX: 10,
                        refY: 0.5,
                        textAnchor: "start",
                        textVerticalAnchor: "middle"
                    }
                }
            };
        },
        edgeToCell(edge) {
            return {
                id: edge.Id,
                shape: "edge",
                source: edge.Source,
                target: edge.Target,
                router: { name: "normal" },
                connector: { name: "normal" },
                labels: [],
                attrs: {
                    line: {
                        stroke: this.edgeColor(edge.Type),
                        strokeWidth: edge.Type === "api-call" ? 1.4 : 1,
                        targetMarker: {
                            name: "block",
                            width: 7,
                            height: 5
                        }
                    }
                },
                data: edge
            };
        },
        selectGraphNode(cell) {
            if (this.selectedCell && this.selectedCell.id !== cell.id) {
                this.resetCellStroke(this.selectedCell);
            }
            this.selectedCell = cell;
            this.selectedNode = cell.getData();
            this.activeDetail = "overview";
            this.detailVisible = true;
            cell.attr("body/stroke", "#f59e0b");
            cell.attr("body/strokeWidth", 2.4);
            this.updateActionPosition();
            this.loadNodeDetail(cell);
        },
        async loadNodeDetail(cell) {
            const data = cell?.getData?.() || {};
            if (!data.Type || data.DetailLoaded) return;
            const targetId = cell.id;
            this.detailLoading = true;
            try {
                const result = await AiWorkFlowApi.nodeDetail({
                    NodeType: data.Type,
                    NodeId: data.Resource?.Id || data.Id,
                    Key: data.Key
                });
                if (!this.isOk(result)) {
                    ElMessage.error(result.Msg || "读取节点详情失败");
                    return;
                }
                if (!this.selectedCell || this.selectedCell.id !== targetId) return;
                const payload = result.Data || {};
                const next = {
                    ...data,
                    Resource: { ...(data.Resource || {}), ...(payload.Resource || {}) },
                    Stats: { ...(data.Stats || {}), ...(payload.Stats || {}) },
                    Details: { ...(data.Details || {}), ...(payload.Details || {}) },
                    DetailLoaded: true
                };
                cell.setData(next);
                this.selectedNode = next;
                const index = (this.graphData.Nodes || []).findIndex(item => item.Id === next.Id);
                if (index >= 0) this.graphData.Nodes.splice(index, 1, next);
            } catch (e) {
                ElMessage.error(e?.message || "读取节点详情失败");
            } finally {
                if (this.selectedCell?.id === targetId) this.detailLoading = false;
            }
        },
        showDetail(tab) {
            this.activeDetail = tab;
            this.detailVisible = true;
            if (this.selectedCell) this.loadNodeDetail(this.selectedCell);
        },
        clearSelection() {
            if (this.selectedCell) this.resetCellStroke(this.selectedCell);
            this.selectedCell = null;
            this.selectedNode = null;
            this.detailVisible = false;
        },
        resetCellStroke(cell) {
            const data = cell.getData() || {};
            const style = TYPE_STYLE[data.Type] || TYPE_STYLE.table;
            cell.attr("body/stroke", style.stroke);
            cell.attr("body/strokeWidth", 1.2);
        },
        updateActionPosition() {
            if (!this.selectedCell || !this.$refs.canvasWrap || !this.graph) return;
            try {
                const bbox = this.selectedCell.getBBox();
                const point = this.graph.localToClient({
                    x: bbox.x + bbox.width + 8,
                    y: bbox.y + 2
                });
                const rect = this.$refs.canvasWrap.getBoundingClientRect();
                this.actionStyle = {
                    left: `${Math.max(14, Math.min(point.x - rect.left, rect.width - 238))}px`,
                    top: `${Math.max(54, Math.min(point.y - rect.top, rect.height - 76))}px`
                };
            } catch (e) {
                this.actionStyle = { left: "24px", top: "72px" };
            }
        },
        focusResource(item) {
            this.focusNode(this.resourceToNodeId(item));
        },
        focusNode(id) {
            if (!this.graph || !id) return;
            const cell = this.graph.getCellById(id);
            if (!cell) return;
            this.graph.centerCell(cell);
            this.selectGraphNode(cell);
        },
        resourceToNodeId(item) {
            if (item.__type === "engine") return this.makeNodeId("engine", item.ApiEngineKey || item.Id);
            if (item.__type === "workflow") return this.makeNodeId("workflow", item.Id);
            if (item.__type === "menu") return this.makeNodeId("menu", item.Id);
            return this.makeNodeId("table", item.Id || item.Name);
        },
        zoomIn() {
            if (this.graph) this.graph.zoom(0.12);
        },
        zoomOut() {
            if (this.graph) this.graph.zoom(-0.12);
        },
        zoomToFit() {
            if (!this.graph || !this.graphData.Nodes?.length) return;
            try {
                this.graph.zoomToFit({ padding: 36, maxScale: 0.95 });
                this.graph.centerContent();
                this.updateActionPosition();
            } catch (e) {
                console.warn("[AIWorkFlow] zoomToFit failed", e);
            }
        },
        async generateFromPrompt() {
            if (!this.prompt.trim()) {
                ElMessage.warning("请输入描述");
                return;
            }
            this.generating = true;
            try {
                const result = await AiWorkFlowApi.generateFromPrompt({
                    Prompt: this.prompt,
                    Lite: !this.showEventNodes,
                    IncludeEventNodes: this.showEventNodes,
                    IncludeFieldNodes: false,
                    IncludeInventoryDetails: false,
                    IncludePeripheralNodes: false
                });
                if (this.isOk(result)) {
                    this.applyOverview(result.Data || {});
                    this.promptDialogVisible = false;
                    ElMessage.success("已生成AI工作流");
                } else {
                    ElMessage.error(result.Msg || "生成失败");
                }
            } finally {
                this.generating = false;
            }
        },
        openSaveDialog() {
            const now = new Date();
            if (!this.saveForm.Name) {
                this.saveForm.Name = `AI工作流-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
            }
            this.saveDialogVisible = true;
        },
        async saveCurrentFlow() {
            if (!this.saveForm.Name.trim()) {
                ElMessage.warning("请输入名称");
                return;
            }
            this.saving = true;
            try {
                const result = await AiWorkFlowApi.save({
                    ...this.saveForm,
                    Graph: this.graphData,
                    Inventory: this.inventory,
                    Prompt: this.prompt,
                    Description: this.saveForm.Description
                });
                if (this.isOk(result)) {
                    ElMessage.success("已保存AI工作流");
                    this.saveDialogVisible = false;
                    this.loadSavedList();
                } else {
                    ElMessage.error(result.Msg || "保存失败");
                }
            } finally {
                this.saving = false;
            }
        },
        normalizeResource(list, type, labelField, subField) {
            return (list || []).map(item => {
                const label = item[labelField] || item.Name || item.ApiEngineKey || item.FlowName || item.Id;
                const sub = item[subField] || item.Description || item.Remark || "";
                return {
                    ...item,
                    __id: `${type}_${item.Id || label}`,
                    __type: type,
                    __label: label,
                    __sub: sub
                };
            });
        },
        nodeLabel(node) {
            const text = node.Label || node.Key || node.Id || "";
            return this.truncate(text, node.Type === "v8-event" ? 24 : 22);
        },
        truncate(value, max) {
            const text = String(value || "");
            return text.length > max ? `${text.slice(0, max - 3)}...` : text;
        },
        typeLabel(type) {
            const map = {
                menu: "菜单",
                table: "表",
                field: "字段",
                "v8-event": "V8",
                engine: "接口",
                "engine-missing": "缺失接口",
                workflow: "流程",
                page: "页面",
                print: "打印"
            };
            return map[type] || type || "节点";
        },
        edgeColor(type) {
            if (type === "api-call") return "#1e9aa6";
            if (type?.includes("workflow")) return "#526be0";
            if (type?.includes("v8") || type?.includes("event")) return "#7c6ee6";
            return "#a7b3c3";
        },
        makeNodeId(prefix, key) {
            const raw = `${prefix}_${key || ""}`.replace(/[^\w-]+/g, "_");
            return raw.length > 110 ? raw.slice(0, 110) : raw;
        },
        safeJson(value, fallback) {
            if (!value) return fallback;
            if (typeof value === "object") return value;
            try {
                return JSON.parse(value);
            } catch (e) {
                return fallback;
            }
        },
        countStats(graph) {
            return {
                GraphNodeCount: graph?.Nodes?.length || 0,
                GraphEdgeCount: graph?.Edges?.length || 0
            };
        },
        isOk(result) {
            return result && (result.Code === 1 || result.code === 1);
        }
    }
};
</script>

<style scoped>
.aiwf-page {
    height: calc(100vh - 84px);
    min-height: 680px;
    display: flex;
    flex-direction: column;
    background: #f5f7fb;
    color: #182033;
}

.aiwf-toolbar {
    min-height: 64px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 18px;
    border-bottom: 1px solid #e3e8f2;
    background: #fff;
}

.aiwf-title {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 220px;
    font-size: 17px;
    font-weight: 700;
}

.aiwf-title .el-icon {
    color: #4f7df3;
}

.aiwf-tools {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    flex: 1;
    min-width: 0;
}

.aiwf-search {
    width: 260px;
}

.aiwf-saved {
    width: 170px;
}

.aiwf-statbar {
    display: grid;
    grid-template-columns: repeat(6, minmax(120px, 1fr));
    border-bottom: 1px solid #e3e8f2;
    background: #fff;
}

.aiwf-stat {
    height: 50px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    border-right: 1px solid #e8edf5;
}

.aiwf-stat span {
    color: #77839a;
    font-size: 13px;
}

.aiwf-stat strong {
    color: #121827;
    font-size: 18px;
    font-weight: 700;
}

.aiwf-workbench {
    min-height: 0;
    flex: 1;
    display: grid;
    grid-template-columns: 292px minmax(0, 1fr);
}

.aiwf-resource-panel {
    min-width: 0;
    display: flex;
    flex-direction: column;
    border-right: 1px solid #dde4ef;
    background: #fff;
}

.aiwf-panel-header {
    height: 58px;
    display: grid;
    grid-template-columns: 58px minmax(0, 1fr);
    align-items: center;
    gap: 8px;
    padding: 0 14px;
    font-weight: 700;
}

.aiwf-tabs {
    padding: 0 14px;
}

.aiwf-resource-list {
    min-height: 0;
    flex: 1;
    overflow: auto;
    padding: 8px 10px 16px;
}

.aiwf-resource-item {
    width: 100%;
    min-height: 54px;
    display: grid;
    grid-template-columns: 16px minmax(0, 1fr);
    gap: 8px;
    align-items: center;
    border: 0;
    border-radius: 6px;
    background: transparent;
    text-align: left;
    cursor: pointer;
    padding: 8px 10px;
}

.aiwf-resource-item:hover {
    background: #f3f7ff;
}

.aiwf-resource-main {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 4px;
}

.aiwf-resource-main strong,
.aiwf-resource-main small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.aiwf-resource-main strong {
    color: #263244;
    font-size: 13px;
    font-weight: 650;
}

.aiwf-resource-main small {
    color: #8a96a8;
    font-size: 12px;
}

.aiwf-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #8da2bf;
}

.aiwf-dot.is-table {
    background: #2fa36b;
}

.aiwf-dot.is-menu {
    background: #2f80ed;
}

.aiwf-dot.is-engine {
    background: #1e9aa6;
}

.aiwf-dot.is-workflow {
    background: #526be0;
}

.aiwf-canvas-wrap {
    position: relative;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    background:
        linear-gradient(#edf2f8 1px, transparent 1px),
        linear-gradient(90deg, #edf2f8 1px, transparent 1px),
        #fbfdff;
    background-size: 24px 24px;
}

.aiwf-canvas-toolbar {
    position: absolute;
    z-index: 4;
    top: 14px;
    left: 14px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px;
    border: 1px solid #e0e7f0;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.95);
    box-shadow: 0 8px 24px rgba(35, 48, 74, 0.08);
}

.aiwf-graph {
    width: 100%;
    height: 100%;
}

.aiwf-node-bubbles {
    position: absolute;
    z-index: 5;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px;
    border: 1px solid #dfe6f1;
    border-radius: 999px;
    background: #fff;
    box-shadow: 0 10px 28px rgba(28, 38, 60, 0.14);
}

.aiwf-detail-head {
    padding: 4px 0 14px;
    border-bottom: 1px solid #e7ecf4;
}

.aiwf-detail-head h3 {
    margin: 10px 0 4px;
    color: #141b2b;
    font-size: 18px;
    line-height: 1.3;
    word-break: break-word;
}

.aiwf-detail-head p {
    margin: 0;
    color: #7b8798;
    font-size: 13px;
    word-break: break-word;
}

.aiwf-node-type {
    display: inline-flex;
    align-items: center;
    height: 22px;
    padding: 0 8px;
    border-radius: 999px;
    background: #eef3ff;
    color: #3560d8;
    font-size: 12px;
    font-weight: 650;
}

.aiwf-node-type.is-table {
    background: #edf9f2;
    color: #208354;
}

.aiwf-node-type.is-engine {
    background: #eef8f9;
    color: #147b85;
}

.aiwf-node-type.is-workflow {
    background: #f0f3ff;
    color: #4258ca;
}

.aiwf-loading {
    padding-top: 18px;
}

.aiwf-detail-tabs {
    padding-top: 8px;
}

.aiwf-kv {
    display: grid;
    grid-template-columns: 70px minmax(0, 1fr);
    gap: 12px 10px;
    padding: 8px 0 14px;
    font-size: 13px;
}

.aiwf-kv span {
    color: #7b8798;
}

.aiwf-kv strong {
    min-width: 0;
    color: #263244;
    font-weight: 600;
    word-break: break-word;
}

.aiwf-mini-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
}

.aiwf-mini-grid div {
    min-height: 58px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
    padding: 10px 12px;
    border: 1px solid #e4eaf3;
    border-radius: 6px;
    background: #f8fafd;
}

.aiwf-mini-grid span {
    color: #7b8798;
    font-size: 12px;
}

.aiwf-mini-grid strong {
    color: #182033;
    font-size: 16px;
}

.aiwf-field-list,
.aiwf-event-list,
.aiwf-call-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 4px;
}

.aiwf-field,
.aiwf-call,
.aiwf-event {
    border: 1px solid #e3e9f2;
    border-radius: 6px;
    background: #fff;
    padding: 10px 12px;
}

.aiwf-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.aiwf-field strong {
    color: #263244;
    font-size: 13px;
}

.aiwf-field span {
    color: #7b8798;
    font-size: 12px;
}

.aiwf-call {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #176a72;
    font-size: 13px;
}

.aiwf-event-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    color: #263244;
    font-size: 13px;
}

.aiwf-event pre {
    max-height: 240px;
    overflow: auto;
    margin: 8px 0 0;
    padding: 10px;
    border-radius: 6px;
    background: #101828;
    color: #d9e4ff;
    font-size: 12px;
    line-height: 1.55;
    white-space: pre-wrap;
    word-break: break-word;
}

:deep(.aiwf-detail-drawer .el-drawer__body) {
    padding: 18px;
}

:deep(.x6-node-selected rect) {
    stroke-width: 2px;
}

@media (max-width: 1180px) {
    .aiwf-toolbar {
        align-items: flex-start;
        flex-direction: column;
    }

    .aiwf-tools {
        width: 100%;
        justify-content: flex-start;
        flex-wrap: wrap;
    }

    .aiwf-statbar {
        grid-template-columns: repeat(3, minmax(120px, 1fr));
    }
}

@media (max-width: 860px) {
    .aiwf-page {
        height: auto;
        min-height: 100vh;
    }

    .aiwf-workbench {
        grid-template-columns: 1fr;
        min-height: 780px;
    }

    .aiwf-resource-panel {
        height: 260px;
        border-right: 0;
        border-bottom: 1px solid #dde4ef;
    }

    .aiwf-statbar {
        grid-template-columns: repeat(2, minmax(120px, 1fr));
    }

    .aiwf-search,
    .aiwf-saved {
        width: 100%;
    }
}
</style>
