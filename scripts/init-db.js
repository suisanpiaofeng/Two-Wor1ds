import path from 'path';
import pg from 'pg';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

async function loadSchema() {
  const schemaPath = path.resolve(__dirname, '../database/schema.sql');
  return readFile(schemaPath, 'utf8');
}

async function initDatabase() {
  console.log('Connecting to database...');

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: getSslConfig()
  });

  try {
    await client.connect();
    console.log('✅ Connected successfully!');

    console.log('Applying schema...');
    const schema = await loadSchema();
    await client.query(schema);

    console.log('');
    console.log('✅ Database initialized successfully!');
    console.log('');
    console.log('Tables created:');
    console.log('  ✓ users');
    console.log('  ✓ auth_tokens');
    console.log('  ✓ email_verification_codes');
    console.log('  ✓ posts');
    console.log('  ✓ comments');
    console.log('  ✓ likes');
    console.log('  ✓ collections');
    console.log('  ✓ notifications');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

initDatabase();
