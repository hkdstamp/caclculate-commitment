import { NextRequest, NextResponse } from 'next/server';
import { aggregateResults } from '@/lib/calculator';
import { AWSCostData, CalculationParams } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { costData, params } = body as {
      costData: AWSCostData[];
      params: CalculationParams;
    };

    // バリデーション
    if (!Array.isArray(costData) || costData.length === 0) {
      return NextResponse.json(
        { error: 'Invalid cost data' },
        { status: 400 }
      );
    }

    if (!params || typeof params.ri_applied_rate !== 'number' || typeof params.sp_applied_rate !== 'number') {
      return NextResponse.json(
        { error: 'Invalid calculation parameters' },
        { status: 400 }
      );
    }

    // サーバーサイドで計算実行
    const results = await aggregateResults(costData, params);

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error in calculate API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
