import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Suppress harmless Mutative "rawReturn" performance warnings
const originalWarn = console.warn;
console.warn = (...args) => {
    const msg = args[0]?.toString?.() || '';
    if (msg.includes('rawReturn') || msg.includes('does not contain any draft')) {
        return; 
    }
    originalWarn.apply(console, args);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
