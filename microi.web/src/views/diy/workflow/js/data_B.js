let dataB = {
    FlowName: "流程B",
    WF_Node: [
        {
            Id: "111-222",
            NodeName: "开始节点",
            type: "task",
            left: "18px",
            top: "223px",
            ico: "el-icon-user-solid",
            state: "success"
            // viewOnly: true
        },
        {
            Id: "nodeB",
            type: "task",
            NodeName: "项目经理",
            left: "351px",
            top: "96px",
            ico: "el-icon-goods",
            state: "error"
        },
        {
            Id: "nodeC",
            NodeName: "产品经理",
            type: "task",
            left: "354px",
            top: "351px",
            ico: "el-icon-present",
            state: "warning"
        },
        {
            Id: "nodeD",
            NodeName: "总经理",
            type: "task",
            left: "723px",
            top: "215px",
            ico: "el-icon-present",
            state: "running"
        }
    ],
    WF_Line: [
        {
            Id: "A111",
            FromNodeId: "111-222",
            ToNodeId: "nodeB",
            LineName: "条件一"
        },
        {
            Id: "A222",
            FromNodeId: "111-222",
            ToNodeId: "nodeC",
            LineName: "条件二"
        },
        {
            Id: "A333",
            FromNodeId: "nodeB",
            ToNodeId: "nodeD"
        },
        {
            Id: "A444",
            FromNodeId: "nodeC",
            ToNodeId: "nodeD"
        }
    ]
};

export function getDataB() {
    return dataB;
}
