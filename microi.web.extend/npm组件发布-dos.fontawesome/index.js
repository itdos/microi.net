import Fontawesome from './src/components/Fontawesome'
import Test from './src/components/Test'
import _Vue from 'vue'

Fontawesome.install = Vue => {
    if (!Vue) {
        window.Vue = Vue = _Vue
    }
    Vue.component(Fontawesome.name, Fontawesome)
}
Test.install = Vue => {
    if (!Vue) {
        window.Vue = Vue = _Vue
    }
    Vue.component(Test.name, Test)
}
export {
    Fontawesome,
    Test
}