export interface AuthUser {
  id: number;
  name: string;
  email: string;
  xp: number;
  streak: number;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface LoginResponseData {
  token: string;
  user: AuthUser;
}

export interface RegisterResponseData {
  user: AuthUser;
}

export interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginPayload) => Promise<void>;
  loginWithProvider: (provider: 'google' | 'facebook', token: string) => Promise<void>;
  register: (credentials: RegisterPayload) => Promise<void>;
  changePassword: (payload: { currentPassword: string; newPassword: string }) => Promise<void>;
  updateProfile: (payload: { name: string; email: string }) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => void;
}
