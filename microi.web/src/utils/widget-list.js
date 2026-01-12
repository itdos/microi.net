//页面信息
export const formData = {
    Id: "", //页面ID
    Title: "", //页面标题
    Number: "", //页面编号
    Desc: "", //页面描述
    JsonObj: {
        formConfig: {}, //页面配置
        widgetList: [] //组件列表
    }
};

//页面属性
export const formOpton = {
    gutter: 5, //栅格间距
    mask: true, //是否开启遮罩
    sort: true, //是否开启拖拽
    dynamicStyle: {
        padding: "0px 5px", //内边距
        backgroundColor: "#fff", //背景色
        opacity: 1 //透明度
    }
};

//包装器属性(通用)
export const wrapperOption = {
    id: "", //包装器ID
    span: 8, //占位(栅格)
    offset: 0, //栅格左侧的间隔格数
    push: 0, //栅格向右移动格数
    pull: 0, //栅格向左移动格数
    height: 300, //高度
    dynamicStyle: {
        padding: "0px", //内边距
        margin: "5px 0 0 0", //外边距
        backgroundColor: "transparent", //背景色,默认透明
        borderRadius: "0px", //边框圆角
        border: "0px solid #eee" //边框
    },
    card_slot: {
        hidden: true, //是否显示卡片
        title: "未命名", //卡片标题
        title_hidden: true, //是否显示标题
        title_style_textAlign: "left", //标题对齐方式
        title_style_padding: "10px 20px", //标题内边距
        title_style_fontSize: "14px", //标题字体大小
        title_style_color: "#333", //标题颜色
        title_style_height: "30px", //标题高度
        body_style_padding: "15px", //内容内边距
        body_style_pbackgroundColor: "#fff", //内容背景色
        more_hidden: true, //更多是否显示
        more_icon: "el-icon-arrow-right", //更多图标
        more_text: "更多", //更多文字
        more_linkurl: "/", //更多链接
        more_linktype: "_parent" //更多链接类型
    }
};

// 编辑器左侧组件列表
const list = [
    {
        type: "image",
        label: "图片组件",
        icon: "el-icon-picture",
        hidden: false,
        wrapperOption: {},
        widgetOption: {
            imgurl: require("/public/formdesigner/1.jpg")
        }
    },
    {
        type: "video",
        label: "视频组件",
        icon: "el-icon-film",
        hidden: false,
        wrapperOption: {},
        widgetOption: {
            videourl: require("/public/formdesigner/default.mp4"),
            controls: false,
            autoplay: true,
            loop: true,
            muted: true,
            class: "video"
        }
    },
    {
        type: "browser",
        label: "浏览器",
        icon: "el-icon-eleme",
        hidden: false,
        wrapperOption: {},
        widgetOption: {
            pageurl: "https://element-plus.org/zh-CN/#/zh-CN"
        }
    },
    {
        type: "echart",
        label: "图表组件",
        category: "item",
        icon: "el-icon-s-data",
        hidden: false,
        wrapperOption: {},
        widgetOption: {
            isShow: false,
            jsonStr: "", // 自定义json字符串,配置后自动排除其他配置(优先级高)
            dataUrl: "", //https://localhost:7101/api/EchartDatas/GetLineData
            type: "bar", // 'bar' | 'pie' | 'line'
            title_text: "", //标题
            title_subtext: "", //副标题
            legend_show: true, //是否显示图例
            tooltip_show: true, //是否显示提示框
            tooltip_trigger: "axis", // 'item' | 'axis' | 'none'
            toolbox_show: true, //是否显示工具箱
            series_label_show: true,
            series_label_position: "inside"
        } //组件配置(每个组件都有自己个性化属性设置参数)
    },
    {
        type: "carousel",
        label: "轮播图",
        icon: "el-icon-money",
        hidden: false,
        wrapperOption: {},
        widgetOption: {
            dataUrl: "", //数据源地址
            imgarr: [
                {
                    id: "1",
                    url: require("/public/formdesigner/2.jpg")
                },
                {
                    id: "2",
                    url: require("/public/formdesigner/3.jpg")
                }
            ],

            interval: 3000, //自动切换的时间间隔，单位为毫秒
            direction: "horizontal", //轮播方向 vertical/horizontal
            position: "", //指示器的位置	  'outside' | 'none' | 'nothing'
            type: true, //'card' | ''
            arrow: "hover" //切换箭头的显示时机 always/hover/never
        }
    },
    {
        type: "statistic",
        label: "统计数值",
        icon: "el-icon-postcard",
        hidden: false,
        wrapperOption: {},
        widgetOption: {
            title: "增长人数",
            titleStyle: {
                color: "#606266",
                fontSize: "16px",
                fontWeight: "400",
                margin: "0px 0px 10px 0"
            },
            valueStyle: {
                color: "#000",
                fontSize: "22px",
                fontWeight: "400"
            },
            formatter: "2301,343.12",
            icon: "el-icon-star-on",
            iconcolor: "red"
        }
    }
];

for (let i = 0, len = list.length; i < len; i++) {
    const item = list[i];
    item.wrapperOption = {
        ...wrapperOption,
        ...item.wrapperOption
    };
}

export default list;
