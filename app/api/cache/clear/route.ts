import { NextResponse } from 'next/server';
import { clearPricingCache } from '@/lib/awsreservedcosts-endpoint-client';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const { riCount, spCount } = clearPricingCache();
    return NextResponse.json({
      ok: true,
      message: `キャッシュをクリアしました (RI: ${riCount}件, SP: ${spCount}件)`,
      cleared: { riCount, spCount },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
