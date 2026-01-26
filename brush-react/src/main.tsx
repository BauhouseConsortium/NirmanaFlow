import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// StrictMode disabled for better performance in development
// It causes double renders which is problematic with React Flow
createRoot(document.getElementById('root')!).render(<App />)
