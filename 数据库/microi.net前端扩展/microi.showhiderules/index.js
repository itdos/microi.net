import DiyshowHide from './src/components/diy-showhideRules'
import _Vue from 'vue'

// DiyshowHide.install = Vue => {
//     if (!Vue) {
//         window.Vue = Vue = _Vue
//     }
//     Vue.component(DiyshowHide.name, DiyshowHide)
// }
// export {
//     DiyshowHide
// }

const diyshowhide = {
    install:function(Vue){
        if (!Vue) {
            window.Vue = Vue = _Vue
        }
        Vue.component(DiyshowHide.name, DiyshowHide)
    }
}

export default diyshowhide