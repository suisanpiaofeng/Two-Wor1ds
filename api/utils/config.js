const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('Missing required environment variable: DATABASE_URL');
}

export default DATABASE_URL;
