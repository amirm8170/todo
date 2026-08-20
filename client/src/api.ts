import type { AuthResponse, Todo } from './types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type RequestOptions = RequestInit & {
  skipRefresh?: boolean;
};

function getErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message: unknown }).message;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string') return message;
  }
  return fallback;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);

  if (options.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });

  if (
    response.status === 401 &&
    !options.skipRefresh &&
    path !== '/auth/refresh' &&
    path !== '/auth/login' &&
    path !== '/auth/register'
  ) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return request<T>(path, { ...options, skipRefresh: true });
    }
  }

  if (!response.ok) {
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    throw new ApiError(
      response.status,
      getErrorMessage(payload, response.statusText),
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function refreshSession(): Promise<AuthResponse | null> {
  try {
    const data = await request<AuthResponse>('/auth/refresh', {
      method: 'POST',
      skipRefresh: true,
      signal: AbortSignal.timeout(8000),
    });
    setAccessToken(data.accessToken);
    return data;
  } catch {
    setAccessToken(null);
    return null;
  }
}

export async function login(email: string, password: string) {
  const data = await request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    skipRefresh: true,
  });
  setAccessToken(data.accessToken);
  return data;
}

export async function register(email: string, password: string) {
  const data = await request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    skipRefresh: true,
  });
  setAccessToken(data.accessToken);
  return data;
}

export function logout() {
  return request<void>('/auth/logout', {
    method: 'POST',
    skipRefresh: true,
  });
}

export function getTodos(date: string) {
  return request<Todo[]>(`/todos?date=${encodeURIComponent(date)}`).then((todos) =>
    Array.isArray(todos) ? todos.map(toTodo) : [],
  );
}

export function createTodo(title: string, description: string, taskDate: string) {
  return request<Todo>('/todos', {
    method: 'POST',
    body: JSON.stringify({
      title,
      description: description.trim() ? description : undefined,
      taskDate,
    }),
  }).then(toTodo);
}

export async function updateTodo(
  id: string,
  data: Partial<Pick<Todo, 'title' | 'description' | 'completed' | 'taskDate'>>,
  current: Todo,
) {
  const updated = await request<Partial<Todo>>(`/todos/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return mergeTodo(current, updated);
}

export function deleteTodo(id: string) {
  return request<void>(`/todos/${id}`, { method: 'DELETE' });
}

function toTodo(row: Partial<Todo>): Todo {
  const description =
    typeof row.description === 'string' && row.description.trim()
      ? row.description
      : row.description === null
        ? null
        : undefined;

  return {
    id: String(row.id ?? ''),
    title: typeof row.title === 'string' ? row.title : '',
    description: description ?? null,
    completed: Boolean(row.completed),
    taskDate:
      typeof row.taskDate === 'string' ? row.taskDate.slice(0, 10) : '',
    createdAt: String(row.createdAt ?? ''),
    updatedAt: String(row.updatedAt ?? ''),
  };
}

export function mergeTodo(current: Todo, updated: Partial<Todo>): Todo {
  const defined = Object.fromEntries(
    Object.entries(updated).filter(([, value]) => value !== undefined),
  ) as Partial<Todo>;

  const merged = { ...current, ...defined };

  return {
    ...merged,
    id: merged.id || current.id,
    title:
      typeof merged.title === 'string' && merged.title.trim()
        ? merged.title
        : current.title,
    description:
      updated.description === undefined
        ? current.description
        : typeof updated.description === 'string' && updated.description.trim()
          ? updated.description
          : null,
    completed:
      typeof updated.completed === 'boolean'
        ? updated.completed
        : current.completed,
    taskDate: merged.taskDate || current.taskDate,
    createdAt: merged.createdAt || current.createdAt,
    updatedAt: merged.updatedAt || current.updatedAt,
  };
}
