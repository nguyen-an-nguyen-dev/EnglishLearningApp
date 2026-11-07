export interface RegisterInput {
  name: string;
  email: string;
  password: string;
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
  xp: number;
  streak: number;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      auth?: { userId: number };
    }
  }
}