import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token');
  const user = searchParams.get('user');
  const error = searchParams.get('error');

  // Get the return URL from sessionStorage (set before redirect)
  // We'll handle this in the client-side redirect

  if (error) {
    // Redirect to dashboard with error
    return NextResponse.redirect(new URL('/dashboard?error=auth_failed', request.url));
  }

  if (token && user) {
    // Store auth data and redirect
    // We'll use a client-side page to handle the storage and redirect
    const redirectUrl = new URL('/auth/callback/handle', request.url);
    redirectUrl.searchParams.set('token', token);
    redirectUrl.searchParams.set('user', user);
    const returnUrl = searchParams.get('returnUrl');
    if (returnUrl) {
      redirectUrl.searchParams.set('returnUrl', returnUrl);
    }
    return NextResponse.redirect(redirectUrl);
  }

  // No token/user, redirect to dashboard
  return NextResponse.redirect(new URL('/dashboard', request.url));
}

