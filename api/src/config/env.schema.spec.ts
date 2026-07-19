import * as Joi from 'joi';
import { envSchema } from './env.schema';

function validate(env: Record<string, string | undefined>) {
  const { error, value } = envSchema.validate(env, {
    abortEarly: false,
    stripUnknown: true,
  });
  return { error, value };
}

describe('envSchema', () => {
  const BASE = {
    NODE_ENV: 'production',
    DB_HOST: 'db',
    DB_USER: 'rag',
    DB_PASSWORD: 'secret',
    DB_NAME: 'rag',
    REDIS_HOST: 'redis',
    OLLAMA_BASE_URL: 'http://ollama:11434',
    ADMIN_EMAIL: 'admin@local',
    ADMIN_PASSWORD: 'adminpass1234',
    JWT_SECRET: 'a-very-long-production-secret-key',
  };

  it('accepts a complete production config', () => {
    const { error, value } = validate(BASE);
    expect(error).toBeUndefined();
    expect(value.EMBEDDING_DIM).toBe(1024);
  });

  it('requires JWT_SECRET in production', () => {
    const { error } = validate({ ...BASE, JWT_SECRET: undefined });
    expect(error).toBeDefined();
    expect(error!.message).toContain('JWT_SECRET');
  });

  it('requires JWT_SECRET to be at least 16 chars in production', () => {
    const { error } = validate({ ...BASE, JWT_SECRET: 'short' });
    expect(error).toBeDefined();
    expect(error!.message).toContain('JWT_SECRET');
  });

  it('does not require JWT_SECRET outside production', () => {
    const { error, value } = validate({ ...BASE, NODE_ENV: 'development', JWT_SECRET: undefined });
    expect(error).toBeUndefined();
    expect(value.JWT_SECRET).toBe('dev-secret');
  });

  it('requires DB_* and REDIS_HOST and OLLAMA_BASE_URL and ADMIN_*', () => {
    const { error } = validate({ ...BASE, DB_PASSWORD: undefined });
    expect(error).toBeDefined();
    expect(error!.message).toContain('DB_PASSWORD');
  });

  it('rejects non-positive EMBEDDING_DIM', () => {
    const { error } = validate({ ...BASE, EMBEDDING_DIM: '0' });
    expect(error).toBeDefined();
    expect(error!.message).toContain('EMBEDDING_DIM');
  });

  it('coerces EMBEDDING_DIM to a number', () => {
    const { value } = validate({ ...BASE, EMBEDDING_DIM: '768' });
    expect(value.EMBEDDING_DIM).toBe(768);
  });
});