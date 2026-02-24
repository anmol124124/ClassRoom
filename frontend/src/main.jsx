// React and DOM imports
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Import global styles and main App component
import './index.css'
import App from './App.jsx'

// Initialize React app
// createRoot: Creates the root component
// StrictMode: Development mode that helps catch errors
// document.getElementById('root'): Finds the HTML element with id="root" to mount the app
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
