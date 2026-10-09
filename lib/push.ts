import webpush from 'web-push';
import db from '@/lib/db';

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

let vapidConfigured = false;

function configureVapid(): boolean {
  if (vapidConfigured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    publicKey,
    privateKey
  );
  vapidConfigured = true;
  return true;
}

export function pushEnabled(): boolean {
  return configureVapid();
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

// Sends a push to every device registered to the given players.
// Never throws — a notification failure must not break the request it came from.
export async function sendPushToPlayers(playerIds: number[], payload: PushPayload): Promise<void> {
  if (!configureVapid() || playerIds.length === 0) return;

  const subs = db.prepare(
    `SELECT id, endpoint, p256dh, auth FROM push_subscriptions
     WHERE player_id IN (${playerIds.map(() => '?').join(',')})`
  ).all(...playerIds) as { id: number; endpoint: string; p256dh: string; auth: string }[];

  const results = await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      ).catch(err => { throw { subId: sub.id, statusCode: err?.statusCode, err }; })
    )
  );

  for (const result of results) {
    if (result.status === 'rejected') {
      const { subId, statusCode, err } = result.reason as any;
      if (statusCode === 404 || statusCode === 410) {
        db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(subId);
      } else {
        console.error('Push send failed:', statusCode, err?.message || err);
      }
    }
  }
}
