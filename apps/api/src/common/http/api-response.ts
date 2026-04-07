export class ApiResponse {
  static ok<T>(data: T) {
    return {
      success: true as const,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  static error(code: string, message: string, details?: unknown) {
    return {
      success: false as const,
      error: {
        code,
        message,
        details,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
