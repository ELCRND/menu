import { createApp } from "vue";
import PrimeVue from "primevue/config";
import Aura from "@primeuix/themes/aura";
import "primeicons/primeicons.css";
import "./style.css";

// import { createPinia } from 'pinia'

import App from "./App.vue";
import router from "./router";

const app = createApp(App);

app.use(PrimeVue, {
  license: import.meta.env.VITE_PRIMEUI_LICENSE,
  theme: {
    preset: Aura,
  },
});

// app.use(createPinia())
app.use(router);

app.mount("#app");
