// 演示插件主入口文件
import Vue from 'vue'

// 插件路由配置
export const routes = [
  {
    path: '/demo',
    name: 'DemoPlugin',
    component: {
      template: `
        <div class="demo-plugin-page">
          <h2>演示插件页面</h2>
          <p>这是一个演示插件，用于展示插件系统的动态发现功能。</p>
          <el-button type="primary" @click="showMessage">点击测试</el-button>
        </div>
      `,
      methods: {
        showMessage() {
          this.$message.success('演示插件功能正常！')
        }
      }
    }
  }
]

// 插件组件
export const components = {
  DemoComponent: {
    template: `
      <div class="demo-component">
        <h3>演示组件</h3>
        <p>这是一个来自演示插件的组件。</p>
      </div>
    `
  }
}

// 插件初始化函数
export async function init() {
  console.log('演示插件初始化完成')
}

// 插件卸载函数
export async function destroy() {
  console.log('演示插件卸载完成')
}
