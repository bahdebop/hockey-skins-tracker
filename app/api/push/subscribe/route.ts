import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { pushEnabled } from '@/lib/push';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'You must be logged in' }, { status: 401 });
  }
  if (!pushEnabled()) {
    return NextResponse.json({ error: 'Push notifications are not configured' }, { status: 503 });
  }

  const { subscription } = await request.json();
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  }

  db.prepare(`
    INSERT INTO push_subscriptions (player_id, endpoint, p256dh, auth, user_agent)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET
      player_id = excluded.player_id,
      p256dh = excluded.p256dh,
      auth = excluded.auth
  `).run(user.userId, endpoint, p256dh, auth, request.headers.get('user-agent') || null);

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'You must be logged in' }, { status: 401 });
  }

  const { endpoint } = await request.json();
  if (!endpoint) {
    return NextResponse.json({ error: 'Endpoint required' }, { status: 400 });
  }

  db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND player_id = ?')
    .run(endpoint, user.userId);

  return NextResponse.json({ success: true });
}
