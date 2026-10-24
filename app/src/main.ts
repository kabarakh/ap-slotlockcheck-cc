import { createApp } from 'vue';
import { createPinia } from 'pinia';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import Tooltip from 'primevue/tooltip';
import 'primeicons/primeicons.css';

import App from './App.vue';
import { i18n } from './i18n';
import router from './router';
import { DARK_MODE_CLASS, SlotlockPreset } from './theme';
import './styles/main.css';

const app = createApp(App);
const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);

app.use(pinia);
app.use(i18n);
app.use(PrimeVue, { theme: { preset: SlotlockPreset, options: { darkModeSelector: `.${DARK_MODE_CLASS}` } } });
app.use(ToastService);
app.directive('tooltip', Tooltip);
app.use(router);

app.mount('#app');
