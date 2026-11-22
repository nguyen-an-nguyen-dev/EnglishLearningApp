export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface VerifyRegistrationInput {
  email: string;
  code: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface ProfileUpdateInput {
  name: string;
  email: string;
}

export interface PasswordChangeInput {
  currentPassword: string;
  newPassword: string;
}

/** `admin` unlocks the content console (`/api/admin/*`); every account starts as a learner. */
export type UserRole = 'learner' | 'admin';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  avatar_url: string | null;
  xp: number;
  coins: number;
  /** Derived from xp via the level curve; never stored on the row. */
  level: number;
  streak: number;
  role: UserRole;
  /** False for accounts created by a social provider that never set a password. */
  has_password: boolean;
}

export type SocialProvider = 'google' | 'facebook';

export interface LinkedProvider {
  provider: SocialProvider;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  linked_at: string;
  last_login_at: string | null;
}

export interface ProviderLinkCandidate {
  provider: SocialProvider;
  provider_user_id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
}

declare global {
  namespace Express {
    interface Request {
      auth?: { userId: number };
    }
  }
}
