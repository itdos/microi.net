<template>
    <div class="flow-all-node" ref="tool">
        <el-row
            :gutter="10"
            v-for="menu  in  menuList" :key="menu.id"
            >
                <el-col :span="24">
                    <el-divider content-position="center">{{menu.NodeName}}</el-divider>
                </el-col>

                <el-col
                    v-for="subMenu in menu.children"
                    :key="subMenu.id"
                    :span="12"
                    style="margin-bottom:10px;"
                    >
                    <draggable @end="end" @start="move" v-model="menu.children" :options="draggableOptions(subMenu)">
                        <el-button 
                            :class="'wf-node-btn ' + (subMenu.Disabled ? 'disabled' : '')"
                            type="info" plain
                            :data-type="subMenu.type"
                            >
                            <i :class="'icon ' + subMenu.ico" /> {{subMenu.NodeName}}
                        </el-button>
                    </draggable>
                </el-col>
        </el-row>
    </div>
</template>
<script>
    import draggable from 'vuedraggable'

    var mousePosition = {
        left: -1,
        top: -1
    }

    export default {
        data() {
            return {
                activeNames: '1',
                // draggable配置参数参考 https://www.cnblogs.com/weixin186/p/10108679.html
                
                // 默认打开的左侧菜单的id
                defaultOpeneds: ['1', '2'],
                menuList: [
                    {
                        id: '1',
                        type: 'group',
                        NodeName: '基础节点',
                        ico: 'el-icon-video-play',
                        open: true,
                        children: [
                            {
                                id: '11',
                                type: 'Start',
                                NodeName: '开始节点',
                                // ico: 'el-icon-time',
                                ico: 'el-icon-caret-right',
                                // 自定义覆盖样式
                                style: {}
                            }
                            
                            ,{
                                id: '13',
                                type: 'Approve',
                                NodeName: '审批节点',
                                ico: 'el-icon-odometer',
                                // 自定义覆盖样式
                                style: {}
                            }
                            ,{
                                id: '14',
                                type: 'Countersign',
                                NodeName: '会签节点',
                                ico: 'el-icon-odometer',
                                // 自定义覆盖样式
                                style: {}
                            }
                            ,{
                                id: '20',
                                type: 'Business',
                                NodeName: '业务节点',
                                ico: 'el-icon-odometer',
                                // 自定义覆盖样式
                                style: {}
                            }
                            // , {
                            //     id: '15',
                            //     type: 'Auto',
                            //     NodeName: '自动节点',
                            //     ico: 'el-icon-odometer',
                            //     // 自定义覆盖样式
                            //     style: {},
                            //     Disabled:true,
                            // }
                            , {
                                id: '12',
                                type: 'End',
                                NodeName: '结束节点',
                                ico: 'el-icon-odometer',
                                // 自定义覆盖样式
                                style: {}
                            }, {
                                id: '16',
                                type: 'AutoEnd',
                                NodeName: '自动结束',
                                ico: 'el-icon-odometer',
                                // 自定义覆盖样式
                                style: {}
                            }
                        ]
                    },
                    // {
                    //     id: '2',
                    //     type: 'group',
                    //     NodeName: '高级节点',
                    //     ico: 'el-icon-video-pause',
                    //     open: true,
                    //     children: [
                    //         {
                    //             id: '21',
                    //             type: 'CountersignStart',
                    //             NodeName: '会签分流',
                    //             ico: 'el-icon-caret-right',
                    //             // 自定义覆盖样式
                    //             style: {},
                    //             Disabled:true,
                    //         }, {
                    //             id: '22',
                    //             type: 'ApproveStart',
                    //             NodeName: '或签分流',
                    //             ico: 'el-icon-shopping-cart-full',
                    //             // 自定义覆盖样式
                    //             style: {},
                    //             Disabled:true,
                    //         }
                    //         , {
                    //             id: '23',
                    //             type: 'Merge',
                    //             NodeName: '合并节点',
                    //             ico: 'el-icon-shopping-cart-full',
                    //             // 自定义覆盖样式
                    //             style: {},
                    //             Disabled:true,
                    //         }
                    //     ]
                    // }
                ],
                nodeMenu: {}
            }
        },
        components: {
            draggable
        },
        created() {
            /**
             * 以下是为了解决在火狐浏览器上推拽时弹出tab页到搜索问题
             * @param event
             */
            if (this.isFirefox()) {
                document.body.ondrop = function (event) {
                    // 解决火狐浏览器无法获取鼠标拖拽结束的坐标问题
                    mousePosition.left = event.layerX
                    mousePosition.top = event.clientY - 50
                    event.preventDefault();
                    event.stopPropagation();
                }
            }
        },
        methods: {
            draggableOptions(subMenu){
                var self = this;
                var result = {
                    preventOnFilter: false,
                    sort: false,
                    disabled: false,
                    ghostClass: 'tt',
                    // 不使用H5原生的配置
                    forceFallback: true,
                    // 拖拽的时候样式
                    // fallbackClass: 'flow-node-draggable'
                }
                if (subMenu.Disabled === true) {
                    result.disabled = true;
                }
                return result;
            },
            // 根据类型获取左侧菜单对象
            getMenuByType(type) {
                for (let i = 0; i < this.menuList.length; i++) {
                    let children = this.menuList[i].children;
                    for (let j = 0; j < children.length; j++) {
                        if (children[j].type === type) {
                            return children[j]
                        }
                    }
                }
            },
            // 拖拽开始时触发
            move(evt, a, b, c) {
                // var type = evt.item.attributes.type.nodeValue
                var type = evt.item.attributes['data-type'].nodeValue
                this.nodeMenu = this.getMenuByType(type)
            },
            // 拖拽结束时触发
            end(evt, e) {
                this.$emit('addNode', evt, this.nodeMenu, mousePosition)
            },
            // 是否是火狐浏览器
            isFirefox() {
                var userAgent = navigator.userAgent
                if (userAgent.indexOf("Firefox") > -1) {
                    return true
                }
                return false
            }
        }
    }
</script>
<style scoped lang="scss">
.wf-node-btn{
    background-color: #e8f4ff;
    border-color: #d1e9ff;
    color: #333;
}
.wf-node-btn:hover{
    cursor: move;
}
.wf-node-btn.disabled{
    background-color: #d5d5d5;
    border-color: #d5d5d5;
}
.wf-node-btn.disabled:hover{
    cursor: default;
}
.flow-all-node{
    .icon{
        width:15px;
        margin-right: 3px;;
    }
}
</style>