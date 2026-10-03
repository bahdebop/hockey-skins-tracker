import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { verifyPassword, setAuthCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, password } = body;

    if (!name || !password) {
      return NextResponse.json({ error: 'Name and password required' }, { status: 400 });
    }

    const player = db.prepare('SELECT * FROM players WHERE name = ?').get(name);

    if (!player) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (!player.password_hash) {
      return NextResponse.json({ error: 'Account has no password set. Please contact admin.' }, { status: 401 });
    }

    const isValid = await verifyPassword(password, player.password_hash);

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    await setAuthCookie({
      userId: player.id,
      name: player.name,
    });

    return NextResponse.json({
      id: player.id,
      name: player.name,
      email: player.email,
      phone: player.phone,
      venmo_username: player.venmo_username,
      paypal_email: player.paypal_email,
      is_admin: !!player.is_admin,
    });
  } catch (error) {
    console.error('Error logging in:', error);
    return NextResponse.json({ error: 'Failed to login' }, { status: 500 });
  }
}
