import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router.js';
import { initAppearance } from './themes.js';
import './styles/theme.css';
import 'highlight.js/styles/atom-one-dark.css';

// 挂载前先按本地值应用主题与字号（避免首屏闪一下默认外观），后端返回后再以服务端记录为准回灌
initAppearance();
createApp(App).use(router).mount('#app');
