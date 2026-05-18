import { NextRequest, NextResponse } from 'next/server';
import { listReservedCosts } from '@/lib/awsreservedcosts';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const rows = await listReservedCosts({
      project: searchParams.get('project') ?? undefined,
      dataset: searchParams.get('dataset') ?? undefined,
      location: searchParams.get('location') ?? undefined,
      service: searchParams.get('service') ?? undefined,
      locationName: searchParams.get('location_name') ?? undefined,
      instanceType: searchParams.get('instance_type') ?? undefined,
      operatingSystem: searchParams.get('operating_system') ?? undefined,
      tenancy: searchParams.get('tenancy') ?? undefined,
      deploymentOption: searchParams.get('deployment_option') ?? undefined,
      usageType: searchParams.get('usage_type') ?? undefined,
      operation: searchParams.get('operation') ?? undefined,
    });

    return NextResponse.json(rows);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.startsWith('unsupported service') || message.startsWith('invalid ') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
