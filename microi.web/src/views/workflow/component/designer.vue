<template>
    <div class="itdos-wf-container" v-if="easyFlowVisible" style="height: calc(100vh - 120px); background-color: #fff">
        <el-form inline @submit.prevent class="keyword-search">
            <el-form-item>
                <span style="margin-right:20px;font-weight: bold;color: #666;}">设计 - {{ FlowDesignModel.FlowName }}</span>
                <el-button :loading="BtnLoading" type="primary" :icon="Document" @click="SaveWF()">保存流程</el-button>
                <template v-if="CurrentNodeOrLine.Type">
                    <el-button type="danger" :icon="Delete" @click="DelCurrentNodeOrLine">
                        {{ "删除当前" + (CurrentNodeOrLine.Type == "Node" ? "节点" : "条件") }}
                    </el-button>
                </template>
                <el-button :icon="ZoomIn" @click="zoomAdd"></el-button>
                <el-button :icon="ZoomOut" @click="zoomSub"></el-button>
            </el-form-item>
        </el-form>
        <div style="display: flex; height: calc(100% - 47px)">
            <div class="itdos-wf-design-node">
                <node-menu @addNode="addNode" ref="nodeMenu"></node-menu>
            </div>
            <div class="itdos-flowchart-container container">
                <div id="itdos_flowchart" ref="itdos_flowchart" class="container" v-flowDrag>
                    <template>
                        <div
                            v-for="nodeModel in WF_Node_List"
                            :id="nodeModel.Id"
                            :key="nodeModel.Id"
                            :ref="'refNodeModel_' + nodeModel.Id"
                            :style="nodeContainerStyle(nodeModel)"
                            @click="clickNode(nodeModel)"
                            @mouseup="changeNodeSite(nodeModel)"
                            :class="nodeContainerClass(nodeModel)"
                        >
                            <!-- 最左侧的那条竖线 -->
                            <div class="itdos-wf-node-left"></div>
                            <!-- 节点类型的图标 -->
                            <!-- flow-node-drag -->
                            <div class="itdos-wf-node-left-ico">
                                <i :class="nodeIcoClass(nodeModel)"></i>
                            </div>
                            <!-- 节点名称 -->
                            <div class="itdos-wf-node-text" :show-overflow-tooltip="true">
                                {{ nodeModel.NodeName }}
                            </div>
                            <!-- 节点状态图标 -->
                            <div class="itdos-wf-node-right-ico flow-node-drag">
                                <el-icon class="flow-node-drag"><Operation /></el-icon>
                            </div>
                        </div>
                    </template>
                    <!-- 给画布一个默认的宽度和高度 -->
                    <div style="position: absolute; top: 2000px; left: 2000px">&nbsp;</div>
                    <!--引擎版本号-->
                    <div style="position: absolute; right: 20px; bottom: 20px; color: #666">
                        <!-- ©Microi工作流引擎 v4.0 -->
                    </div>
                </div>
            </div>
            <!-- 右侧表单 -->
            <div class="itdos-wf-design-config">
                <div class="itdos-wf-node-form">
                    <el-tabs v-model="NodeOrLineType" :stretch="true" @tab-click="SwaitchRightConfig">
                        <el-tab-pane v-if="NodeOrLineType == 'Node'" name="Node" style="max-height: calc(100vh - 230px); overflow-y: scroll">
                            <template #label
                                ><span> <i class="fas fa-columns marginRight5" />节点属性 </span></template
                            >
                            <div v-if="divForm_diy_node_designer" style="padding-left: 15px; padding-right: 15px">
                                <DiyForm
                                    ref="form_diy_node_designer"
                                    :FormMode="DiyFormMode"
                                    :TableId="DiyTableId_Node"
                                    :TableRowId="DiyTableRowId_Node"
                                    :DefaultValues="DefaultValues_Node"
                                    :ColSpan="24"
                                    :LabelPosition="'top'"
                                    @CallbackForm="CallbackForm_Node"
                                    @CallbackFormValueChange="CallbackFormValueChange_Node"
                                ></DiyForm>
                            </div>
                        </el-tab-pane>
                        <el-tab-pane v-if="NodeOrLineType == 'Line'" name="Line" style="max-height: calc(100vh - 230px); overflow-y: scroll">
                            <template #label
                                ><span> <i class="fas fa-columns marginRight5" />条件属性 </span></template
                            >
                            <div style="padding-left: 15px; padding-right: 15px">
                                <DiyForm
                                    ref="form_diy_line_designer"
                                    :FormMode="DiyFormMode"
                                    :TableId="DiyTableId_Line"
                                    :TableRowId="DiyTableRowId_Line"
                                    :DefaultValues="DefaultValues_Line"
                                    :ColSpan="24"
                                    :LabelPosition="'top'"
                                    @CallbackForm="CallbackForm_Line"
                                    @CallbackFormValueChange="CallbackFormValueChange_Line"
                                ></DiyForm>
                            </div>
                        </el-tab-pane>
                        <el-tab-pane name="Flow" style="max-height: calc(100vh - 230px); overflow-y: scroll">
                            <template #label
                                ><span> <i class="fas fa-columns marginRight5" />流程属性 </span></template
                            >
                            <div v-if="ShowDiyFlowForm" style="padding-left: 15px; padding-right: 15px">
                                <!-- :LoadMode="'Dialog'"  -->
                                <DiyForm
                                    ref="form_diy_flow_designer"
                                    :FormMode="DiyFormMode"
                                    :TableId="DiyTableId_Flow"
                                    :TableRowId="DiyTableRowId_Flow"
                                    :ColSpan="24"
                                    :LabelPosition="'top'"
                                    :DefaultValues="FlowDesignModel"
                                    @CallbackFormValueChange="CallbackFormValueChange_Flow"
                                ></DiyForm>
                            </div>
                        </el-tab-pane>
                    </el-tabs>
                </div>
            </div>
        </div>
        <!-- 流程数据详情 -->
    </div>
