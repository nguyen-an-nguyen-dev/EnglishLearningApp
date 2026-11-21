import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CosmeticsPreview } from './cosmeticsPreview'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CosmeticsPreview />
  </StrictMode>,
)
