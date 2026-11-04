/**
 * Standard API Client adhering to Phase F API and Application Contract.
 */

export interface ApiMeta {
  request_id: string;
  timestamp?: string;
  pagination?: {
    total: number;
    page: number;
    per_page: number;
    last_page: number;
  };
  [key: string]: unknown;
}

export interface ApiSuccessResponse<T> {
  data: T;
  meta: ApiMeta;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  error: ApiErrorDetail;
  meta: ApiMeta;
}

export class ApiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: Record<string, unknown>;
  public readonly requestId?: string;

  constructor(
    message: string,
    code: string,
    status: number,
    details?: Record<string, unknown>,
    requestId?: string
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
    this.requestId = requestId;
  }
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
  tenant?: string;
  token?: string;
  /** Do not run the global 401 handler (platform console has its own session). */
  skipUnauthorizedHandler?: boolean;
}

export class ApiClient {
  private readonly baseUrl: string;
  private defaultTenant?: string;
  private authToken?: string;
  /** Called when any request returns HTTP 401 */
  private onUnauthorized?: () => void;

  constructor(baseUrl?: string, defaultTenant?: string, authToken?: string) {
    this.baseUrl = (
      baseUrl ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:8000/api/v1"
    ).replace(/\/$/, "");
    this.defaultTenant = defaultTenant;
    this.authToken = authToken;
  }

  /** Register a callback invoked on every HTTP 401 response. */
  public setUnauthorizedHandler(handler: () => void): void {
    this.onUnauthorized = handler;
  }

  /**
   * Set default tenant slug for all subsequent requests.
   */
  public setTenant(tenantSlug: string): void {
    this.defaultTenant = tenantSlug;
  }

  /**
   * Set default bearer token for all subsequent requests.
   */
  public setToken(token: string | null): void {
    this.authToken = token || undefined;
  }

  /**
   * Send an HTTP request and unpack the standard response envelope.
   */
  public async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<ApiSuccessResponse<T>> {
    const { body, params, headers, ...restOptions } = options;

    let url = endpoint.startsWith("http")
      ? endpoint
      : `${this.baseUrl}/${endpoint.replace(/^\//, "")}`;

    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += (url.includes("?") ? "&" : "?") + queryString;
      }
    }

    const requestHeaders = new Headers(headers);

    const tenantSlug = options.tenant || this.defaultTenant;
    if (tenantSlug && !requestHeaders.has("X-Tenant-Slug")) {
      requestHeaders.set("X-Tenant-Slug", tenantSlug);
    }

    const authToken = options.token || this.authToken;
    if (authToken && !requestHeaders.has("Authorization")) {
      requestHeaders.set("Authorization", `Bearer ${authToken}`);
    }

    if (!requestHeaders.has("Accept")) {
      requestHeaders.set("Accept", "application/json");
    }

    const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

    if (body !== undefined && !isFormData && !requestHeaders.has("Content-Type")) {
      requestHeaders.set("Content-Type", "application/json");
    }

    const response = await fetch(url, {
      ...restOptions,
      headers: requestHeaders,
      body: isFormData ? (body as FormData) : body !== undefined ? JSON.stringify(body) : undefined,
    });

    const requestId =
      response.headers.get("X-Request-ID") || undefined;

    let jsonResponse: unknown;
    try {
      jsonResponse = await response.json();
    } catch {
      if (!response.ok) {
        throw new ApiError(
          response.statusText || "Request failed",
          "HTTP_ERROR_" + response.status,
          response.status,
          undefined,
          requestId
        );
      }
      return {
        data: {} as T,
        meta: {
          request_id: requestId || "",
        },
      };
    }

    if (!response.ok) {
      const errorData = jsonResponse as Partial<ApiErrorResponse>;
      const code =
        errorData.error?.code || "HTTP_ERROR_" + response.status;
      const message =
        errorData.error?.message || response.statusText || "Request failed";
      const details = errorData.error?.details;
      const resRequestId = errorData.meta?.request_id || requestId;

      const err = new ApiError(message, code, response.status, details, resRequestId);
      if (response.status === 401 && this.onUnauthorized && !options.skipUnauthorizedHandler) {
        this.onUnauthorized();
      }
      throw err;
    }

    return jsonResponse as ApiSuccessResponse<T>;
  }

  /** Fetch a binary resource (e.g. a private image) with the same auth/tenant headers. */
  public async blob(endpoint: string, options: RequestOptions = {}): Promise<Blob> {
    const url = endpoint.startsWith("http") ? endpoint : `${this.baseUrl}/${endpoint.replace(/^\//, "")}`;
    const headers = new Headers(options.headers);
    const tenantSlug = options.tenant || this.defaultTenant;
    if (tenantSlug) headers.set("X-Tenant-Slug", tenantSlug);
    const authToken = options.token || this.authToken;
    if (authToken) headers.set("Authorization", `Bearer ${authToken}`);
    const response = await fetch(url, { method: "GET", headers });
    if (!response.ok) {
      throw new ApiError(response.statusText || "Request failed", "HTTP_ERROR_" + response.status, response.status);
    }
    return response.blob();
  }

  /** Absolute URL for a path under the API base (used for <img src> on public pages). */
  public url(endpoint: string): string {
    return `${this.baseUrl}/${endpoint.replace(/^\//, "")}`;
  }

  public get<T>(endpoint: string, options?: RequestOptions): Promise<ApiSuccessResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: "GET" });
  }

  public post<T>(
    endpoint: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<ApiSuccessResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: "POST", body });
  }

  public put<T>(
    endpoint: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<ApiSuccessResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: "PUT", body });
  }

  public patch<T>(
    endpoint: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<ApiSuccessResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: "PATCH", body });
  }

  public delete<T>(endpoint: string, options?: RequestOptions): Promise<ApiSuccessResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: "DELETE" });
  }
}

export const apiClient = new ApiClient();
