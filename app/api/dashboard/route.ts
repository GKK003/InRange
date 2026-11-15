import { NextRequest, NextResponse } from 'next/server';
import { authorizeAppRequest, isAuthError } from '@/lib/api-auth';
import { adminDb } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const auth = await authorizeAppRequest(req);
  if (isAuthError(auth)) return auth;
  const db = adminDb();
  if (!db) return NextResponse.json({ demo: true, readings: [], logs: [], supplies: null });
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [readings, logs, supplies, meals] = await Promise.all([
    db.from('glucose_readings').select('id,value_mgdl,value_mmol,trend,recorded_at').gte('recorded_at', since).order('recorded_at', { ascending: true }),
    db.from('daily_logs').select('id,type,title,carbs_grams,fiber_grams,glycemic_note,logged_at').gte('logged_at', new Date(Date.now() - 86400000).toISOString()).order('logged_at', { ascending: false }).limit(50),
    db.from('supplies_and_sensor').select('id,sensor_started_at,sensor_duration_days,last_site_location,sensors_left,insulin_pens_left').order('sensor_started_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('saved_meals').select('id,name,brand,barcode,serving_size,carbs_grams,fiber_grams,category,notes').order('name'),
  ]);
  if (readings.error || logs.error || supplies.error || meals.error) return NextResponse.json({ error: 'Could not load dashboard data' }, { status: 500 });
  return NextResponse.json({ demo: false, readings: readings.data || [], logs: logs.data || [], supplies: supplies.data || null, meals: meals.data || [] });
}
