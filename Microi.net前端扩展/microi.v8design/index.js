import DiyV8Design from './src/components/diy-v8design'
import _Vue from 'vue'

// DiyV8Design.install = Vue => {
//     if (!Vue) {
//         window.Vue = Vue = _Vue
//     }
//     Vue.component(DiyV8Design.name, DiyV8Design)
// }
// export {
//     DiyV8Design
// }

const V8Design = {
    install:function(Vue){
        if (!Vue) {
            window.Vue = Vue = _Vue
        }
        Vue.component(DiyV8Design.name, DiyV8Design)
    }
}

export default V8Design