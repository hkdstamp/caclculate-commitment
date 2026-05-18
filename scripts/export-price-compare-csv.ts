import fs from 'fs';
import path from 'path';
import { fetchPricingFromAWS } from '../lib/aws-pricing-client';
import { fetchPricingFromReservedCostsApi } from '../lib/awsreservedcosts-endpoint-client';
import { getBestReservationDiscount } from '../lib/reservation-catalog';

type CsvRow = {
  service: string;
  product_instancetype: string;
  lineitem_operation: string;
  lineitem_usagetype: string;
  product_region: string;
  product_operatingsystem?: string;
  product_tenancy?: string;
  product_databaseedition?: string;
  product_databaseengine?: string;
  product_deploymentoption?: string;
  product_licensemodel?: string;
};

function loadEnv(pathname: string) {
  if (!fs.existsSync(pathname)) return;
  const lines = fs.readFileSync(pathname, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1);
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function parseCsv(filePath: string): CsvRow[] {
  const lines = fs.readFileSync(filePath, 'utf8').trim().split(/\r?\n/);
  const headers = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const cols = line.split(',');
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? '';
    });
    return row as unknown as CsvRow;
  });
}

function csvEscape(value: unknown): string {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function inferTenancy(row: CsvRow): 'Shared' | 'Dedicated' | 'Host' {
  const tenancy = (row.product_tenancy || '').trim();
  if (tenancy === 'Shared' || tenancy === 'Dedicated' || tenancy === 'Host') return tenancy;
  return row.lineitem_usagetype.toLowerCase().includes('dedicated') ? 'Dedicated' : 'Shared';
}

function summarizeBest(discounts: any[]) {
  const best = getBestReservationDiscount(discounts);
  if (!best) return null;
  return {
    contract_years: best.contract_years,
    payment_method: best.payment_method,
    unit_price: best.unit_price,
    unit_price_unit: best.unit_price_unit,
    upfront_fee: best.upfront_fee ?? 0,
  };
}

function top3(discounts: any[]) {
  return discounts
    .slice(0, 3)
    .map((d) => ({
      years: d.contract_years,
      payment: d.payment_method,
      unit_price: d.unit_price,
      unit: d.unit_price_unit,
      upfront: d.upfront_fee ?? 0,
    }));
}

async function compareOne(
  row: CsvRow,
  reservationType: 'RI' | 'SP',
  requestId: number,
): Promise<string[]> {
  const tenancy = inferTenancy(row);
  const operatingSystem = row.product_operatingsystem || '';
  const databaseEngine = row.product_databaseengine || '';
  const databaseEdition = row.product_databaseedition || '';
  const deploymentOption = row.product_deploymentoption || '';
  const licenseModel = row.product_licensemodel || '';

  const instanceType = reservationType === 'RI' ? (row.product_instancetype || '') : '';

  const oldResults = await fetchPricingFromAWS(
    row.service,
    instanceType || undefined,
    row.product_region,
    reservationType,
    tenancy,
    operatingSystem || undefined,
    databaseEngine || undefined,
    databaseEdition || undefined,
    deploymentOption || undefined,
    licenseModel || undefined,
  );

  const newResults = await fetchPricingFromReservedCostsApi(
    row.service,
    instanceType || undefined,
    row.product_region,
    reservationType,
    tenancy,
    operatingSystem || undefined,
    databaseEngine || undefined,
    databaseEdition || undefined,
    deploymentOption || undefined,
    licenseModel || undefined,
  );

  const oldBest = summarizeBest(oldResults);
  const newBest = summarizeBest(newResults);

  return [
    String(requestId),
    reservationType,
    row.service,
    row.product_region,
    row.lineitem_operation,
    row.lineitem_usagetype,
    instanceType,
    tenancy,
    operatingSystem,
    databaseEngine,
    databaseEdition,
    deploymentOption,
    licenseModel,
    String(oldResults.length),
    String(oldBest?.contract_years ?? ''),
    String(oldBest?.payment_method ?? ''),
    String(oldBest?.unit_price ?? ''),
    String(oldBest?.unit_price_unit ?? ''),
    String(oldBest?.upfront_fee ?? ''),
    JSON.stringify(top3(oldResults)),
    String(newResults.length),
    String(newBest?.contract_years ?? ''),
    String(newBest?.payment_method ?? ''),
    String(newBest?.unit_price ?? ''),
    String(newBest?.unit_price_unit ?? ''),
    String(newBest?.upfront_fee ?? ''),
    JSON.stringify(top3(newResults)),
  ];
}

async function main() {
  loadEnv('.env.local');

  const inputArg = process.argv[2];
  const outputArg = process.argv[3];
  const inputPath = path.resolve(inputArg || './public/sample-data.csv');
  const outputPath = path.resolve(outputArg || './public/price-compare-old-new-sample-data.csv');
  const rows = parseCsv(inputPath);

  const header = [
    'request_id',
    'reservation_type',
    'service',
    'region',
    'lineitem_operation',
    'lineitem_usagetype',
    'instance_type',
    'tenancy',
    'operating_system',
    'database_engine',
    'database_edition',
    'deployment_option',
    'license_model',
    'old_count',
    'old_best_contract_years',
    'old_best_payment_method',
    'old_best_unit_price',
    'old_best_unit_price_unit',
    'old_best_upfront_fee',
    'old_top3_json',
    'new_count',
    'new_best_contract_years',
    'new_best_payment_method',
    'new_best_unit_price',
    'new_best_unit_price_unit',
    'new_best_upfront_fee',
    'new_top3_json',
  ];

  const lines: string[] = [header.map(csvEscape).join(',')];

  let requestId = 1;
  for (const row of rows) {
    const ri = await compareOne(row, 'RI', requestId);
    lines.push(ri.map(csvEscape).join(','));
    requestId += 1;

    const sp = await compareOne(row, 'SP', requestId);
    lines.push(sp.map(csvEscape).join(','));
    requestId += 1;
  }

  fs.writeFileSync(outputPath, lines.join('\n') + '\n');
  console.log(`saved: ${outputPath}`);
  console.log(`rows: ${lines.length - 1}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
