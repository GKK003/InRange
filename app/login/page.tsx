'use client';
import { FormEvent, useEffect, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { Leaf, LockKeyhole } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const configured = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [checkingSession, setCheckingSession] = useState(configured);
  useEffect(() => {
    if (!configured) return;
    const client = authClient();
    if (!client) { setCheckingSession(false); return; }
    let active = true;
    client.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) router.replace('/');
      else setCheckingSession(false);
    });
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (active && session) router.replace('/');
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [configured, router]);
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    const client = authClient();
    if (!client) { setError('Sign-in is not configured yet.'); setBusy(false); return; }
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) { setError('That email and password did not work.'); setBusy(false); return; }
    router.replace('/');
    router.refresh();
  }
  if (checkingSession) return <main className="grid min-h-screen place-items-center bg-[#f6f8f5] text-sm text-[#172522]/50">Checking your session…</main>;
  return <main className="grid min-h-screen place-items-center bg-[#f6f8f5] p-5 text-[#172522]"><div className="w-full max-w-md rounded-[28px] border border-[#e9eee9] bg-white p-8 shadow-xl"><div className="mb-8 flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-[15px] bg-[#1f382e] text-white"><Leaf size={21}/></div><div><div className="font-display text-xl font-extrabold">inrange<span className="text-[#638b78]">.</span></div><div className="text-[10px] font-semibold uppercase tracking-[1.6px] opacity-45">your daily co-pilot</div></div></div><div className="mb-6"><h1 className="font-display m-0 text-2xl font-bold tracking-tight">Welcome back</h1><p className="mt-2 text-sm opacity-55">Sign in to your private InRange space.</p></div><form onSubmit={submit} className="space-y-3"><label className="block text-xs font-semibold">Email<input type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} className="mt-1.5 w-full rounded-xl border border-black/10 px-3 py-3 text-sm outline-none focus:border-[#638b78]"/></label><label className="block text-xs font-semibold">Password<input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-1.5 w-full rounded-xl border border-black/10 px-3 py-3 text-sm outline-none focus:border-[#638b78]"/></label>{error&&<div role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</div>}<button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1f382e] py-3 text-sm font-bold text-white disabled:opacity-50"><LockKeyhole size={15}/>{busy?'Signing in…':'Sign in'}</button></form><p className="mt-5 text-[11px] leading-5 opacity-45">This is a private health journal. Only the account owner can sign in.</p></div></main>;
}
