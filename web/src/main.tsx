import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/be-vietnam-pro/400.css'
import '@fontsource/be-vietnam-pro/500.css'
import '@fontsource/be-vietnam-pro/600.css'
import '@fontsource/be-vietnam-pro/700.css'
import '@fontsource/be-vietnam-pro/800.css'
import '@fontsource-variable/fraunces'
import '@fontsource-variable/fraunces/wght-italic.css'
import './index.css'
import './landing.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext'
import { LearningProvider } from './context/LearningContext'
import { LanguageProvider } from './i18n'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <AuthProvider>
        <LearningProvider>
          <App />
        </LearningProvider>
      </AuthProvider>
    </LanguageProvider>
  </StrictMode>,
)
