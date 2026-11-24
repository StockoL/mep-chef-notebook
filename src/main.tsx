import { render } from 'preact';
import { App } from './ui/app';
// Vite sees a CSS import, bundles the stylesheet and adds a <link> to the page.
import './styles/main.css';

// The one place the app touches the page: find #app and let Preact own it.
const root = document.getElementById('app');
if (!root) throw new Error('#app is missing from index.html');

render(<App />, root);
