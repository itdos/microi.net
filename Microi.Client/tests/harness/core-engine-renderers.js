import { createApp, h, ref } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import LegacyHtmlEditor from '../../src/views/page-engine/engine/components/codemirror/index.vue'
import PieChart from '../../src/views/page-engine/engine/components/vuechart/PieChart.vue'

const Harness = {
  setup() {
    const editorOutput = ref('')
    const mode = new URLSearchParams(window.location.search).get('mode') || 'editor'
    const chartData = {
      labels: ['已完成', '处理中'],
      datasets: [{
        data: [72, 28],
        backgroundColor: ['#409eff', '#e6a23c'],
        borderColor: ['#ffffff', '#ffffff'],
        borderWidth: 1,
      }],
    }
    return () => h('main', {
      style: 'display:grid;grid-template-columns:minmax(0,2fr) minmax(280px,1fr);gap:24px;padding:24px',
    }, mode === 'editor' ? [
      h('section', { 'data-testid': 'legacy-editor', style: 'width:900px;max-width:100%' }, [
        h(LegacyHtmlEditor, {
          htmlStr: "<section data-source='legacy'>吾码</section>",
          onEditorContent: value => { editorOutput.value = value },
        }),
        h('output', { 'data-testid': 'editor-output' }, editorOutput.value),
      ]),
    ] : [
      h('section', {
        'data-testid': 'echarts-pie',
        style: 'width:320px;height:320px',
      }, [h(PieChart, { chartData })]),
    ])
  },
}

const app = createApp(Harness)
app.config.globalProperties.$t = key => key === 'Msg.PageEngine.confirm' ? '确认修改' : key
app.use(ElementPlus)
app.mount('#app')
