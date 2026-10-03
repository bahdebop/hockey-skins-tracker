import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import db from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      return NextResponse.json({ error: 'Admin access is not configured' }, { status: 403 });
    }

    const body = await request.json();
    if (body.password !== adminPassword) {
      return NextResponse.json({ error: 'Invalid admin password' }, { status: 403 });
    }

    db.prepare('UPDATE players SET is_admin = 1 WHERE id = ?').run(user.userId);
    return NextResponse.json({ success: true, is_admin: true });
  } catch (error) {
    console.error('Error claiming admin:', error);
    return NextResponse.json({ error: 'Failed to enable admin' }, { status: 500 });
  }
}
