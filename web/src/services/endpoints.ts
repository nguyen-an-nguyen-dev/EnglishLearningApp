import type { SocialProvider } from '../types/auth';

/** Every auth URL in one place; services never inline endpoint strings. */
export const AUTH_ENDPOINTS = {
  login: '/api/auth/login',
  register: '/api/auth/register',
  registerStart: '/api/auth/register/start',
  registerVerify: '/api/auth/register/verify',
  registerResend: '/api/auth/register/resend',
  google: '/api/auth/google',
  facebook: '/api/auth/facebook',
  providers: '/api/auth/providers',
  providerLinks: '/api/auth/providers/links',
  providerLink: (provider: SocialProvider) => `/api/auth/providers/${provider}/link`,
  provider: (provider: SocialProvider) => `/api/auth/providers/${provider}`,
  me: '/api/auth/me',
  profile: '/api/auth/profile',
  avatar: '/api/auth/avatar',
  password: '/api/auth/password',
} as const;
