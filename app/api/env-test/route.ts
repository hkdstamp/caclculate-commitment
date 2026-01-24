import { NextResponse } from 'next/server';

export async function GET() {
  const envVars = {
    ENABLE_AWS_PRICE_API: process.env.ENABLE_AWS_PRICE_API,
    AWS_REGION: process.env.AWS_REGION,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ? 'SET (hidden)' : 'NOT SET',
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ? 'SET (hidden)' : 'NOT SET',
    PRICE_CACHE_DURATION: process.env.PRICE_CACHE_DURATION,
    NODE_ENV: process.env.NODE_ENV,
  };

  return NextResponse.json({
    message: 'Environment Variables Test',
    env: envVars,
  });
}
