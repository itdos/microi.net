<template>
    <div class="itdos-wf-container" v-if="easyFlowVisible" style="height: 100%; background-color: #fff">
        <div style="display: flex; height: 80vh">
            <div id="itdos_flowchart" ref="itdos_flowchart" class="container">
                <template v-for="nodeModel in WF_Node_List" :key="nodeModel.Id">
                    <div :id="nodeModel.Id" :ref="'refNodeModel_' + nodeModel.Id" :style="nodeContainerStyle(nodeModel)" @mouseup="changeNodeSite(nodeModel)" :class="nodeContainerClass(nodeModel)">
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
    </div>
</template>

<script>
// Vue 3: 移除无用的 Vue 导入
import draggable from "vuedraggable";
import { Operation } from "@element-plus/icons-vue";
import "../js/jsplumb";
import { easyFlowMixin } from "../js/mixins";
import lodash from "lodash";
import { cloneDeep } from "lodash";
import _ from "underscore";
export default {
    name: "WFDesignPreview",
    components: {
        draggable,
        Operation
    },
    data() {
        return {
            DiyTableRowId_Flow: "",
            DiyTableRowId_Node: "",
            DiyTableRowId_Line: "",
            // jsPlumb 实例
            jsPlumb: null,
            // 控制画布销毁
            easyFlowVisible: true,
            // 控制流程数据显示与隐藏
            flowInfoVisible: false,
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
            NodeModel: {},
            line: {}
        };
    },
    // 一些基础配置移动该文件中
    mixins: [easyFlowMixin],
    directives: {},
    computed: {},
    props: {
        PropsFlowTableRowId: {
            type: String,
            default: ""
        },
        PropsCurrentNodeId: {
            type: String,
            default: ""
        }
    },
    mounted() {
        var self = this;
        if (self.DiyCommon.IsNull(self.$route.params.Id)) {
            self.DiyTableRowId_Flow = self.PropsFlowTableRowId;
        } else {
            self.DiyTableRowId_Flow = self.$route.params.Id;
        }
        self.jsPlumb = jsPlumb.getInstance();
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
                    var flowData = datas[0].Data;
                    flowData.WF_Node = datas[1].Data == null ? [] : datas[1].Data;
                    flowData.WF_Line = datas[2].Data == null ? [] : datas[2].Data;
                    // 默认加载流程A的数据、在这里可以根据具体的业务返回符合流程数据格式的数据即可
                    self.dataReload(flowData);
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
            // if (!self.NodeModel.left && self.NodeModel.PositionLeft) {
            //     self.NodeModel.left = self.NodeModel.PositionLeft + 'px';
            // }
            // if (!self.NodeModel.top && self.NodeModel.PositionTop) {
            //     self.NodeModel.top = self.NodeModel.PositionTop + 'px';
            // }
            var result = {
                top: nodeModel.PositionTop,
                left: nodeModel.PositionLeft,
                backgroundColor: self.PropsCurrentNodeId == nodeModel.Id ? "#ccc" : "#fff"
            };
            return result;
        },
        nodeIcoClass(nodeModel) {
            var self = this;
            var nodeIcoClass = {};
            // if (!self.NodeModel.ico && self.NodeModel.Icon) {
            //     self.NodeModel.ico = self.NodeModel.Icon;
            // }
            // nodeIcoClass[self.NodeModel.ico] = true
            nodeIcoClass[nodeModel.Icon] = true;
            // 添加该class可以推拽连线出来，viewOnly 可以控制节点是否运行编辑
            // nodeIcoClass['flow-node-drag'] = this.NodeModel.viewOnly ? false : true
            return nodeIcoClass;
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
                });

                // beforeDetach
                self.jsPlumb.bind("beforeDetach", (evt) => {
                    console.log("beforeDetach", evt);
                });
                self.jsPlumb.setContainer(self.$refs.itdos_flowchart);
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
        // 加载流程图
        dataReload(data) {
            var self = this;
            self.easyFlowVisible = false;
            self.FlowDesignModel.WF_Node = [];
            self.WF_Node_List = [];
            self.FlowDesignModel.WF_Line = [];
            self.WF_Node_Line = [];
            self.$nextTick(() => {
                data = lodash.cloneDeep(data);
                self.easyFlowVisible = true;
                self.FlowDesignModel = data;
                self.WF_Node_List = data.WF_Node;
                self.WF_Line_List = data.WF_Line;
                self.$nextTick(() => {
                    self.jsPlumb = jsPlumb.getInstance();
                    self.$nextTick(() => {
                        self.jsPlumbInit();
                    });
                });
            });
        }
    }
};
</script>
<style scoped lang="scss">
#itdos_flowchart {
    background: #fff url(~@/../public/static/img/grid.png);
    max-width: 100%;
    position: relative;
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
