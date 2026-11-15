import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function authorizeAppRequest(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url && !key && !serviceKey) return { demo: true as const };
  if (!url || !key || !serviceKey || !process.env.APP_OWNER_EMAIL) {
    return NextResponse.json({ error: 'App authentication is not fully configured' }, { status: 503 });
  }
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return NextResponse.json({ error: 'Session expired. Sign in again.' }, { status: 401 });
  if (data.user.email?.toLowerCase() !== process.env.APP_OWNER_EMAIL.toLowerCase()) {
    return NextResponse.json({ error: 'This account is not allowed to use this private app' }, { status: 403 });
  }
  return { demo: false as const, user: data.user };
}

export function isAuthError(result: Awaited<ReturnType<typeof authorizeAppRequest>>): result is NextResponse {
  return result instanceof NextResponse;
}
