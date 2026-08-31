import { NextRequest } from 'next/server';
import { eventManager } from '@/lib/eventManager';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = (data: any) => {
        const message = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      // Send initial connection message
      sendEvent({ event: 'connected', data: { gameId } });

      // Subscribe to game events
      eventManager.subscribe(gameId, sendEvent);

      // Keep-alive ping every 30 seconds
      const keepAlive = setInterval(() => {
        sendEvent({ event: 'ping', data: { timestamp: Date.now() } });
      }, 30000);

      // Cleanup on connection close
      request.signal.addEventListener('abort', () => {
        clearInterval(keepAlive);
        eventManager.unsubscribe(gameId, sendEvent);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
