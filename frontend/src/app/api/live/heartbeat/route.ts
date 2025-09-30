import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!URL || !ANON) {
      return NextResponse.json(
        { ok: false, step: 'env', haveUrl: !!URL, haveAnon: !!ANON },
        { status: 500 }
      );
    }

    const auth = req.headers.get('authorization') ?? '';
    const client = createClient(URL, ANON, { global: { headers: { Authorization: auth } } });

    const { data: { user } } = await client.auth.getUser();
    if (!user) return NextResponse.json({ ok:false, error:'no_user' }, { status:401 });

    const { room_id } = await req.json().catch(() => ({}));
    if (!room_id) return NextResponse.json({ ok:false, error:'no_room_id' }, { status:400 });

    const { error } = await client
      .from('live_sessions')
      .upsert({ room_id, user_id: user.id, last_seen_at: new Date().toISOString() });

    if (error) return NextResponse.json({ ok:false, error: error.message }, { status:500 });
    return NextResponse.json({ ok:true });
  } catch (e: any) {
    return NextResponse.json({ ok:false, error: e?.message || 'unknown' }, { status:500 });
  }
}
