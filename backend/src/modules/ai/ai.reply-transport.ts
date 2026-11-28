import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../middleware/error-handler';
import { logger } from '../../utils/logger';

const REPLY_STREAM_TYPE = 'application/x-ndjson';

/** Keep the JSON envelope for clients that do not request reply events. */
export async function respondWithAiReply<Preview = string>(
  request: Request,
  response: Response,
  next: NextFunction,
  status: number,
  failureEvent: string,
  run: (signal: AbortSignal, onPreview?: (preview: Preview) => void) => Promise<unknown>,
  toEvent: (preview: Preview) => object = (text) => ({ type: 'draft', text }),
): Promise<void> {
  const connection = new AbortController();
  const onClose = () => connection.abort();
  response.once('close', onClose);
  response.vary('Accept');
  const streaming = request.get('Accept')?.split(',').some((media) => media.trim() === REPLY_STREAM_TYPE);

  function write(event: object) {
    if (response.destroyed) return;
    if (!response.headersSent) response.status(status).set({
      'Content-Type': `${REPLY_STREAM_TYPE}; charset=utf-8`,
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    });
    response.write(`${JSON.stringify(event)}\n`);
  }

  try {
    const data = await run(connection.signal, streaming ? (preview) => write(toEvent(preview)) : undefined);
    if (connection.signal.aborted) return;
    if (streaming) {
      write({ type: 'answer', data });
      response.end();
    } else {
      response.status(status).json({ success: true, data });
    }
  } catch (error) {
    if (connection.signal.aborted) return;
    if (!response.headersSent) {
      next(error);
      return;
    }
    logger.error(failureEvent, {
      request_id: request.requestId,
      status: error instanceof HttpError ? error.statusCode : 500,
    });
    write({ type: 'error' });
    response.end();
  } finally {
    response.off('close', onClose);
  }
}
