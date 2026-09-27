import dotenv from 'dotenv';

dotenv.config();

function getPort(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : fallback;
}

export const env = {
  port: getPort(process.env.PORT, 3000),
  dbHost: process.env.DB_HOST || 'localhost',
  dbPort: getPort(process.env.DB_PORT, 3306),
  dbUser: process.env.DB_USER || '',
  dbPassword: process.env.DB_PASSWORD || '',
  dbName: process.env.DB_NAME || 'english_learning',
};