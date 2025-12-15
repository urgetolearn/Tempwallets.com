export interface UserProfile {
  id: string;
  email: string | null;
  name: string | null;
  picture: string | null;
  googleId: string | null;
  createdAt: string;
  lastLoginAt: string;
}

