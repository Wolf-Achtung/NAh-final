// server/routes/chat-sse.ts
//
// Simple SSE (Server Sent Events) endpoint to stream chat messages. This
// demonstrates how to send incremental updates using EventSource. The
// endpoint writes tokens on a timer and then sends a '[DONE]' sentinel.
// In a real implementation you would forward tokens from an LLM or
// chat backend. Note: The route uses GET to comply with SSE.

import { Router } from 'express';

const router = Router();

router.get('/chat-sse', async (req, res) => {
  // Set required SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  // flush headers for Node.js < 12 support
  (res as any).flushHeaders?.();

  // Keep the connection alive with periodic comments
  const keepAlive = setInterval(() => {
    res.write(`:keepalive\n\n`);
  }, 15000);

  const send = (data: string) => {
    res.write(`data: ${data}\n\n`);
  };

  try {
    // Simulate streaming tokens asynchronously. Replace this with your
    // own logic, e.g. using OpenAI's streaming API.
    const demoTokens = ['Hallo ', '– ', 'Sofort ', '112 ', 'wählen.'];
    for (const token of demoTokens) {
      await new Promise<void>((resolve) => setTimeout(resolve, 150));
      send(token);
    }
    send('[DONE]');
  } catch (err) {
    // If an error occurs, emit [DONE] to close the stream gracefully
    send('[DONE]');
  } finally {
    clearInterval(keepAlive);
    res.end();
  }
});

export default router;