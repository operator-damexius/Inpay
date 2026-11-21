import { NextResponse } from 'next/server';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function withErrorHandler<TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<NextResponse>
) {
  return async (...args: TArgs): Promise<NextResponse> => {
    try {
      const request = args[0];
      const pathname = request instanceof Request ? new URL(request.url).pathname : '';
      if (
        request instanceof Request &&
        ['/api/inventory', '/api/payroll', '/api/ledger', '/api/employee-accounts']
          .some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
      ) {
        const { getAdminUsername } = await import('@/lib/admin-auth');
        if (!(await getAdminUsername(request))) {
          return NextResponse.json({ error: 'Admin login required.' }, { status: 401 });
        }
      }
      return await handler(...args);
    } catch (error: unknown) {
      console.error('API Error:', error);
      const message = error instanceof Error ? error.message : 'Internal Server Error';
      return NextResponse.json(
        { error: message },
        { status: error instanceof ApiError ? error.status : 500 }
      );
    }
  };
}
