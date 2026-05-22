export type UserRole = 'user' | 'admin';
export type UserStatus = 'active' | 'disabled';

export type User = {
  id: string;
  username: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateUserInput = {
  username: string;
  email?: string | null;
  displayName?: string | null;
};

