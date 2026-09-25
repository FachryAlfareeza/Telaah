import React from 'react';
import { createRoot } from 'react-dom/client';
import AuthApp from './AuthApp';
import './styles.css';
import './workspace.css';
import './theme.css';
import './auth.css';
createRoot(document.getElementById('root')).render(<AuthApp/>);
