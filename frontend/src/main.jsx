import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#fff',
            color: '#1B1B4B',
            border: '1px solid #FF0099',
            fontFamily: 'Inter, sans-serif',
          },
          success: { iconTheme: { primary: '#AAFF00', secondary: '#fff' } },
          error: { iconTheme: { primary: '#FF0099', secondary: '#fff' } },
        }}
      />
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
