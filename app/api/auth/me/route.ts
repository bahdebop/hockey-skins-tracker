import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import db from '@/lib/db';

export async function GET() {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const player = db.prepare('SELECT * FROM players WHERE id = ?').get(user.userId);

    if (!player) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: (player as any).id,
      name: (player as any).name,
      email: (player as any).email,
      phone: (player as any).phone,
      venmo_username: (player as any).venmo_username,
      paypal_email: (player as any).paypal_email,
    });
  } catch (error) {
    console.error('Error getting current user:', error);
    return NextResponse.json({ error: 'Failed to get user' }, { status: 500 });
  }
}
