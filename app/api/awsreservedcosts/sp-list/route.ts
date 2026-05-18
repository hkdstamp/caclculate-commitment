import { NextRequest, NextResponse } from 'next/server';
import { listSavingsPlansCosts } from '@/lib/awsreservedcosts';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const rows = await listSavingsPlansCosts({
      project: searchParams.get('project') ?? undefined,
      dataset: searchParams.get('dataset') ?? undefined,
      location: searchParams.get('location') ?? undefined,
      service: searchParams.get('service') ?? undefined,
      locationName: searchParams.get('location_name') ?? undefined,
    });

    return NextResponse.json(rows);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.startsWith('invalid ') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
