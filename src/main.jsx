import React from 'react';
import ReactDOM from 'react-dom/client';
import Signal, { TWEAKS } from './game/Signal.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(<Signal {...TWEAKS} />);
