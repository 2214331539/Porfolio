import { BrowserRouter } from 'react-router-dom';
import { SiteProvider } from './providers/site-provider';
import { AppRouter } from './router/AppRouter';

export function App() {
  return <BrowserRouter><SiteProvider><AppRouter/></SiteProvider></BrowserRouter>;
}

