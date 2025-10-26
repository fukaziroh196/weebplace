import App from './App.svelte';
import './app.css';
import { theme } from './stores/theme';

const app = new App({
  target: document.getElementById('app')
});

export default app;