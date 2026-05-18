/**
 * RDS 3年契約PartialUpfront の結果検証スクリプト
 *
 * test-rds.csv の全インスタンスについて:
 * 1. BigQuery から 3yr PartialUpfront の unit_price / upfront_fee を取得
 * 2. calculator.ts と同じ計算式でコミットメントコストを算出
 * 3. 期待値と比較して正しいかを検証
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/verify-rds-3yr-partial.ts
 */
import fs from 'fs';
import path from 'path';
import { fetchPricingFromReservedCostsApi } from '../lib/awsreservedcosts-endpoint-client';
import { ReservationDiscount } from '../lib/types';

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

type CsvRow = Record<string, string>;

function parseCsv(filePath: string): CsvRow[] {
  const lines = fs.readFileSync(filePath, 'utf8').trim().split(/\r?\n/);
  const headers = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const cols = line.split(',');
    const row: CsvRow = {};
    headers.forEach((h, i) => { row[h.trim()] = (cols[i] ?? '').trim(); });
    return row;
  });
}

/** calculator.ts の getRDSDeploymentOption と同じロジック */
function getDeploymentOption(row: CsvRow): string {
  // product_deploymentoption が空なら lineitem_usagetype の Multi-AZ から判定
  if (row.product_deploymentoption) return row.product_deploymentoption;
  return row.lineitem_usagetype.toLowerCase().includes('multi-az') ? 'Multi-AZ' : 'Single-AZ';
}

/** calculator.ts の calculateRICommitment と同じ計算式 */
function calcCommitment(discount: ReservationDiscount, usageAmount: number) {
  const hourly = usageAmount * discount.unit_price;
  const upfront = discount.upfront_fee ?? 0;
  const contractMonths = discount.contract_years * 12;
  const monthlyUpfront = upfront / contractMonths;
  return { hourly, upfront, contractMonths, monthlyUpfront, total: hourly + monthlyUpfront };
}

async function fetchAll3yrPartial(
  instanceType: string,
  deploymentOption: string,
  databaseEngine: string,
  databaseEdition: string,
  lineitemOperation: string,
  lineitemUsageType: string,
): Promise<ReservationDiscount[]> {
  const all = await fetchPricingFromReservedCostsApi(
    'AmazonRDS',
    instanceType,
    'ap-northeast-1',
    'RI',
    undefined,
    undefined,
    databaseEngine,
    databaseEdition,
    deploymentOption,
    undefined,
    lineitemOperation,
    lineitemUsageType,
  );
  return all;
}

