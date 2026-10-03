import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { hashPassword, setAuthCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, password, email, phone } = body;

    if (!name || !password) {
      return NextResponse.json({ error: 'Name and password required' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const existingPlayer = db.prepare('SELECT * FROM players WHERE name = ?').get(name);
    if (existingPlayer) {
      return NextResponse.json({ error: 'Player name already exists' }, { status: 400 });
    }

    if (email) {
      const existingEmail = db.prepare('SELECT * FROM players WHERE email = ?').get(email);
      if (existingEmail) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
      }
    }

    const passwordHash = await hashPassword(password);

    const result = db.prepare(`
      INSERT INTO players (name, password_hash, email, phone)
      VALUES (?, ?, ?, ?)
    `).run(name, passwordHash, email || null, phone || null);

    const player = db.prepare('SELECT * FROM players WHERE id = ?').get(result.lastInsertRowid);

    await setAuthCookie({
      userId: (player as any).id,
      name: (player as any).name,
    });

    return NextResponse.json({
      id: (player as any).id,
      name: (player as any).name,
      email: (player as any).email,
      phone: (player as any).phone,
      is_admin: !!(player as any).is_admin,
    });
  } catch (error) {
    console.error('Error registering:', error);
    return NextResponse.json({ error: 'Failed to register' }, { status: 500 });
  }
}
