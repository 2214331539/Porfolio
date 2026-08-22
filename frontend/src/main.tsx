import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './app/styles/global.css';
import './app/styles/theme.css';
import './app/styles/landing-overrides.css';
import './app/styles/content-overrides.css';
import './app/styles/navigation-overrides.css';
import './app/styles/about-resume.css';
import './app/styles/apple-polish.css';
import './app/styles/admin-overrides.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);
