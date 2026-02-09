import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth/api-auth';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { eventBus, type AppEvent } from '@/lib/events/event-bus';

/**
 * GET /api/events?owner=acme&repo=docs — SSE endpoint for real-time events.
 *
 * Streams server-sent events for the specified owner/repo channel.
 * Supported event types:
 *   file:changed, branch:switched, pr:detected, comment:added, sync:status
 *
 * Auth: Bearer token (Firebase) or X-API-Key header.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Rate limit: 15 burst connections, refill 1 every 4s (prevent connection spam)
  const rateLimited = checkRateLimit(auth.userId, { maxTokens: 15, refillRate: 15 / 60 });
  if (rateLimited) return rateLimited;

  const { searchParams } = new URL(request.url);
  const owner = searchParams.get('owner');
  const repo = searchParams.get('repo');

  if (!owner || !repo) {
    return new Response(
      JSON.stringify({ error: 'Missing query params: owner, repo' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const channel = `${owner}/${repo}`;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send an initial comment to confirm connection
      controller.enqueue(encoder.encode(': connected\n\n'));

      // Send a keepalive comment every 30s to prevent proxies from closing
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keepalive ${new Date().toISOString()}\n\n`));
        } catch {
          clearInterval(keepalive);
        }
      }, 30_000);

      const handler = (event: AppEvent) => {
        try {
          const payload = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Client disconnected — will be cleaned up below
        }
      };

      const unsubscribe = eventBus.subscribe(channel, handler);

      // Handle client disconnection — { once: true } prevents duplicate listeners
      // and isCleanedUp guards against double cleanup from race conditions
      let isCleanedUp = false;
      request.signal.addEventListener('abort', () => {
        if (isCleanedUp) return;
        isCleanedUp = true;
        clearInterval(keepalive);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      }, { once: true });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
