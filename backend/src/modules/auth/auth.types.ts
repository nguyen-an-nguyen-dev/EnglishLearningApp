export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  xp: number;
  streak: number;
}

declare global {
  namespace Express {
    interface Request {
      auth?: { userId: number };
    }
  }
}