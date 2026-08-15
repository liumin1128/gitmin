/**
 * React entry point: mounts App to #root
 */
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { configureLocale } from '../../shared/i18n';
import '@vscode/codicons/dist/codicon.css';
import './styles.css';

configureLocale(document.documentElement.lang);

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<App />);
}
