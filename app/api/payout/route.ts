import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { getOpenBatch, getBatchTransfers, calculatePayout, countUnsettledFinalGames } from '@/lib/payout';

// Returns the open batch (if any), its transfers, and how many final
// games are accruing toward the next payout.
export async function GET() {
  try {
    const batch = getOpenBatch();
    const recentBatches = db.prepare(`
      SELECT b.*, p.name as created_by_name FROM payout_batches b
      JOIN players p ON b.created_by = p.id
      ORDER BY b.id DESC LIMIT 10
    `).all();

    return NextResponse.json({
      openBatch: batch ? { ...batch, transfers: getBatchTransfers(batch.id) } : null,
      batches: (recentBatches as any[]).map(b => ({ ...b, transfers: getBatchTransfers(b.id) })),
      accruingGames: countUnsettledFinalGames(),
    });
  } catch (error) {
    console.error('Error fetching payout:', error);
    return NextResponse.json({ error: 'Failed to fetch payout' }, { status: 500 });
  }
}

// Admin-only: compute the minimal transfer list across every unsettled
// final game and open a new payout batch.
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'You must be logged in' }, { status: 401 });
    }
    if (!isAdmin(user.userId)) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const result = calculatePayout(user.userId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    return NextResponse.json({
      batch: getOpenBatch(),
      transfers: result.transfers,
    });
  } catch (error) {
    console.error('Error calculating payout:', error);
    return NextResponse.json({ error: 'Failed to calculate payout' }, { status: 500 });
  }
}
