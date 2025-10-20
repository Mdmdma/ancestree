import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Log build information for deployment verification
console.log('%c🌳 Ancestree App', 'font-size: 20px; font-weight: bold; color: #4CAF50;');
console.log('%cBuild Time:', 'font-weight: bold;', __BUILD_TIME__);
console.log('%cTo verify deployment, check this timestamp matches your deployment time', 'color: #666;');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
