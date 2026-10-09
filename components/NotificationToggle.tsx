'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff } from 'lucide-react';

type PushState = 'loading' | 'unsupported' | 'unconfigured' | 'denied' | 'off' | 'on';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export default function NotificationToggle() {
  const [state, setState] = useState<PushState>('loading');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function init() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        setState('unsupported');
        return;
      }
      try {
        const res = await fetch('/api/push');
        if (!res.ok) {
          setState('unconfigured');
          return;
        }
        const reg = await navigator.serviceWorker.register('/sw.js');
        const sub = await reg.pushManager.getSubscription();
        if (Notification.permission === 'denied' && !sub) {
          setState('denied');
        } else {
          setState(sub ? 'on' : 'off');
        }
      } catch {
        setState('unsupported');
      }
    }
    init();
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      const keyRes = await fetch('/api/push');
      if (!keyRes.ok) throw new Error('Push not configured');
      const { publicKey } = await keyRes.json();

      const reg = await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState('denied');
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!res.ok) throw new Error('Subscribe failed');
      setState('on');
    } catch (e) {
      console.error('Enable push failed:', e);
      alert('Could not enable notifications. Try again, or check browser settings.');
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState('off');
    } catch (e) {
      console.error('Disable push failed:', e);
    } finally {
      setBusy(false);
    }
  };

  if (state === 'loading' || state === 'unsupported' || state === 'unconfigured') {
    return null;
  }

  if (state === 'denied') {
    return (
      <div className="text-sm text-gray-400">
        Notifications are blocked in your browser settings.
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={state === 'on' ? disable : enable}
      disabled={busy}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
        state === 'on'
          ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
          : 'bg-green-600 hover:bg-green-500 text-white'
      }`}
    >
      {state === 'on' ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
      {busy ? 'Working…' : state === 'on' ? 'Notifications On' : 'Enable Notifications'}
    </button>
  );
}
