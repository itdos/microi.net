<template>
    <div ref="NodeModel" :style="nodeContainerStyle" @click="clickNode" @mouseup="changeNodeSite" :class="nodeContainerClass">
        <!-- 最左侧的那条竖线 -->
        <div class="itdos-wf-node-left"></div>
        <!-- 节点类型的图标 -->
        <!-- flow-node-drag -->
        <div class="itdos-wf-node-left-ico">
            <i :class="nodeIcoClass"></i>
        </div>
        <!-- 节点名称 -->
        <div class="itdos-wf-node-text" :show-overflow-tooltip="true">
            {{ NodeModel.NodeName }}
        </div>
        <!-- 节点状态图标 -->
        <div class="itdos-wf-node-right-ico flow-node-drag">
            <el-icon class="flow-node-drag"><Operation /></el-icon>
        </div>
    </div>
</template>

<script>
import { Operation } from "@element-plus/icons-vue";

export default {
    components: {
        Operation
    },
    props: {
        NodeModel: Object,
        CurrentNodeOrLine: Object
    },
    data() {
        return {};
    },
    computed: {
        nodeContainerClass() {
            return {
                "itdos-wf-node": true,
                "itdos-wf-node-active": this.CurrentNodeOrLine.Type == "Node" ? this.CurrentNodeOrLine.NodeId === this.NodeModel.Id : false
            };
        },
        // 节点容器样式
        nodeContainerStyle() {
            var self = this;
            // if (!self.NodeModel.left && self.NodeModel.PositionLeft) {
            //     self.NodeModel.left = self.NodeModel.PositionLeft + 'px';
            // }
            // if (!self.NodeModel.top && self.NodeModel.PositionTop) {
            //     self.NodeModel.top = self.NodeModel.PositionTop + 'px';
            // }
            var result = {
                top: self.NodeModel.PositionTop,
                left: self.NodeModel.PositionLeft
            };
            return result;
        },
        nodeIcoClass() {
            var self = this;
            var nodeIcoClass = {};
            // if (!self.NodeModel.ico && self.NodeModel.Icon) {
            //     self.NodeModel.ico = self.NodeModel.Icon;
            // }
            // nodeIcoClass[self.NodeModel.ico] = true
            nodeIcoClass[self.NodeModel.Icon] = true;
            // 添加该class可以推拽连线出来，viewOnly 可以控制节点是否运行编辑
            // nodeIcoClass['flow-node-drag'] = this.NodeModel.viewOnly ? false : true
            return nodeIcoClass;
        }
    },
    methods: {
        // 点击节点
        clickNode() {
            // this.$emit('clickNode', this.NodeModel.Id)
            this.$emit("clickNode", this.NodeModel);
        },
        // 鼠标移动后抬起
        changeNodeSite() {
            // 避免抖动
            if (this.NodeModel.PositionLeft == this.$refs.NodeModel.style.left && this.NodeModel.PositionTop == this.$refs.NodeModel.style.top) {
                return;
            }
            this.$emit("changeNodeSite", {
                Id: this.NodeModel.Id,
                PositionLeft: this.$refs.NodeModel.style.left,
                PositionTop: this.$refs.NodeModel.style.top
            });
        }
    }
};
</script>
