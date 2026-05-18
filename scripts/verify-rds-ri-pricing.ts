/**
 * RDS RI価格のBigQuery調査スクリプト
 * 
 * 問題: Oracle Standard Two RDSインスタンスのRI価格が正しく取得されていない
 * 原因調査: BigQueryから実際に何が返ってくるかを確認する
 * 
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/verify-rds-ri-pricing.ts
 */
import fs from 'fs';
import { listReservedCosts } from '../lib/awsreservedcosts';
import { fetchPricingFromReservedCostsApi } from '../lib/awsreservedcosts-endpoint-client';

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

// テストケース（test-rds.csvから）
const TEST_CASES = [
  {
    label: 'db.r5.4xlarge Multi-AZ (Oracle Standard Two)',
    instanceType: 'db.r5.4xlarge',
    deploymentOption: 'Multi-AZ',
    expectedOndemand: 8.896,
    expectedRiPrice: 5.9749,
    description: '期待値: AWSサイト 1yr NoUpfront = 5.9749/hr',
  },
  {
    label: 'db.r5.2xlarge Single-AZ (Oracle Standard Two)',
    instanceType: 'db.r5.2xlarge',
    deploymentOption: 'Single-AZ',
    expectedOndemand: 2.224,
    expectedRiPrice: 1.4937,
    description: '期待値: AWSサイト 1yr NoUpfront = 1.4937/hr',
  },
];

// BigQueryから返ってくる os_db の値を確認（フィルタなし）
async function queryWithoutFilter(instanceType: string) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`[フィルタなし] ${instanceType} の全レコード`);
  console.log('─'.repeat(70));
  const rows = await listReservedCosts({
    service: 'rds',
    locationName: 'Asia Pacific (Tokyo)',
    instanceType,
  });
  return rows;
}

// BigQueryから返ってくる os_db の値を確認（deploymentOptionフィルタあり）
async function queryWithDeploymentFilter(instanceType: string, deploymentOption: string) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`[deploymentOption=${deploymentOption}] ${instanceType}`);
  console.log('─'.repeat(70));
  const rows = await listReservedCosts({
    service: 'rds',
    locationName: 'Asia Pacific (Tokyo)',
    instanceType,
    deploymentOption,
  });
  return rows;
}

// BigQueryから返ってくる os_db の値を確認（os_dbフィルタあり）
async function queryWithOsDbFilter(instanceType: string, deploymentOption: string, operatingSystem: string) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`[deploymentOption=${deploymentOption}, os_db=${operatingSystem}] ${instanceType}`);
  console.log('─'.repeat(70));
  const rows = await listReservedCosts({
    service: 'rds',
    locationName: 'Asia Pacific (Tokyo)',
    instanceType,
    deploymentOption,
    operatingSystem,
  });
  return rows;
}

function printRows(rows: Awaited<ReturnType<typeof listReservedCosts>>, showDetail = false) {
  if (rows.length === 0) {
    console.log('  ❌ 結果なし');
    return;
  }

  // os_db の一覧（重複排除）
  const osDbs = [...new Set(rows.map(r => r.operating_system))];
  console.log(`  os_db の種類: ${osDbs.map(v => `"${v}"`).join(', ')}`);
  console.log(`  総レコード数: ${rows.length}`);
  console.log('');

  // 詳細表示
  for (const row of rows) {
    const mark =
      row.operating_system.toLowerCase().includes('oracle') ? '🔶 ORACLE' :
      row.operating_system.toLowerCase().includes('mysql') ? '🔵 MySQL' :
      row.operating_system.toLowerCase().includes('postgres') ? '🟢 PG' :
      '⬜ other';

    const line =
      `  ${mark.padEnd(12)} ` +
      `deploy=${row.deployment_option.padEnd(10)} ` +
      `${row.lease_contract_length.padEnd(5)} ` +
      `${row.purchase_option.padEnd(16)} ` +
      `hourly=${String(row.hourly_cost).padEnd(10)} ` +
      `upfront=${String(row.upfront_cost).padEnd(8)} ` +
      `os_db="${row.operating_system}"`;

    if (showDetail) {
      console.log(line);
      console.log(`               usage_id="${row.usage_id}"  operation="${row.operation}"`);
    } else {
      console.log(line);
    }
  }
}

