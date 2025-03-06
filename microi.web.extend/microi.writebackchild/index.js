import DiyWritebackChild from './src/components/diy-writebackchild'
import _Vue from 'vue'

// DiyWritebackChild.install = Vue => {
//     if (!Vue) {
//         window.Vue = Vue = _Vue
//     }
//     Vue.component(DiyWritebackChild.name, DiyWritebackChild)
// }
// export {
//     DiyWritebackChild
// }

const WritebackChild = {
    install:function(Vue){
        if (!Vue) {
            window.Vue = Vue = _Vue
        }
        Vue.component(DiyWritebackChild.name, DiyWritebackChild)
    }
}

export default WritebackChild