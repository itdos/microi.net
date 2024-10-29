import DiySqlDesign from './src/components/diy-SqlDesign'
import _Vue from 'vue'

// DiySqlDesign.install = Vue => {
//     if (!Vue) {
//         window.Vue = Vue = _Vue
//     }
//     Vue.component(DiySqlDesign.name, DiySqlDesign)
// }
// export {
//     DiySqlDesign
// }

const sqldesign = {
    install:function(Vue){
        if (!Vue) {
            window.Vue = Vue = _Vue
        }
        Vue.component(DiySqlDesign.name, DiySqlDesign)
    }
}

export default sqldesign