import type { Role } from '@restaurant-reviews/common';
import type { Express } from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { buildContainer, type AdapterOverrides, type Container } from '../../src/container';
import { createApp } from '../../src/infrastructure/adapters/inbound/http/createApp';
import { loadEnv, type Env } from '../../src/infrastructure/config/env';
import { RecordingEmailSender } from './fakes';
import { InMemoryFileStorage } from './InMemoryFileStorage';

/** A separate database so tests never touch development data. */
const TEST_MONGODB_URI =
  process.env.MONGODB_URI_TEST ?? 'mongodb://127.0.0.1:27017/restaurant_reviews_test';

/** The environment for tests: the test database and a fast password hash. */
export function testEnv(): Env {
  return loadEnv({ NODE_ENV: 'test', MONGODB_URI: TEST_MONGODB_URI, BCRYPT_ROUNDS: '4' });
}

/** A test app and the fakes it was built with, for tests to inspect. */
export interface TestApp {
  app: Express;
  container: Container;
  emails: RecordingEmailSender;
  storage: InMemoryFileStorage;
}

/**
 * The real application wiring: real use cases, real repositories. Only the two services outside
 * our control are faked: email delivery and file storage. A test may pass further overrides.
 */
export function createTestApp(
  overrides: AdapterOverrides = {},
  options: { rateLimiting?: boolean } = {},
): TestApp {
  const emails = new RecordingEmailSender();
  const storage = new InMemoryFileStorage();
  const container = buildContainer(testEnv(), {
    emailSender: emails,
    fileStorage: storage,
    ...overrides,
  });
  const app = createApp({
    ...container.http,
    config: { ...container.http.config, rateLimiting: options.rateLimiting ?? false },
  });
  return { app, container, emails, storage };
}

/** Empties every collection in the test database. */
export async function clearDatabase(): Promise<void> {
  await Promise.all(Object.values(mongoose.models).map((model) => model.deleteMany({})));
}

/**
 * Registers a new account through the real endpoints and returns an agent that carries its
 * cookies, the way a signed-in browser would.
 */
export async function signUp(t: TestApp, role: Role, email: string) {
  const agent = request.agent(t.app);
  await agent.post('/api/auth/request-otp').send({ email }).expect(204);
  const otp = t.emails.lastCodeFor(email);
  const res = await agent
    .post('/api/auth/register')
    .send({ name: email.split('@')[0], email, password: 'correct-horse-1', role, otp })
    .expect(201);
  return { agent, userId: res.body.user.id as string };
}
