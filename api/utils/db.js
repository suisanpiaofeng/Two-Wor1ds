import pg from 'pg';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('Missing required environment variable: DATABASE_URL');
}

function getSslConfig() {
  if (process.env.DATABASE_SSL === 'false') {
    return false;
  }

  return {
    rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true'
  };
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: getSslConfig(),
  max: 5,
  idleTimeoutMillis: 20000,
  connectionTimeoutMillis: 5000
});

let schemaReady = false;
let schemaPromise = null;

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text: text.substring(0, 50), duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Query error:', error);
    throw error;
  }
}

export async function getClient() {
  const client = await pool.connect();
  return client;
}

export async function ensureSchema() {
  if (schemaReady) {
    return;
  }

  if (!schemaPromise) {
    schemaPromise = (async () => {
      await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

      await pool.query(`
        CREATE TABLE IF NOT EXISTS collections (
          id SERIAL PRIMARY KEY,
          post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(post_id, user_id)
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id UUID PRIMARY KEY,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
          type VARCHAR(20) NOT NULL,
          actor_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
          comment_content TEXT,
          target_comment_content TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          read BOOLEAN DEFAULT FALSE
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS conversations (
          id UUID PRIMARY KEY,
          user_one_id UUID REFERENCES users(id) ON DELETE CASCADE,
          user_two_id UUID REFERENCES users(id) ON DELETE CASCADE,
          user_one_last_read_at TIMESTAMP,
          user_two_last_read_at TIMESTAMP,
          last_message_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(user_one_id, user_two_id)
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS conversation_messages (
          id UUID PRIMARY KEY,
          conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
          sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS email_verification_codes (
          email VARCHAR(255) PRIMARY KEY,
          code_hash VARCHAR(64) NOT NULL,
          attempts INTEGER DEFAULT 0,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS comment_likes (
          id SERIAL PRIMARY KEY,
          comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(comment_id, user_id)
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS comment_collections (
          id SERIAL PRIMARY KEY,
          comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(comment_id, user_id)
        )
      `);

      await pool.query(`
        ALTER TABLE notifications
        ADD COLUMN IF NOT EXISTS actor_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS comment_content TEXT,
        ADD COLUMN IF NOT EXISTS target_comment_content TEXT,
        ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT FALSE
      `);

      await pool.query(`
        ALTER TABLE posts
        ADD COLUMN IF NOT EXISTS collections_count INTEGER DEFAULT 0
      `);

      await pool.query(`
        ALTER TABLE comments
        ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS collections_count INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS root_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS reply_to_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE
      `);

      await pool.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'users'
              AND column_name = 'avatar_seed'
          ) THEN
            ALTER TABLE users ALTER COLUMN avatar_seed TYPE TEXT;
          END IF;
        END $$;
      `);

      await pool.query('CREATE INDEX IF NOT EXISTS idx_collections_user_id ON collections(user_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_collections_post_id ON collections(post_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_comments_root_comment_id ON comments(root_comment_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_comments_reply_to_comment_id ON comments(reply_to_comment_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id ON comment_likes(comment_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_comment_likes_user_id ON comment_likes(user_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_comment_collections_comment_id ON comment_collections(comment_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_comment_collections_user_id ON comment_collections(user_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_notifications_actor_user_id ON notifications(actor_user_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_notifications_comment_id ON notifications(comment_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_conversations_user_one_id ON conversations(user_one_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_conversations_user_two_id ON conversations(user_two_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON conversations(last_message_at DESC)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_id ON conversation_messages(conversation_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_conversation_messages_created_at ON conversation_messages(created_at DESC)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_email_verification_codes_expires_at ON email_verification_codes(expires_at)');

      schemaReady = true;
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }

  return schemaPromise;
}

export default pool;
