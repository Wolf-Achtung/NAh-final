// src/lib/chatStream.ts
//
// Provides a unified interface to stream tokens from a backend chat
// endpoint. The endpoint may send data via Server Sent Events (SSE),
// streaming fetch (text lines separated by newlines) or a WebSocket.
// The client will automatically attempt SSE first, then fetch, then
// fallback to WebSocket. Each token is delivered to the caller as
// plain text. When the stream is finished, a '[DONE]' sentinel is
// expected to indicate completion.

export interface ChatStreamOptions {
  /** URL of the chat endpoint. Should support SSE (GET) or POST */
  url: string;
  /** Optional JSON serializable body to send with the request */
  body?: any;
  /** Called with each token/string chunk as it arrives */
  onToken: (token: string) => void;
  /** Called when the stream completes (optional) */
  onDone?: () => void;
  /** Called on error */
  onError?: (error: Error) => void;
}

/**
 * Initiate a chat stream to the given URL. Returns a function that can
 * be called to stop the stream prematurely. If all transport methods
 * fail, onError will be invoked.
 */
export async function chatStream(opts: ChatStreamOptions): Promise<() => void | undefined> {
  const { url, body, onToken, onDone, onError } = opts;
  // Attempt SSE first. SSE requires the endpoint to support EventSource.
  try {
    const qs = new URLSearchParams();
    if (body) qs.set('q', JSON.stringify(body));
    const esUrl = body ? `${url}?${qs}` : url;
    const es = new EventSource(esUrl);
    const stop = () => es.close();
    es.onmessage = (ev) => {
      const data = ev.data;
      if (data === '[DONE]') {
        es.close();
        onDone?.();
        return;
      }
      onToken(data);
    };
    es.onerror = (e) => {
      es.close();
      throw new Error('sse-failed');
    };
    return stop;
  } catch (e) {
    // ignore and fall through
  }
  // Fallback: fetch with streaming response. The server should send
  // newline‑delimited tokens. The body is POSTed as JSON.
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    if (!response.body) throw new Error('fetch-stream no body');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const readLoop = async () => {
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx;
          while ((idx = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, idx).trim();
            buffer = buffer.slice(idx + 1);
            if (!line) continue;
            if (line === '[DONE]') {
              onDone?.();
              return;
            }
            onToken(line);
          }
        }
        onDone?.();
      } catch (e: any) {
        onError?.(e);
      }
    };
    readLoop();
    return () => reader.cancel();
  } catch (e) {
    // ignore and fall through
  }
  // Fallback: WebSocket. Expect server to echo tokens and send '[DONE]' sentinel.
  try {
    const wsUrl = url.replace(/^http/, 'ws');
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (ev) => {
      const data = ev.data;
      if (data === '[DONE]') {
        ws.close();
        onDone?.();
      } else {
        onToken(data);
      }
    };
    ws.onerror = (ev) => {
      onError?.(new Error('ws-failed'));
    };
    return () => ws.close();
  } catch (e: any) {
    onError?.(e);
  }
  // All transports failed
  return () => undefined;
}