</template>

<script>
import { defineAsyncComponent } from "vue";
import { useTagsViewStore } from "@/pinia";
// Vue 3: 使用 defineAsyncComponent 包装动态 import
var nodeColConfig = defineAsyncComponent(() => import("./node-col-config.vue"));
// Vue 3: 在模板中使用局部注册，而不是 Vue.component
//-------END
// import NodeColConfig from './node-col-config.vue'
import draggable from "vuedraggable";
// import { jsPlumb } from 'jsplumb'
// 使用修改后的jsplumb
import "../js/jsplumb";
import { easyFlowMixin } from "../js/mixins";
import flowNode from "./node";
import nodeMenu from "./all-node";
import FlowInfo from "./info";
// import FlowNodeForm from './node_form'
import lodash from "lodash";
// import { getDataB } from '../js/data_B'
import { ForceDirected } from "../js/force-directed";
import { cloneDeep } from "lodash";
import DiyForm from "@/views/diy/diy-form";
import _ from "underscore";
export default {
    setup() {
        const tagsViewStore = useTagsViewStore();
        return { tagsViewStore };
    },
    data() {
        return {
            divForm_diy_node_designer: true,
            BtnLoading: false,
            NodeOrLineType: "",
            ShowDiyFlowForm: false,
            DiyTableRowId_Flow: "",
            DiyTableRowId_Node: "",
            DiyTableRowId_Line: "",
            DiyFormMode: "Edit",
            DiyTableId_Flow: "9b4f95be-8a22-41b3-9cf7-1f7a94fe2127",
            DiyTableId_Line: "ae0c360d-1aa5-4361-b35b-e5004570eaba",
            DiyTableId_Node: "84571d14-50e7-40a6-b6b2-9343fbf4a88b",
            DefaultValues_Node: {},
            DefaultValues_Line: {},
            // jsPlumb 实例
            jsPlumb: null,
            // 控制画布销毁
            easyFlowVisible: true,
            // 是否加载完毕标志位
            loadEasyFlowFinish: false,
            // 数据
            FlowDesignModel: {},
            WF_Node_List: [],
            WF_Line_List: [],
            // 激活的元素、可能是节点、可能是连线
            CurrentNodeOrLine: {
                // 可选值 node 、line
                Type: undefined,
                // 节点ID
                NodeId: undefined,
                LineId: undefined,
                // 连线ID
                sourceId: undefined,
                targetId: undefined
            },
            zoom: 1,
            visible: true,
            line: {},
            DontCallbackFormValueChange: false
        };
    },
    // 一些基础配置移动该文件中
    mixins: [easyFlowMixin],
    components: {
        draggable,
        flowNode,
        nodeMenu,
        FlowInfo,
        DiyForm,
        // Vue 3: 局部注册异步组件
        NodeColConfig: nodeColConfig
    },
    directives: {
        flowDrag: {
            bind(el, binding, vnode, oldNode) {
                if (!binding) {
                    return;
                }
                el.onmousedown = (e) => {
                    if (e.button == 2) {
                        // 右键不管
                        return;
                    }
                    //  鼠标按下，计算当前原始距离可视区的高度
                    let disX = e.clientX;
                    let disY = e.clientY;
                    el.style.cursor = "move";

                    document.onmousemove = function (e) {
                        // 移动时禁止默认事件
                        e.preventDefault();
                        const left = e.clientX - disX;
                        disX = e.clientX;
                        el.scrollLeft += -left;

                        const top = e.clientY - disY;
                        disY = e.clientY;
                        el.scrollTop += -top;
                    };

                    document.onmouseup = function (e) {
                        el.style.cursor = "auto";
                        document.onmousemove = null;
                        document.onmouseup = null;
                    };
                };
            }
        }
    },
    computed: {},
    watch: {
        // WF_Node_List:{
        //     deep: true,
        //     handler(newVal, oldVal) {
        //         newVal.forEach(element => {
        //             if(typeof(element.NodeName) == 'function' || typeof(element.NodeName) == 'object' || Array.isArray(typeof(element.NodeName))){
        //                 var oldElement = _.find(oldVal, function(oldItem){
        //                     return oldItem.Id == element.Id;
        //                 });
        //                 if(oldElement){
        //                     element.NodeName = oldElement.NodeName;
        //                 }
        //             }
        //         });
        //     }
        // },
        // DefaultValues_Node:function(newVal, oldVal){
        //     if(typeof(newVal.NodeName) == 'function' || typeof(newVal.NodeName) == 'object' || Array.isArray(typeof(newVal.NodeName))){
        //         this.DefaultValues_Node.NodeName = oldVal;
        //     }
        // },
        // 'DefaultValues_Node.NodeName':function(newVal, oldVal){
        //     if(typeof(newVal) == 'function' || typeof(newVal) == 'object' || Array.isArray(typeof(newVal))){
        //         this.DefaultValues_Node.NodeName = oldVal;
        //     }
        // },
    },
    mounted() {
        var self = this;
        self.DiyTableRowId_Flow = self.$route.params.Id;
        self.jsPlumb = jsPlumb.getInstance();
        // self.ActiveTab = 'Flow';
        self.NodeOrLineType = "Flow";
        //先从数据库取出流程实体类，为了获取流程图Json
        //获取所有节点
        //获取所有线
        var param = [
            {
                Url: self.DiyApi.GetDiyTableRowModel,
                Param: {
                    TableName: "WF_FlowDesign",
                    _TableRowId: self.DiyTableRowId_Flow
                }
            },
            {
                Url: self.DiyApi.GetDiyTableRow,
                Param: {
                    TableName: "WF_Node",
                    _SearchEqual: {
                        FlowDesignId: self.DiyTableRowId_Flow
                    }
                }
            },
            {
                Url: self.DiyApi.GetDiyTableRow,
                Param: {
                    TableName: "WF_Line",
                    _SearchEqual: {
                        FlowDesignId: self.DiyTableRowId_Flow
                    }
                }
            }
        ];
        var loadingObj = self.$loading({
            target: "#itdos_flowchart",
            text: "加载流程图..."
        });
        self.DiyCommon.PostAll(param, function (datas) {
            if (datas) {
                self.$nextTick(() => {
                    self.FlowDesignModel = datas[0].Data;

                    var item = self.tagsViewStore.visitedViews.filter((item) => item.fullPath == self.$route.fullPath);
                    if (item.length > 0) {
                        item[0].title = "设计 - " + self.FlowDesignModel.FlowName;
                    }

                    self.WF_Node_List = datas[1].Data ? datas[1].Data : [];
                    self.WF_Line_List = datas[2].Data ? datas[2].Data : [];
                    // 默认加载流程A的数据、在这里可以根据具体的业务返回符合流程数据格式的数据即可
                    self.dataReload(); //flowDesignModel
                    loadingObj.close();
                });
            }
        });
    },
    methods: {
        nodeContainerClass(nodeModel) {
            return {
                "itdos-wf-node": true,
                "itdos-wf-node-active": this.CurrentNodeOrLine.Type == "Node" ? this.CurrentNodeOrLine.NodeId === nodeModel.Id : false
            };
        },
        // 节点容器样式
        nodeContainerStyle(nodeModel) {
            var self = this;
            var result = {
                top: nodeModel.PositionTop,
                left: nodeModel.PositionLeft
            };
            return result;
        },
        nodeIcoClass(nodeModel) {
            var self = this;
            var nodeIcoClass = {};
            nodeIcoClass[nodeModel.Icon] = true;
            return nodeIcoClass;
        },
        /**
         * 在节点属性和表单属性离开表单V8事件中，会回调这个函数。
         * @param {*} model
         */
        CallbackForm_Node(model) {
            var self = this;
            // for (let index = 0; index < self.WF_Node_List.length; index++) {
            //     var element = self.WF_Node_List[index];
            //     if (element.Id == model.Id) {
            //         model.id = model.Id;
            //         for (const key in model) {
            //             //不回写坐标
            //             if (key != 'PositionLeft' && key != 'PositionTop') {
            //                 self.$set(self.WF_Node_List[index], key, model[key]);
            //             }
            //         }
            //         break;
            //     }
            // }
            // self.DefaultValues_Node = {...model};
        },
        CallbackForm_Line(model) {
            var self = this;
            // for (let index = 0; index < self.WF_Line_List.length; index++) {
            //     var element = self.WF_Line_List[index];
            //     if (element.Id == model.Id) {
            //         // element = model;
            //         model.id = model.Id;
            //         for (const key in model) {
            //             self.$set(self.WF_Line_List[index], key, model[key]);
            //         }
            //         break;
            //     }
            // }
            // self.DefaultValues_Line = {...model};
        },
        CallbackFormValueChange_Line(field, value) {
            var self = this;
            //这里查询出来的数据，是会引用修改的
            var lineModel = _.find(self.WF_Line_List, function (item) {
                return item.Id == self.CurrentNodeOrLine.LineId;
            });
            if (lineModel) {
                lineModel[field.Name] = value;
                if (field.Name == "LineName") {
                    self.setLineLabel(this.line.from, this.line.to, lineModel[field.Name]);
                }
            }
            self.DefaultValues_Line = { ...lineModel };
        },
        CallbackFormValueChange_Node(field, value) {
            var self = this;
            //2023-08-31
            if (!self.DontCallbackFormValueChange) {
                //这里查询出来的数据，是会引用修改的
                var nodeModel = _.find(self.WF_Node_List, function (item) {
                    return item.Id == self.CurrentNodeOrLine.NodeId;
                });
                if (nodeModel) {
                    nodeModel[field.Name] = value;
                }
                self.DefaultValues_Node = { ...nodeModel };
            }
        },
        CallbackFormValueChange_Flow(field, value) {
            var self = this;

            //下拉框的值，有可能是只存储字段，所以需要ForRowModelHandler来处理下。
            var _rowModel = {};
            _rowModel[field.Name] = value;
            self.DiyCommon.ForRowModelHandler(_rowModel, [field]);
            self.FlowDesignModel[field.Name] = _rowModel[field.Name];
        },
        SwaitchRightConfig() {},
        LoadRightWfNode(nodeModel) {
            var self = this;
            //2023-08-31：如果修改了第1个节点的NodeName，不失去焦点马上点击第二个节点会导致把NodeName传入到第二个节点
            //因为此函数会在 CallbackFormValueChange_Node 之前执行。因此新增DontCallbackFormValueChange
            self.DontCallbackFormValueChange = true;

            //先获取出来右侧diy填写的所有值，然后暂存到此页面wf_node实体
            //然后再加载新的WF_Node实体
            self.CurrentNodeOrLine.Type = "Node";
            self.CurrentNodeOrLine.NodeId = nodeModel.Id;
            self.nodeInit(self.FlowDesignModel, nodeModel.Id);
            // self.ActiveTab = 'Node';
            self.NodeOrLineType = "Node";

            //以下这句肯定会在 CallbackForm_Line、 CallbackForm_Node 里面的 【 self.DefaultValues_Line = {...model};】 之后执行，所以不用担心。
            self.DefaultValues_Node = { ...nodeModel };
            //通过 divForm_diy_node_designer 处理一下，否则代码编辑器的值会串到下一个节点属性
            self.divForm_diy_node_designer = false;
            self.$nextTick(function () {
                self.divForm_diy_node_designer = true;
                self.$nextTick(function () {
                    self.$refs.form_diy_node_designer.Init();
                    self.DontCallbackFormValueChange = false;
                });
            });
        },
        LoadRightWfLine() {
            var self = this;
            self.$refs.form_diy_line_designer.Init();
        },
        jsPlumbInit() {
            var self = this;
            self.jsPlumb.ready(() => {
                // 导入默认配置
                self.jsPlumb.importDefaults(self.jsplumbSetting);
                // 会使整个jsPlumb立即重绘。
                self.jsPlumb.setSuspendDrawing(false, true);
                // 初始化节点
                self.loadEasyFlow();
                // 单点击了连接线, https://www.cnblogs.com/ysx215/p/7615677.html
                self.jsPlumb.bind("click", (conn, originalEvent) => {
                    self.CurrentNodeOrLine.Type = "Line";
                    self.CurrentNodeOrLine.LineId = conn.Line.Id;
                    self.CurrentNodeOrLine.sourceId = conn.sourceId;
                    self.CurrentNodeOrLine.targetId = conn.targetId;
                    self.lineInit({
                        from: conn.sourceId,
                        to: conn.targetId,
                        label: conn.getLabel()
                    });
                    self.NodeOrLineType = "Line";
                    // self.DiyTableRowId_Line = '';
                    self.DefaultValues_Line = conn.Line;
                    self.$nextTick(function () {
                        self.LoadRightWfLine();
                    });
                });
                // 连线
                self.jsPlumb.bind("connection", (evt) => {
                    let from = evt.source.Id;
                    let to = evt.target.Id;
                    if (self.loadEasyFlowFinish) {
                        // self.WF_Line_List.push({from: from, to: to})
                    }
                });

                // 删除连线回调
                self.jsPlumb.bind("connectionDetached", (evt) => {
                    self.deleteLine(evt.sourceId, evt.targetId);
                });

                // 改变线的连接节点
                self.jsPlumb.bind("connectionMoved", (evt) => {
                    self.changeLine(evt.originalSourceId, evt.originalTargetId);
                });

                // 连线右击
                self.jsPlumb.bind("contextmenu", (evt) => {
                    console.log("contextmenu", evt);
                });

                // 连线
                self.jsPlumb.bind("beforeDrop", (evt, param2) => {
                    let from = evt.sourceId;
                    let to = evt.targetId;
                    if (from === to) {
                        // this.$message.error('节点不支持连接自己')
                        return false;
                    }
                    if (self.hasLine(from, to)) {
                        self.$message.error("已存在该条件！");
                        return false;
                    }
                    if (self.hashOppositeLine(from, to)) {
                        self.$message.error("不允许两个节点间循环条件，请配置可退回节点！");
                        return false;
                    }
                    //插入数据库
                    var newLineModel = {
                        LineName: "",
                        FlowDesignId: self.DiyTableRowId_Flow,
                        FromNodeId: from,
                        ToNodeId: to
                    };
                    self.DiyCommon.Post(
                        self.DiyApi.AddDiyTableRow,
                        {
                            TableName: "WF_Line",
                            _FormData: newLineModel
                        },
                        function (result) {
                            if (self.DiyCommon.Result(result)) {
                                var lineId = result.Data.Id;
                                newLineModel.Id = lineId;
                                self.WF_Line_List.push(newLineModel);
                                evt["connection"]["Line"] = newLineModel;
                            }
                        }
                    );
                    // this.$message.success('连接成功')
                    return true;
                });

                // beforeDetach
                self.jsPlumb.bind("beforeDetach", (evt) => {
                    console.log("beforeDetach", evt);
                });
                self.jsPlumb.setContainer(self.$refs.itdos_flowchart);
            });
            self.ShowDiyFlowForm = true;
            self.$nextTick(function () {
                self.$refs.form_diy_flow_designer.Init();
            });
        },
        // 加载流程图
        loadEasyFlow() {
            // 初始化节点
            for (var i = 0; i < this.WF_Node_List.length; i++) {
                var node = this.WF_Node_List[i];

                node.id = node.Id;
                // 设置源点，可以拖出线连接其他节点
                this.jsPlumb.makeSource(node.Id, lodash.merge(this.jsplumbSourceOptions, {}));
                // // 设置目标点，其他源点拖出的线可以连接该节点
                this.jsPlumb.makeTarget(node.Id, this.jsplumbTargetOptions);
                if (!node.viewOnly) {
                    this.jsPlumb.draggable(node.Id, {
                        containment: "parent",
                        stop: function (el) {
                            // 拖拽节点结束后的对调
                            // console.log('拖拽结束: ', el)
                        }
                    });
                }
            }
            // 初始化连线
            for (var i = 0; i < this.WF_Line_List.length; i++) {
                let line = this.WF_Line_List[i];
                var connParam = {
                    Line: line,
                    source: line.FromNodeId,
                    target: line.ToNodeId,
                    label: line.LineName ? line.LineName : "",
                    connector: line.connector ? line.connector : "",
                    anchors: line.anchors ? line.anchors : undefined,
                    paintStyle: line.paintStyle ? line.paintStyle : undefined
                };
                this.jsPlumb.connect(connParam, this.jsplumbConnectOptions);
            }
            this.$nextTick(function () {
                this.loadEasyFlowFinish = true;
            });
        },
        // 设置连线条件
        setLineLabel(from, to, label) {
            var self = this;
            var conn = self.jsPlumb.getConnections({
                source: from,
                target: to
            })[0];
            if (!label || label === "") {
                conn.removeClass("flowLabel");
                conn.addClass("emptyFlowLabel");
            } else {
                conn.addClass("flowLabel");
            }
            conn.setLabel({
                label: label
            });
            self.WF_Line_List.forEach(function (line) {
                if (line.FromNodeId == from && line.ToNodeId == to) {
                    line.LineName = label;
                }
            });
        },
        // 删除激活的元素
        DelCurrentNodeOrLine() {
            var self = this;
            if (self.CurrentNodeOrLine.Type === "Node") {
                self.$confirm("确定删除当前节点？与当前节点关联的条件线也会一并删除！", "提示", {
                    confirmButtonText: "确定",
                    cancelButtonText: "取消",
                    type: "warning"
                })
                    .then(() => {
                        self.DiyCommon.Post(
                            self.DiyApi.DelDiyTableRow,
                            {
                                TableName: "WF_Node",
                                Id: self.CurrentNodeOrLine.NodeId
                            },
                            function (result) {
                                if (self.DiyCommon.Result(result)) {
                                    //删除到达这个节点的线，以及这个节点出去的线
                                    var delLineIds = [];
                                    self.WF_Line_List.forEach((line) => {
                                        if (line.ToNodeId == self.CurrentNodeOrLine.NodeId || line.FromNodeId == self.CurrentNodeOrLine.NodeId) {
                                            delLineIds.push(line.Id);
                                        }
                                    });
                                    if (delLineIds.length > 0) {
                                        self.DiyCommon.Post(
                                            self.DiyApi.DelDiyTableRow,
                                            {
                                                TableName: "WF_Line",
                                                Ids: delLineIds
                                            },
                                            function (result) {
                                                if (self.DiyCommon.Result(result)) {
                                                    // self.deleteNode(self.CurrentNodeOrLine.NodeId)
                                                    /**
                                                     * 这里需要进行业务判断，是否可以删除
                                                     */
                                                    self.WF_Node_List = self.WF_Node_List.filter(function (node) {
                                                        if (node.Id === self.CurrentNodeOrLine.NodeId) {
                                                            // 伪删除，将节点隐藏，否则会导致位置错位
                                                            // node.show = false
                                                            return false;
                                                        }
                                                        return true;
                                                    });
                                                    self.$nextTick(function () {
                                                        self.jsPlumb.removeAllEndpoints(self.CurrentNodeOrLine.NodeId);
                                                    });
                                                }
                                            }
                                        );
                                    }
                                }
                            }
                        );
                    })
                    .catch(() => {});
            } else if (self.CurrentNodeOrLine.Type === "Line") {
                self.$confirm("确定删除当前条件?", "提示", {
                    confirmButtonText: "确定",
                    cancelButtonText: "取消",
                    type: "warning"
                })
                    .then(() => {
                        self.DiyCommon.Post(
                            self.DiyApi.DelDiyTableRow,
                            {
                                TableName: "WF_Line",
                                Id: self.CurrentNodeOrLine.LineId
                            },
                            function (result) {
                                if (self.DiyCommon.Result(result)) {
                                    var conn = self.jsPlumb.getConnections({
                                        source: self.CurrentNodeOrLine.sourceId,
                                        target: self.CurrentNodeOrLine.targetId
                                    })[0];
                                    self.jsPlumb.deleteConnection(conn);
                                }
                            }
                        );
                    })
                    .catch(() => {});
            }
        },
        // 删除线
        deleteLine(from, to) {
            this.WF_Line_List = this.WF_Line_List.filter(function (line) {
                if (line.FromNodeId == from && line.ToNodeId == to) {
                    return false;
                }
                return true;
            });
        },
        // 改变连线
        changeLine(oldFrom, oldTo) {
            this.deleteLine(oldFrom, oldTo);
        },
        // 改变节点的位置
        changeNodeSite(nodeModel) {
            // 避免抖动
            if (nodeModel.PositionLeft == this.$refs["refNodeModel_" + nodeModel.Id][0].style.left && nodeModel.PositionTop == this.$refs["refNodeModel_" + nodeModel.Id][0].style.top) {
                return;
            }
            var data = {
                Id: nodeModel.Id,
                PositionLeft: this.$refs["refNodeModel_" + nodeModel.Id][0].style.left,
                PositionTop: this.$refs["refNodeModel_" + nodeModel.Id][0].style.top
            };

            for (var i = 0; i < this.WF_Node_List.length; i++) {
                var node = this.WF_Node_List[i];
                if (node.Id === data.Id) {
                    node.PositionLeft = data.PositionLeft;
                    node.PositionTop = data.PositionTop;
                }
            }
        },
        /**
         * 拖拽结束后添加新的节点
         * @param evt
         * @param nodeMenu 被添加的节点对象
         * @param mousePosition 鼠标拖拽结束的坐标
         */
        addNode(evt, nodeMenu, mousePosition) {
            var self = this;
            var screenX = evt.originalEvent.clientX,
                screenY = evt.originalEvent.clientY;
            let itdos_flowchart = this.$refs.itdos_flowchart;
            var containerRect = itdos_flowchart.getBoundingClientRect();
            var left = screenX,
                top = screenY;
            // 计算是否拖入到容器中
            if (left < containerRect.x || left > containerRect.width + containerRect.x || top < containerRect.y || containerRect.y > containerRect.y + containerRect.height) {
                // this.$message.error("请把节点拖入到画布中")
                return;
            }
            left = left - containerRect.x + itdos_flowchart.scrollLeft;
            top = top - containerRect.y + itdos_flowchart.scrollTop;
            // 居中
            left -= 85;
            top -= 16;
            // 动态生成名字
            var origName = nodeMenu.NodeName;
            var nodeName = origName;
            var index = 1;
            while (index < 10000) {
                var repeat = false;
                for (var i = 0; i < this.WF_Node_List.length; i++) {
                    var node = this.WF_Node_List[i];
                    if (node.NodeName === nodeName) {
                        nodeName = origName + index;
                        repeat = true;
                    }
                }
                if (repeat) {
                    index++;
                    continue;
                }
                break;
            }
            /**
             * 这里可以进行业务判断、是否能够添加该节点
             */
            var newNodeModel = {
                NodeName: nodeName,
                PositionTop: top + "px",
                PositionLeft: left + "px",
                FlowDesignId: self.DiyTableRowId_Flow,
                Icon: nodeMenu.ico,
                NodeType: nodeMenu.type
            };
            self.DiyCommon.Post(
                self.DiyApi.AddDiyTableRow,
                {
                    TableName: "WF_Node",
                    _FormData: newNodeModel
                },
                function (result) {
                    if (self.DiyCommon.Result(result)) {
                        var nodeId = result.Data.Id;
                        newNodeModel.Id = nodeId;
                        self.WF_Node_List.push(newNodeModel);
                        self.$nextTick(function () {
                            // self.clickNode(newNodeModel)
                            self.jsPlumb.makeSource(nodeId, self.jsplumbSourceOptions);
                            self.jsPlumb.makeTarget(nodeId, self.jsplumbTargetOptions);
                            self.jsPlumb.draggable(nodeId, {
                                containment: "parent",
                                stop: function (el) {
                                    // 拖拽节点结束后的对调
                                    // console.log('拖拽结束: ', el)
                                }
                            });
                        });
                    }
                }
            );
        },
        /**
         * 删除节点
         * @param nodeId 被删除节点的ID
         */
        deleteNode(nodeId) {
            this.$confirm("确定要删除节点" + nodeId + "?", "提示", {
                confirmButtonText: "确定",
                cancelButtonText: "取消",
                type: "warning",
                closeOnClickModal: false
            })
                .then(() => {
                    /**
                     * 这里需要进行业务判断，是否可以删除
                     */
                    this.WF_Node_List = this.WF_Node_List.filter(function (node) {
                        if (node.Id === nodeId) {
                            // 伪删除，将节点隐藏，否则会导致位置错位
                            // node.show = false
                            return false;
                        }
                        return true;
                    });
                    this.$nextTick(function () {
                        this.jsPlumb.removeAllEndpoints(nodeId);
                    });
                })
                .catch(() => {});
            return true;
        },
        clickNode(nodeModel) {
            //nodeId
            var self = this;
            nodeModel.TableId = self.FlowDesignModel.TableId;
            if (self.$refs["form_diy_node_designer"]) {
                //这里会触发  CallbackForm
                // self.$refs['form_diy_node_designer'].FormOutAction('Close');
            }
            self.LoadRightWfNode(nodeModel);
        },
        // 是否具有该线
        hasLine(from, to) {
            for (var i = 0; i < this.WF_Line_List.length; i++) {
                var line = this.WF_Line_List[i];
                if (line.FromNodeId === from && line.ToNodeId === to) {
                    return true;
                }
            }
            return false;
        },
        // 是否含有相反的线
        hashOppositeLine(from, to) {
            return this.hasLine(to, from);
        },
        repaintEverything() {
            this.jsPlumb.repaint();
        },
        SaveWF() {
            var self = this;
            self.BtnLoading = true;

            //先保存WF_FlowDesign
            var flowModel = lodash.cloneDeep(self.FlowDesignModel);
            var nodeList = lodash.cloneDeep(self.WF_Node_List); // lodash.cloneDeep(flowModel.WF_Node);
            //不需要保存WF_Line，因为拉的时候就保存了，但是修改了线的名称喃？
            // var lineList = lodash.cloneDeep(flowModel.WF_Line);
            var lineList = lodash.cloneDeep(self.WF_Line_List);
            flowModel.WF_Node = "[]";
            flowModel.WF_Line = "[]";
            //保存流程图
            var allNodeParam = [
                {
                    // TableName : 'WF_FlowDesign',
                    FormEngineKey: "WF_FlowDesign",
                    Id: flowModel.Id,
                    // _FormData : flowModel,
                    _RowModel: flowModel
                }
            ];
            //保存W_Node
            nodeList.forEach((wfNode) => {
                var _rowModel = self.DiyCommon.ConvertRowModel(wfNode);
                if (!self.DiyCommon.IsNull(wfNode.Id) && !self.DiyCommon.IsNull(_rowModel)) {
                    allNodeParam.push({
                        // TableName : 'WF_Node',
                        FormEngineKey: "WF_Node",
                        Id: wfNode.Id,
                        // _FormData : _rowModel,
                        _RowModel: _rowModel
                    });
                }
            });
            //保存WF_Line
            lineList.forEach((wfLine) => {
                var _rowModel = self.DiyCommon.ConvertRowModel(wfLine);
                if (!self.DiyCommon.IsNull(wfLine.Id) && !self.DiyCommon.IsNull(_rowModel)) {
                    allNodeParam.push({
                        // TableName : 'WF_Line',
                        FormEngineKey: "WF_Line",
                        Id: wfLine.Id,
                        // _FormData : _rowModel,
                        _RowModel: _rowModel
                    });
                }
            });
            // self.DiyCommon.Post('/api/diytable/uptDiyTableRowBatch',
            self.DiyCommon.Post(
                "/api/FormEngine/UptFormDataBatch",
                // {
                //     _List : allNodeParam,
                // },
                allNodeParam,
                function (result1) {
                    if (self.DiyCommon.Result(result1)) {
                        //再保存WF_Line
                        //不需要保存WF_Line，因为拉的时候就保存了，但是修改了线的名称喃？
                        self.DiyCommon.Tips(self.$t("Msg.Success") + "！开始校验流程...");
                        self.DiyCommon.Post(
                            "/api/WorkFlow/saveWFFlowDesign",
                            {
                                _WFFlowDesign: flowModel,
                                _WFLineList: lineList,
                                _WFNodeList: nodeList
                            },
                            function (result2) {
                                if (result2.Code == 1) {
                                    self.DiyCommon.Tips("流程校验成功！");
                                } else {
                                    self.DiyCommon.Tips("流程校验失败：" + result2.Msg);
                                }
                            }
                        );
                        self.repaintEverything();
                    }
                    self.BtnLoading = false;
                }
            );
        },
        // 加载流程图
        dataReload(flowDesignModel) {
            var self = this;
            self.easyFlowVisible = false;
            self.$nextTick(() => {
                self.easyFlowVisible = true;
                self.$nextTick(() => {
                    self.jsPlumb = jsPlumb.getInstance();
                    self.$nextTick(() => {
                        self.jsPlumbInit();
                    });
                });
            });
        },
        zoomAdd() {
            if (this.zoom >= 1) {
                return;
            }
            this.zoom = this.zoom + 0.1;
            this.$refs.itdos_flowchart.style.transform = `scale(${this.zoom})`;
            this.jsPlumb.setZoom(this.zoom);
        },
        zoomSub() {
            if (this.zoom <= 0.5) {
                return;
            }
            this.zoom = this.zoom - 0.1;
            this.$refs.itdos_flowchart.style.transform = `scale(${this.zoom})`;
            this.jsPlumb.setZoom(this.zoom);
        },
        // 下载数据
        GetFlowDesignJson() {
            var self = this;
            this.$confirm("确定要下载该流程数据吗？", "提示", {
                confirmButtonText: "确定",
                cancelButtonText: "取消",
                type: "warning",
                closeOnClickModal: false
            })
                .then(() => {
                    var datastr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(self.FlowDesignModel, null, "\t"));
                    var downloadAnchorNode = document.createElement("a");
                    downloadAnchorNode.setAttribute("href", datastr);
                    downloadAnchorNode.setAttribute("download", "data.json");
                    downloadAnchorNode.click();
                    downloadAnchorNode.remove();
                    this.$message.success("正在下载中,请稍后...");
                })
                .catch(() => {});
        },

        /**
         * 表单修改，这里可以根据传入的ID进行业务信息获取
         * @param data
         * @param id
         */
        nodeInit(data, id) {
            var self = this;
        },
        lineInit(line) {
            this.line = line;
        },
        repaintEverything() {
            this.jsPlumb.repaint();
        }
    }
};
</script>
<style scoped lang="scss">
.itdos-flowchart-container {
    background: #fff url(~@/../public/static/img/grid.png);
    position: relative;
    margin-left: 0px;
    margin-right: 0px;
    overflow: scroll;
}
#itdos_flowchart {
    max-width: 100%;
    position: relative;
    height: 100%;
    transition: all 0.3s ease 0s;
}
.itdos-wf-node {
    box-shadow: 0px 0px 10px 0px #ccc;
}
.itdos-wf-container {
    border-radius: 4px;
    height: calc(100vh - 120px);
    background-color: #fff;
    .keyword-search {
        border-bottom: solid 1px #ccc;
        padding-left: 20px;
        .el-form-item--mini.el-form-item {
            margin-bottom: 10px;
            margin-top: 10px;
        }
    }
}
.el-node-form-tag {
    position: absolute;
    top: 50%;
    margin-left: -15px;
    height: 40px;
    width: 15px;
    background-color: #fbfbfb;
    border: 1px solid rgb(220, 227, 232);
    border-right: none;
    z-index: 0;
}
</style>
