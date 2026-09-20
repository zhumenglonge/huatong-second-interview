import { NextResponse } from 'next/server';
import { startLogin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/login — start the interactive `qoderclicn login` OAuth flow on
 * the server. Idempotent while a login is already pending. Returns the current
 * snapshot; the client polls /api/auth/status for the URL + completion.
 *
 * Local-only: this authenticates the machine running the Next server. See
 * lib/auth.ts for the full rationale.
 */
export async function POST() {
  const state = startLogin();
  return NextResponse.json(state);
}
