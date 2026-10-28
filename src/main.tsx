import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { installErrorListeners } from './ui/diagnostics'
import './index.css'

installErrorListeners()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
