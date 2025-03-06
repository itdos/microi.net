import nodeColConfig from './src/components/node-col-config'
import _Vue from 'vue'

// nodeColConfig.install = Vue => {
//     if (!Vue) {
//         window.Vue = Vue = _Vue
//     }
//     Vue.component(nodeColConfig.name, nodeColConfig)
// }
// export {
//     nodeColConfig
// }

const NodeColConfig = {
    install:function(Vue){
        if (!Vue) {
            window.Vue = Vue = _Vue
        }
        Vue.component(nodeColConfig.name, nodeColConfig)
    }
}

export default NodeColConfig