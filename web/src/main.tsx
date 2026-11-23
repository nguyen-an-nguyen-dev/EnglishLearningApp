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
import './lesson.css'
import './landing.css'
import './learning-modes.css'
import './translate.css'
import './dashboard.css'
import './rankings.css'
import './shop.css'
import './gara.css'
import './buddy.css'
import './admin.css'
import './admin-console.css'
import './motion.css'
import './review.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AuthProvider } from './context/AuthContext'
import { LearningProvider } from './context/LearningContext'
import { WalletProvider } from './context/WalletContext'
import { LanguageProvider } from './context/LanguageContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <LanguageProvider>
        <AuthProvider>
          <LearningProvider>
            <WalletProvider>
              <App />
            </WalletProvider>
          </LearningProvider>
        </AuthProvider>
      </LanguageProvider>
    </ErrorBoundary>
  </StrictMode>,
)
