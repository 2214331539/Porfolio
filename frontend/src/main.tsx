import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter/index.css';
import { App } from './app/App';
import './app/styles/tokens.css';
import './app/styles/base.css';
import './app/styles/site.css';
import './app/styles/prose.css';
import './app/styles/about-resume.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
