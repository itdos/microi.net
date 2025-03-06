/*
    引入公共及全局组件配置
*/ 

import winBar from './components/winbar'
// import sideBar from './components/sidebar'
// import recordList from './components/recordList'
// import contactList from './components/contact'

import $ from 'jquery'

// 引入wcPop弹窗插件
//发布microi.net时暂时注释 --2022-06-10
// * 此组件打包后，会导致microi.net报致命错：
// * microi.net.js?9edc:52 Uncaught ReferenceError: fn is not defined
//    at eval (microi.net.js?9edc:52)
// import wcPop from './js/wcPop/wcPop'
// import './js/wcPop/skin/wcPop.css'
//---END

// 引入饿了么pc端UI库
// import elementUI from 'element-ui'
// import 'element-ui/lib/theme-chalk/index.css'

// 引入图片预览插件
//发布microi.net时暂时注释 --2022-06-10
// import photoPreview from 'vue-photo-preview'
// import 'vue-photo-preview/dist/skin.css'
//---END

// 引入自定义滚动条插件
import geminiScrollbar from 'vue-gemini-scrollbar'


// 引入加载更多插件
import infiniteLoading from 'vue-infinite-scroll'


// 引入高德地图
// import vueAMap from 'vue-amap'


const install = Vue => {
    Vue.component('win-bar', winBar)
    // Vue.component('side-bar', sideBar)
    // Vue.component('record-list', recordList)
    // Vue.component('contact-list', contactList)

    // Vue.use(elementUI)
    //发布microi.net时暂时注释 --2022-06-10
    // Vue.use(photoPreview, {
    //     loop: false,
    //     fullscreenEl: true, 
    //     arrowEl: true, 
    // });
    //---END
    Vue.use(geminiScrollbar)
    Vue.use(infiniteLoading)
    // Vue.use(vueAMap)
    // vueAMap.initAMapApiLoader({
    //     key: '99b272c930081b69507b218d660be3dc ',//"e1dedc6bdd765d46693986ff7ff969f4",
    //     plugin: [
    //         "AMap.Autocomplete", //输入提示插件
    //         "AMap.PlaceSearch", //POI搜索插件
    //         "AMap.Scale", //右下角缩略图插件 比例尺
    //         "AMap.OverView", //地图鹰眼插件
    //         "AMap.ToolBar", //地图工具条
    //         "AMap.MapType", //类别切换控件，实现默认图层与卫星图、实施交通图层之间切换的控制
    //         "AMap.PolyEditor", //编辑 折线多，边形
    //         "AMap.CircleEditor", //圆形编辑器插件
    //         "AMap.Geolocation" //定位控件，用来获取和展示用户主机所在的经纬度位置
    //     ], uiVersion: "1.0"
    // });

}
export default install