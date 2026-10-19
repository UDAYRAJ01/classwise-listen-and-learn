// Helpers for the NDJSON streaming protocol used by generation routes.

export function jsonError(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

export function ndjsonStream(run: (send: (event: unknown) => void) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          closed = true;
        }
      };
      try {
        await run(send);
      } catch (error) {
        console.error("stream failed", error);
        send({ type: "error", status: 500, message: "Kuch gadbad ho gayi. Dobara try karein." });
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed by client
        }
      }
    },
  });
  return new Response(body, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

/** Calls fn at most once per interval, always flushing the latest value. */
export function throttle<T>(fn: (v: T) => void, ms: number) {
  let last = 0;
  let pending: T | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    timer = undefined;
    if (pending !== undefined) {
      last = Date.now();
      const v = pending;
      pending = undefined;
      fn(v);
    }
  };
  return {
    push(v: T) {
      pending = v;
      const wait = ms - (Date.now() - last);
      if (wait <= 0) flush();
      else if (!timer) timer = setTimeout(flush, wait);
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = undefined;
      pending = undefined;
    },
  };
}
