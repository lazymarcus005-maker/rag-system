import * as Joi from 'joi';

export const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  API_PORT: Joi.number().default(3001),

  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),

  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().default(6379),

  OLLAMA_BASE_URL: Joi.string().required(),
  OLLAMA_API_KEY: Joi.string().optional(),
  OLLAMA_CHAT_MODEL: Joi.string().default('llama3.1:8b'),
  OLLAMA_EMBED_MODEL: Joi.string().default('bge-m3'),

  EMBEDDING_DIM: Joi.number().integer().positive().default(1024),

  JWT_SECRET: Joi.alternatives()
    .conditional('NODE_ENV', {
      is: 'production',
      then: Joi.string().min(16).required(),
      otherwise: Joi.string().default('dev-secret'),
    }),

  ADMIN_EMAIL: Joi.string().required(),
  ADMIN_PASSWORD: Joi.string().required(),

  UPLOAD_DIR: Joi.string().default('./uploads'),
  RERANK_ENABLED: Joi.string().valid('true', 'false').default('true'),
  ENABLE_DOCS: Joi.string().valid('true', 'false').optional(),
}).unknown(true);