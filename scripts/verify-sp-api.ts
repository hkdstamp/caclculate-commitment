/**
 * DescribeSavingsPlansOfferingRates API 検証スクリプト
 * test-ec2.csvの各行について、ComputeSavingsPlansの単価が取得できるか検証する
 */
import fs from 'fs';
import path from 'path';
import {
  SavingsplansClient,
  DescribeSavingsPlansOfferingRatesCommand,
  SavingsPlanType,
  SavingsPlanProductType,
  SavingsPlanRateServiceCode,
} from '@aws-sdk/client-savingsplans';

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

type CsvRow = {
  service: string;
  product_instancetype: string;
  lineitem_operation: string;
  lineitem_usagetype: string;
  product_region: string;
  product_operatingsystem?: string;
  product_tenancy?: string;
};

function parseCsv(filePath: string): CsvRow[] {
  const lines = fs.readFileSync(filePath, 'utf8').trim().split(/\r?\n/);
  const headers = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const cols = line.split(',');
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cols[i] ?? ''; });
    return row as unknown as CsvRow;
  });
}

function getSavingsPlansClient(): SavingsplansClient {
  const accessKeyId = process.env.CC_AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CC_AWS_SECRET_ACCESS_KEY;
  const region = process.env.CC_AWS_REGION || 'us-east-1';

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('CC_AWS_ACCESS_KEY_ID / CC_AWS_SECRET_ACCESS_KEY が未設定です');
  }

  return new SavingsplansClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });
}

async function describeRates(
  client: SavingsplansClient,
  usageType: string,
  operation: string,
): Promise<void> {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`usageType: ${usageType}  operation: ${operation}`);
  console.log('='.repeat(70));

  let nextToken: string | undefined;
  let totalCount = 0;

  do {
    const cmd = new DescribeSavingsPlansOfferingRatesCommand({
      savingsPlanTypes: [SavingsPlanType.COMPUTE],
      products: [SavingsPlanProductType.EC2],
      serviceCodes: [SavingsPlanRateServiceCode.EC2],
      usageTypes: [usageType],
      operations: [operation],
      nextToken,
      maxResults: 100,
    });

    const res = await client.send(cmd);
    const rates = res.searchResults ?? [];
    totalCount += rates.length;

    for (const r of rates) {
      const props: Record<string, string> = {};
      for (const p of r.properties ?? []) {
        props[p.name ?? ''] = p.value ?? '';
      }
      console.log(JSON.stringify({
        savingsPlanType: r.savingsPlanOffering?.planType,
        paymentOption: r.savingsPlanOffering?.paymentOption,
        durationSeconds: r.savingsPlanOffering?.durationSeconds,
        rate: r.rate,
        unit: r.unit,
        usageType: r.usageType,
        operation: r.operation,
        productType: r.productType,
        instanceType: props['instanceType'],
        tenancy: props['tenancy'],
        productDescription: props['productDescription'],
        region: props['region'],
      }));
    }

    nextToken = res.nextToken;
  } while (nextToken);

  console.log(`  → 合計 ${totalCount} 件`);
}

async function main() {
  loadEnv('.env.local');

  const inputArg = process.argv[2];
  const inputPath = path.resolve(inputArg || './public/test-ec2.csv');
  const rows = parseCsv(inputPath);

  // 重複を除去した usageType + operation の組み合わせを収集
  const seen = new Set<string>();
  const targets: { usageType: string; operation: string; instanceType: string; os: string; tenancy: string }[] = [];
  for (const row of rows) {
    const key = `${row.lineitem_usagetype}|${row.lineitem_operation}`;
    if (!seen.has(key)) {
      seen.add(key);
      targets.push({
        usageType: row.lineitem_usagetype,
        operation: row.lineitem_operation,
        instanceType: row.product_instancetype,
        os: row.product_operatingsystem ?? '',
        tenancy: row.product_tenancy ?? 'Shared',
      });
    }
  }

  console.log(`検証対象: ${targets.length} 組み合わせ`);
  console.log('入力CSV:', inputPath);

  const client = getSavingsPlansClient();

  for (const t of targets) {
    await describeRates(client, t.usageType, t.operation);
  }

  console.log('\n\n検証完了');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
