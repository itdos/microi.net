import { createApp } from 'vue';
import { initMciDesign } from '@microi/mci-ui';
import App from './App.vue';
import './style.css';
initMciDesign();
createApp(App).mount('#app');