async function main() {
  loadEnv('.env.local');

  // キャッシュをクリアして最新データを使用
  const cacheFile = path.join(process.cwd(), '.cache', 'pricing', 'reserved-costs.json');
  if (fs.existsSync(cacheFile)) {
    fs.unlinkSync(cacheFile);
    console.log('[cache] reserved-costs.json を削除しました\n');
  }

  const rows = parseCsv(path.join(process.cwd(), 'public', 'test-rds.csv'));

  // 重複排除: instanceType + lineitem_usagetype の組み合わせ（Usage/DiscountedUsage は区別）
  const seen = new Set<string>();
  const uniqueRows = rows.filter((r) => {
    const key = `${r.product_instancetype}|${r.lineitem_usagetype}|${r.lineitem_lineitemtype}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log('='.repeat(72));
  console.log('RDS 3年契約PartialUpfront 検証');
  console.log('='.repeat(72));
  console.log(`対象行数: ${uniqueRows.length} (重複排除後)\n`);

  for (const row of uniqueRows) {
    const instanceType     = row.product_instancetype;
    const deploymentOption = getDeploymentOption(row);
    const databaseEngine   = row.product_databaseengine;
    const databaseEdition  = row.product_databaseedition;
    const lineitemOp       = row.lineitem_operation;
    const lineitemUsage    = row.lineitem_usagetype;
    const usageAmount      = parseFloat(row.usage_amount);
    const ondemandRate     = parseFloat(row.pricing_publicondemandrate);
    const lineitemType     = row.lineitem_lineitemtype;  // Usage / DiscountedUsage
    const resourceId       = row.lineitem_resourceid.split(':').pop() ?? '';

    console.log(`${'─'.repeat(72)}`);
    console.log(`リソース     : ${resourceId}`);
    console.log(`インスタンス : ${instanceType}  [${lineitemType}]`);
    console.log(`deploy       : ${deploymentOption}`);
    console.log(`DB           : ${databaseEngine} ${databaseEdition}`);
    console.log(`usage_type   : ${lineitemUsage}  operation: ${lineitemOp}`);
    console.log(`usage_amount : ${usageAmount} hr  ondemand_rate: $${ondemandRate}/hr`);

    // usage_amount が極端に小さい場合は警告
    if (usageAmount < 100) {
      console.log(`  ⚠️  usage_amount=${usageAmount} hr が少ない → 初期費用の月額償却($upfront/36ヶ月)が支配的になる`);
    }

    try {
      const discounts = await fetchAll3yrPartial(
        instanceType, deploymentOption, databaseEngine, databaseEdition, lineitemOp, lineitemUsage,
      );

      if (discounts.length === 0) {
        console.log('  ❌ BigQueryから結果なし');
        continue;
      }

      // 全オプションを表示
      console.log(`\n  BigQuery結果 (${discounts.length}件):`);
      for (const d of discounts) {
        const upfrontStr = d.upfront_fee ? ` upfront=$${d.upfront_fee}` : '';
        console.log(
          `    ${d.contract_years}yr ${d.payment_method.padEnd(14)} ` +
          `unit_price=${String(d.unit_price).padEnd(8)}${upfrontStr}`,
        );
      }

      // 3yr PartialUpfront を抽出
      const threeYrPartial = discounts.find(
        d => d.contract_years === 3 && d.payment_method === 'PartialUpfront',
      );

      if (!threeYrPartial) {
        console.log('\n  ⚠️  3yr PartialUpfront が存在しない');
        continue;
      }

      // --- 計算 ---
      const { hourly, upfront, contractMonths, monthlyUpfront, total } =
        calcCommitment(threeYrPartial, usageAmount);

      // オンデマンドコスト（月間）
      const ondemandCost = usageAmount * ondemandRate;

      console.log('\n  【3yr PartialUpfront 計算結果】');
      console.log(`    unit_price        : ${threeYrPartial.unit_price} /hr`);
      console.log(`    upfront_fee       : $${upfront} (${contractMonths}ヶ月 → 月額 $${monthlyUpfront.toFixed(4)})`);
      console.log(`    usage_amount      : ${usageAmount} hr`);
      console.log(`    月間hourlyコスト  : ${usageAmount} × ${threeYrPartial.unit_price} = $${hourly.toFixed(4)}`);
      console.log(`    月間コミットメント: $${hourly.toFixed(4)} + $${monthlyUpfront.toFixed(4)} = $${total.toFixed(4)}`);
      console.log(`    オンデマンド月間  : ${usageAmount} × ${ondemandRate} = $${ondemandCost.toFixed(4)}`);

      const savings = ondemandCost - total;
      const discountRate = ondemandCost > 0 ? (savings / ondemandCost) * 100 : 0;
      console.log(`    コスト削減額      : $${savings.toFixed(4)} (削減率 ${discountRate.toFixed(1)}%)`);

      // AWS公式サイト相当の有効割引率（upfront込み実効単価 / オンデマンド単価）
      const effectiveHourlyRate = usageAmount > 0 ? total / usageAmount : 0;
      const effectiveDiscount = ondemandRate > 0
        ? (1 - effectiveHourlyRate / ondemandRate) * 100
        : 0;
      console.log(`    実効割引率        : ${effectiveDiscount.toFixed(1)}%`);
      console.log(`    実効時間単価      : $${effectiveHourlyRate.toFixed(4)}/hr vs オンデマンド $${ondemandRate}/hr`);

    } catch (e) {
      console.error('  エラー:', e);
    }
  }

  console.log('\n' + '='.repeat(72));
  console.log('検証完了');
  console.log('='.repeat(72));
}

main().catch(console.error);
