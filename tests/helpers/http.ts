import { NextRequest } from 'next/server';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export function makeRequest(
  method: HttpMethod,
  url: string,
  body?: unknown,
  headers?: Record<string, string>,
): NextRequest {
  const req = new NextRequest(new URL(url, 'http://localhost:7000'), {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return req;
}
