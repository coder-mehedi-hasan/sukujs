import { Suku, type SukuApplication } from '@sukujs/core';
import { securityHeaders } from '@sukujs/security';
import { AppFeature } from './app.feature';
import { Env } from './config';

// Bindings arrive with the first request, so the app is created then and kept.
let app: Promise<SukuApplication> | undefined;

const createApp = async (env: Record<string, unknown>) =>
  Suku.create({
    features: [await Env.load({ ...env }), AppFeature],
    middlewares: [securityHeaders()],
  });

export default {
  async fetch(request: Request, env: Record<string, unknown>): Promise<Response> {
    app ??= createApp(env);
    const { handle } = await app;
    const remoteAddress = request.headers.get('cf-connecting-ip') ?? undefined;
    return handle(request, remoteAddress ? { remoteAddress } : undefined);
  },
};
