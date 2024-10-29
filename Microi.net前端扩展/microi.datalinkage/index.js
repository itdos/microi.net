import DataLinkage from './src/components/diy-DataLinkage'
import _Vue from 'vue'

// DataLinkage.install = Vue => {
//     if (!Vue) {
//         window.Vue = Vue = _Vue
//     }
//     Vue.component(DataLinkage.name, DataLinkage)
// }
// export {
//     DataLinkage
// }

const datalinkage = {
    install:function(Vue){
        if (!Vue) {
            window.Vue = Vue = _Vue
        }
        Vue.component(DataLinkage.name, DataLinkage)
    }
}

export default datalinkage