export type User = {
  id: string;
  email: string;
};

export type AuthResponse = {
  accessToken: string;
  user: User;
};

export type Todo = {
  id: string;
  title: string;
  description: string | null;
  completed: boolean;
  taskDate: string;
  createdAt: string;
  updatedAt: string;
};
