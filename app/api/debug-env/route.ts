import { NextResponse } from 'next/server';

export async function GET() {
  const envCheck = {
    AWS_REGION: !!process.env.AWS_REGION,
    AWS_ACCESS_KEY_ID: !!process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: !!process.env.AWS_SECRET_ACCESS_KEY,
    S3_BUCKET_NAME: !!process.env.S3_BUCKET_NAME,
    NODE_ENV: process.env.NODE_ENV,
  };

  return NextResponse.json({
    message: 'Environment check',
    envCheck,
    hasAllAWS: envCheck.AWS_REGION && envCheck.AWS_ACCESS_KEY_ID && envCheck.AWS_SECRET_ACCESS_KEY && envCheck.S3_BUCKET_NAME,
  });
} 