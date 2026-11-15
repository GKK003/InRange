'use client';
import { createClient } from '@supabase/supabase-js';

let client: ReturnType<typeof createClient> | null = null;
export function authClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!client) client = createClient(url, key);
  return client;
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const supabase = authClient();
  const session = supabase ? (await supabase.auth.getSession()).data.session : null;
  const headers = new Headers(init.headers);
  if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`);
  return fetch(input, { ...init, headers });
}
