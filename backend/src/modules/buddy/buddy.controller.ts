import { requireUserId } from '../../middleware/authenticate';
import type { RequestHandler } from 'express';
import { env } from '../../config/env';
import { HttpError } from '../../middleware/error-handler';
import { respondWithAiReply } from '../ai/ai.reply-transport';
import * as aiService from '../ai/ai.service';
import { parseAskInput } from '../ai/ai.validation';
import * as service from './buddy.service';
import { parseSuggestionInput } from './buddy.validation';

export const getNudges: RequestHandler = async (request, response, next) => {
  try {
    const feed = await service.getNudges(requireUserId(request));
    response.json({ success: true, data: feed });
  } catch (error) {
    next(error);
  }
};

export const ask: RequestHandler = (request, response, next) =>
  respondWithAiReply(request, response, next, 200, 'buddy_stream_failed', (signal, onDraft) => {
    const userId = requireUserId(request);
    const input = parseAskInput(request.body);
    return aiService.askBuddy(userId, input.message, input.intent, input.context, signal, onDraft);
  });

export const startVoiceSession: RequestHandler = async (_request, response, next) => {
  try {
    response.setHeader('Cache-Control', 'no-store');
    if (!env.buddyStreamingStt || !env.assemblyAiApiKey) {
      response.json({ success: true, data: { token: null } });
      return;
    }

    const provider = await fetch(
      'https://streaming.assemblyai.com/v3/token?expires_in_seconds=120&max_session_duration_seconds=60',
      { headers: { Authorization: env.assemblyAiApiKey }, signal: AbortSignal.timeout(4_000) },
    ).catch(() => null);
    if (!provider?.ok) throw new HttpError(503, 'Không mở được phiên nhận diện trực tiếp.');
    const body = await provider.json().catch(() => null) as { token?: unknown } | null;
    if (typeof body?.token !== 'string' || !body.token) {
      throw new HttpError(503, 'Không mở được phiên nhận diện trực tiếp.');
    }
    response.json({ success: true, data: { token: body.token } });
  } catch (error) {
    next(error);
  }
};

export const acceptSuggestion: RequestHandler = async (request, response, next) => {
  try {
    const userId = requireUserId(request);
    const input = parseSuggestionInput(request.body);
    const reminder = await service.createFromSuggestion(userId, input);
    response.status(201).json({ success: true, data: { reminder } });
  } catch (error) {
    next(error);
  }
};
