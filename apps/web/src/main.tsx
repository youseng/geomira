import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import './stage.css';
import './dialogs.css';
import './panels.css';
import './claims.css';
import './phone.css';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('Geomira: #root element missing from index.html');
}
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
