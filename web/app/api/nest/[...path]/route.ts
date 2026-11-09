import { NextRequest, NextResponse } from 'next/server';

const nest = process.env.NEST_API_URL || 'http://127.0.0.1:3010';

async function proxy(request: NextRequest, path: string[]): Promise<NextResponse> {
  const target = `${nest}/studio/${path.join('/')}${request.nextUrl.search}`;
  const token = request.cookies.get('studio_session')?.value;
  const method = request.method;
  const response = await fetch(target, {
    method,
    redirect: 'manual',
    headers: {
      'Content-Type': request.headers.get('content-type') || 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: method === 'GET' || method === 'HEAD' ? undefined : await request.text(),
  });
  const location = response.headers.get('location');
  if (location && response.status >= 300 && response.status < 400) {
    return NextResponse.redirect(location);
  }
  const text = await response.text();
  if (path.join('/') === 'enter' && response.ok) {
    const parsed = JSON.parse(text) as { sessionToken?: string };
    const next = NextResponse.json({ ok: true });
    if (parsed.sessionToken) {
      next.cookies.set('studio_session', parsed.sessionToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });
    }
    return next;
  }
  return new NextResponse(text, {
    status: response.status,
    headers: { 'Content-Type': response.headers.get('content-type') || 'application/json' },
  });
}

export function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return context.params.then((params) => proxy(request, params.path));
}

export function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return context.params.then((params) => proxy(request, params.path));
}

export function PUT(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return context.params.then((params) => proxy(request, params.path));
}
