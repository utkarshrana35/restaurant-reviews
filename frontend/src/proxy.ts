import { NextResponse, type NextRequest } from 'next/server';
import { roleFromHint, SESSION_HINT_COOKIE } from '@/lib/sessionHint';

const SIGNED_IN_ONLY = ['/account', '/owner'];
const OWNER_ONLY = ['/owner'];
const GUEST_ONLY = ['/login', '/register', '/reset-password'];

const isUnder = (pathname: string, paths: string[]) =>
  paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));

/**
 * Redirects before a page renders, based on the hint cookie the frontend sets at sign-in. The
 * token cookies never reach page requests (they are scoped to the API), so the hint is all there
 * is to go on.
 *
 * This is a convenience for navigation, not a security boundary: the hint proves nothing, and
 * the API authorises every request itself. When the hint is wrong (a session that has since
 * ended, or an edited cookie), the in-page guards RequireAuth and GuestOnly put the user in the
 * right place, and an owner page opened without being an owner has nothing to show.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const role = roleFromHint(request.cookies.get(SESSION_HINT_COOKIE)?.value);

  if (isUnder(pathname, SIGNED_IN_ONLY) && !role) {
    const login = new URL('/login', request.url);
    login.searchParams.set('next', pathname + search);
    return NextResponse.redirect(login);
  }

  if (isUnder(pathname, OWNER_ONLY) && role !== 'owner') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (GUEST_ONLY.includes(pathname) && role) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

/** The paths the proxy runs on; every other request skips it. */
export const config = {
  matcher: ['/account/:path*', '/owner/:path*', '/login', '/register', '/reset-password'],
};
