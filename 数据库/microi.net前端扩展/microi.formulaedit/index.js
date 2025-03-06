import formulaEdit from './src/components/formulaEdit'
import _Vue from 'vue'

// formulaEdit.install = Vue => {
//     if (!Vue) {
//         window.Vue = Vue = _Vue
//     }
//     Vue.component(formulaEdit.name, formulaEdit)
// }
// export {
//     formulaEdit
// }

const FormulaEdit = {
    install:function(Vue){
        if (!Vue) {
            window.Vue = Vue = _Vue
        }
        Vue.component(formulaEdit.name, formulaEdit)
    }
}

export default FormulaEdit