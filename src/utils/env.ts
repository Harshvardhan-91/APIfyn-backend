// Environment variables configuration for production deployment

// This file helps ensure the DATABASE_URL has the correct SSL settings for Render PostgreSQL

export function getDatabaseUrl(): string {
  const dbUrl = process.env.DATABASE_URL;
  
  if (!dbUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // Check if URL already has SSL settings
  if (dbUrl.includes('sslmode=require') || dbUrl.includes('ssl=true')) {
    return dbUrl;
  }

  // Add SSL settings for Render PostgreSQL
  const separator = dbUrl.includes('?') ? '&' : '?';
  return `${dbUrl}${separator}sslmode=require&ssl=true`;
}

export function getEnvironmentConfig() {
  return {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: process.env.PORT || 5000,
    DATABASE_URL: getDatabaseUrl(),
    // Add other environment variables as needed
  };
}
