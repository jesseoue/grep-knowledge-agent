import { pgTable, text, integer, index, uniqueIndex, boolean, timestamp, jsonb, real } from 'drizzle-orm/pg-core'

const timestamps = {
  createdAt: timestamp('created_at').notNull().defaultNow(),
}

export const chats = pgTable('chats', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text('title'),
  userId: text('user_id').notNull(),
  isPublic: boolean('is_public').notNull().default(false),
  shareToken: text('share_token'),
  ...timestamps,
}, table => [
  index('chats_user_id_idx').on(table.userId),
  uniqueIndex('chats_share_token_idx').on(table.shareToken),
])

export const messages = pgTable('messages', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  chatId: text('chat_id').notNull().references(() => chats.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
  parts: jsonb('parts'),
  feedback: text('feedback', { enum: ['positive', 'negative'] }),
  model: text('model'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  durationMs: integer('duration_ms'),
  ...timestamps,
}, table => [index('messages_chat_id_idx').on(table.chatId)])

export const sources = pgTable('sources', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  type: text('type', { enum: ['github', 'youtube', 'file'] }).notNull(),
  label: text('label').notNull(),
  basePath: text('base_path').default('/docs'),
  repo: text('repo'),
  branch: text('branch'),
  contentPath: text('content_path'),
  outputPath: text('output_path'),
  readmeOnly: boolean('readme_only').default(false),
  channelId: text('channel_id'),
  maxVideos: integer('max_videos').default(50),
  ...timestamps,
}, table => [index('sources_type_idx').on(table.type)])

export const agentConfig = pgTable('agent_config', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull().default('default'),
  additionalPrompt: text('additional_prompt'),
  responseStyle: text('response_style', { enum: ['concise', 'detailed', 'technical', 'friendly'] }).default('concise'),
  language: text('language').default('en'),
  defaultModel: text('default_model'),
  maxStepsMultiplier: real('max_steps_multiplier').default(1.0),
  temperature: real('temperature').default(0.7),
  searchInstructions: text('search_instructions'),
  citationFormat: text('citation_format', { enum: ['inline', 'footnote', 'none'] }).default('inline'),
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps,
})

// --- Better Auth tables (self-hosted, managed by better-auth) --------------

export const users = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  role: text('role').notNull().default('user'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const sessions = pgTable('session', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const accounts = pgTable('account', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const verifications = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