async function main() {
  loadEnv('.env.local');

  console.log('='.repeat(70));
  console.log('RDS RI 価格 BigQuery 調査');
  console.log('='.repeat(70));
  console.log('AWSサイトの期待値:');
  for (const tc of TEST_CASES) {
    console.log(`  ${tc.label}: 1yr NoUpfront = ${tc.expectedRiPrice}/hr`);
  }

  for (const tc of TEST_CASES) {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`テストケース: ${tc.label}`);
    console.log(`${tc.description}`);
    console.log('═'.repeat(70));

    // Step 1: フィルタなし（全エンジンを確認）
    try {
      const allRows = await queryWithoutFilter(tc.instanceType);
      console.log('\n【Step 1】フィルタなし（全DB エンジンを確認）');
      printRows(allRows);

      // os_db の候補から Oracle を検索
      const oracleCandidates = [...new Set(
        allRows
          .filter(r => r.operating_system.toLowerCase().includes('oracle'))
          .map(r => r.operating_system)
      )];
      console.log(`\n  → Oracle系 os_db 候補: ${oracleCandidates.length === 0 ? 'なし' : oracleCandidates.map(v => `"${v}"`).join(', ')}`);
    } catch (e) {
      console.error('  Step 1 エラー:', e);
    }

    // Step 2: deploymentOptionフィルタあり
    try {
      const filteredRows = await queryWithDeploymentFilter(tc.instanceType, tc.deploymentOption);
      console.log(`\n【Step 2】deployment_option="${tc.deploymentOption}" でフィルタ`);
      printRows(filteredRows);

      // 現在のコードで使われる値（最初の3yr NoUpfrontを選択）
      const threeYrNoUpfront = filteredRows.filter(r => 
        r.lease_contract_length.includes('3') && r.purchase_option === 'No Upfront'
      );
      if (threeYrNoUpfront.length > 0) {
        console.log('\n  ⚠️  現在のコードが選ぶ候補（3yr NoUpfront の最初の結果）:');
        console.log(`     os_db="${threeYrNoUpfront[0].operating_system}" hourly=${threeYrNoUpfront[0].hourly_cost}`);
        if (threeYrNoUpfront.length > 1) {
          console.log(`     ※ ${threeYrNoUpfront.length}件あり、Oracleの価格が混入している可能性`);
        }
      }
    } catch (e) {
      console.error('  Step 2 エラー:', e);
    }

    // Step 3: Oracle Standard Two で os_db フィルタを試行（複数パターン）
    const oraclePatterns = [
      'Oracle Standard Two',
      'Oracle Standard Edition Two',
      'Oracle (se2)',
      'Oracle SE2',
    ];
    console.log(`\n【Step 3】Oracle の os_db パターンを試行`);
    for (const pattern of oraclePatterns) {
      try {
        const rows = await queryWithOsDbFilter(tc.instanceType, tc.deploymentOption, pattern);
        const found = rows.length > 0;
        console.log(`  os_db="${pattern}" → ${found ? `✅ ${rows.length}件` : '❌ 0件'}`);
        if (found) {
          for (const row of rows.filter(r => r.purchase_option === 'No Upfront' && r.lease_contract_length.includes('1'))) {
            console.log(`    1yr NoUpfront: hourly=${row.hourly_cost} (期待値: ${tc.expectedRiPrice})`);
          }
        }
      } catch (e) {
        console.error(`  os_db="${pattern}" エラー:`, e);
      }
    }

    // Step 4: Oracle Standard Two の全件詳細（usage_id, operation含む）
    try {
      const rows = await queryWithOsDbFilter(tc.instanceType, tc.deploymentOption, 'Oracle Standard Two');
      if (rows.length > 0) {
        console.log(`\n【Step 4】Oracle Standard Two の全件詳細（usage_id, operation 含む）`);
        printRows(rows, true /* showDetail */);
      }
    } catch (e) {
      console.error('  Step 4 エラー:', e);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('調査完了');
  console.log('='.repeat(70));

  // 修正後の動作確認: fetchPricingFromReservedCostsApi で正しい価格が返るか
  console.log('\n' + '='.repeat(70));
  console.log('【修正後の動作確認】fetchPricingFromReservedCostsApi');
  console.log('='.repeat(70));

  const fixedCases = [
    {
      label: 'db.r5.4xlarge Multi-AZ Oracle Standard Two (License included)',
      instanceType: 'db.r5.4xlarge',
      databaseEngine: 'Oracle',
      databaseEdition: 'Standard Two',
      deploymentOption: 'Multi-AZ',
      lineitemOperation: 'CreateDBInstance:0020',
      lineitemUsageType: 'APN1-Multi-AZUsage:db.r5.4xl',
      expectedRiPrice: 5.9749,
    },
    {
      label: 'db.r5.2xlarge Single-AZ Oracle Standard Two (License included)',
      instanceType: 'db.r5.2xlarge',
      databaseEngine: 'Oracle',
      databaseEdition: 'Standard Two',
      deploymentOption: 'Single-AZ',
      lineitemOperation: 'CreateDBInstance:0020',
      lineitemUsageType: 'APN1-InstanceUsage:db.r5.2xl',
      expectedRiPrice: 1.4937,
    },
  ];

  for (const tc of fixedCases) {
    console.log(`\n  ${tc.label}`);
    try {
      const results = await fetchPricingFromReservedCostsApi(
        'AmazonRDS',
        tc.instanceType,
        'ap-northeast-1',
        'RI',
        undefined,
        undefined,
        tc.databaseEngine,
        tc.databaseEdition,
        tc.deploymentOption,
        undefined,
        tc.lineitemOperation,
        tc.lineitemUsageType
      );
      console.log(`  → ${results.length}件取得`);
      const oneYrNoUpfront = results.find(
        r => r.contract_years === 1 && r.payment_method === 'NoUpfront'
      );
      if (oneYrNoUpfront) {
        const ok = oneYrNoUpfront.unit_price === tc.expectedRiPrice;
        console.log(`  → 1yr NoUpfront: ${oneYrNoUpfront.unit_price} ${ok ? '✅ 期待値と一致' : `❌ 期待値 ${tc.expectedRiPrice} と不一致`}`);
      } else {
        console.log(`  → ❌ 1yr NoUpfront が見つからない`);
        console.log('     取得した価格オプション:', results.map(r => `${r.contract_years}yr ${r.payment_method}: ${r.unit_price}`));
      }
    } catch (e) {
      console.error('  エラー:', e);
    }
  }
}

main().catch(console.error);
