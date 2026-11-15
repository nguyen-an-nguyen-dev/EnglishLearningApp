import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/be-vietnam-pro/400.css'
import '@fontsource/be-vietnam-pro/500.css'
import '@fontsource/be-vietnam-pro/600.css'
import '@fontsource/be-vietnam-pro/700.css'
import '@fontsource/be-vietnam-pro/800.css'
import '@fontsource-variable/fraunces'
import '@fontsource-variable/fraunces/wght-italic.css'
// Gara/Thi Đấu use the rounded game face from the design reference; the rest of
// the app keeps Be Vietnam Pro.
import '@fontsource/baloo-2/600.css'
import '@fontsource/baloo-2/700.css'
import '@fontsource/baloo-2/800.css'
import './index.css'
import './landing.css'
import './learning-modes.css'
import './translate.css'
import './dashboard.css'
import './shop.css'
import './gara.css'
import './buddy.css'
import './admin.css'
import './admin-console.css'
import './motion.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext'
import { LearningProvider } from './context/LearningContext'
import { WalletProvider } from './context/WalletContext'
import { LanguageProvider } from './context/LanguageContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <AuthProvider>
        <LearningProvider>
          <WalletProvider>
            <App />
          </WalletProvider>
        </LearningProvider>
      </AuthProvider>
    </LanguageProvider>
  </StrictMode>,
)
