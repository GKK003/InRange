import { NextRequest, NextResponse } from 'next/server';
import { authorizeAppRequest, isAuthError } from '@/lib/api-auth';
import { adminDb } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const auth = await authorizeAppRequest(req);
  if (isAuthError(auth)) return auth;
  const body = await req.json();
  const db = adminDb();
  const now = new Date().toISOString();
  if (!db) return NextResponse.json({ ok: true, demo: true, row: body });
  const { data: current, error: readError } = await db.from('supplies_and_sensor').select('*').order('sensor_started_at', { ascending: false }).limit(1).maybeSingle();
  if (readError) return NextResponse.json({ error: 'Could not load supplies' }, { status: 500 });
  const row = {
    sensor_started_at: body.sensor_started_at ?? current?.sensor_started_at ?? null,
    sensor_duration_days: Math.min(30, Math.max(1, Number(body.sensor_duration_days ?? current?.sensor_duration_days ?? 10))),
    last_site_location: typeof body.last_site_location === 'string' ? body.last_site_location.slice(0, 80) : current?.last_site_location ?? null,
    sensors_left: Math.max(0, Number(body.sensors_left ?? current?.sensors_left ?? 0)),
    insulin_pens_left: Math.max(0, Number(body.insulin_pens_left ?? current?.insulin_pens_left ?? 0)),
  };
  const result = current
    ? await db.from('supplies_and_sensor').update(row).eq('id', current.id).select().single()
    : await db.from('supplies_and_sensor').insert(row).select().single();
  if (result.error) return NextResponse.json({ error: 'Could not save supplies' }, { status: 500 });
  return NextResponse.json({ ok: true, row: result.data });
}
