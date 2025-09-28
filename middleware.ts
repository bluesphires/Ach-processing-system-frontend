import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Define protected routes that require authentication
  const protectedRoutes = ['/dashboard'];
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  
  // If accessing a protected route, always redirect to login
  // The client-side authentication will handle the actual auth check
  if (isProtectedRoute) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  // If accessing root, redirect to login (let client handle auth state)
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - login (login page)
     * - register (register page)
     * - public files
     */
    '/((?!api|_next/static|_next/image|favicon.ico|login|register|.*\\.).*)',
  ],
};
