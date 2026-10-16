export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  requestId?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit?: number;
  pageSize?: number;
  totalPages: number;
}

export interface ApiError {
  statusCode?: number;
  code?: string;
  message: string;
  error?: string;
  details?: Record<string, unknown>;
}

export type HealthStatus = 'ok' | 'degraded' | 'error';

export * from './auth';
