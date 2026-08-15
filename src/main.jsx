import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { initTheme } from './lib/theme';
import './styles/global.css';

// 在 React 掛載前先套用，深色使用者才不會看到一閃而過的白畫面。
initTheme();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
