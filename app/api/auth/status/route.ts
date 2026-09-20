import { NextResponse } from 'next/server';
import { cancelLogin, getLoginState } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** GET /api/auth/status — poll the current login flow state (idle/pending/success/failed + url). */
export async function GET() {
  return NextResponse.json(getLoginState());
}

/** DELETE /api/auth/status — abort a pending login (e.g. the user dismisses the card). */
export async function DELETE() {
  return NextResponse.json(cancelLogin());
}
