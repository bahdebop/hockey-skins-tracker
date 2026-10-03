import { NextRequest, NextResponse } from 'next/server';
import { populateRosterForGame } from '@/lib/nhl';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { game_id } = body;

    if (!game_id) {
      return NextResponse.json({ error: 'game_id required' }, { status: 400 });
    }

    const added = await populateRosterForGame(Number(game_id));
    return NextResponse.json({ added });
  } catch (error) {
    console.error('Error populating roster:', error);
    return NextResponse.json({ error: 'Failed to fetch NHL roster' }, { status: 500 });
  }
}
