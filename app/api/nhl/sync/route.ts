import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { syncGameFromNhl } from '@/lib/nhl';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'You must be logged in' }, { status: 401 });
    }

    const { game_id } = await request.json();
    if (!game_id) {
      return NextResponse.json({ error: 'game_id required' }, { status: 400 });
    }

    const result = await syncGameFromNhl(Number(game_id));
    return NextResponse.json(result);
  } catch (error) {
    console.error('NHL sync error:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
