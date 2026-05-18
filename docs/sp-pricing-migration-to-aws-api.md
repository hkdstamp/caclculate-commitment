# SavingsPlans単価取得ソース移行：BigQuery → DescribeSavingsPlansOfferingRates API

## 概要

EC2 ComputeSavingsPlansの単価取得ソースを、BigQuery（AWSプライスデータを格納した内部テーブル）からAWS公式API（`savingsplans:DescribeSavingsPlansOfferingRates`）に移行した。

---

## 背景・課題

従来の実装では `lib/awsreservedcosts-endpoint-client.ts` のSP処理が以下の流れだった。

```
fetchPricingFromReservedCostsApi (SP)
  └─ fetchSavingsPlansFromApi(service, region)
       └─ listSavingsPlansCosts({ service, locationName })  ← BigQuery
  └─ filterSavingsPlanRows(rows, instanceType, operation, usageType, tenancy, os)
```

**問題点：**
- BigQueryのソーステーブル（`aws_pricing.compute`）に含まれる単価が実態と乖離していた。
  - 例：c5.xlarge Windows Dedicated 3yr NoUpfront → BigQuery: **0.289** / 正しい値: **0.323**
  - 例：r5.4xlarge RHEL Shared 3yr NoUpfront → BigQuery: **0.698** / 正しい値: **0.807**
- BigQueryのソースデータは変更不可のため、APIへの切り替えを採用。

---

## 解決策

### 使用API

| 項目 | 内容 |
|---|---|
| API名 | `savingsplans:DescribeSavingsPlansOfferingRates` |
| SDKパッケージ | `@aws-sdk/client-savingsplans` |
| クライアントクラス | `SavingsplansClient`（小文字p） |
| 必要IAM権限 | `savingsplans:DescribeSavingsPlansOfferingRates` |

### フィルター条件

```typescript
new DescribeSavingsPlansOfferingRatesCommand({
  savingsPlanTypes: [SavingsPlanType.COMPUTE],        // "Compute"
  products: [SavingsPlanProductType.EC2],             // "EC2"
  serviceCodes: [SavingsPlanRateServiceCode.EC2],     // "AmazonEC2"
  usageTypes: [lineitem_usagetype],  // 例: "APN1-DedicatedUsage:c5.xlarge"
  operations: [lineitem_operation],  // 例: "RunInstances:0002"
  maxResults: 100,
})
```

`lineitem_usagetype` と `lineitem_operation` をそのままフィルターに渡すことで、OS・テナンシー・インスタンスタイプ単位で正確な単価が取得できる。

---

## 変更ファイル一覧

### `lib/awsreservedcosts-endpoint-client.ts`

- **追加インポート：** `SavingsplansClient`, `DescribeSavingsPlansOfferingRatesCommand`, `SavingsPlanType`, `SavingsPlanProductType`, `SavingsPlanRateServiceCode`
- **削除インポート：** `listSavingsPlansCosts`, `SavingsPlanCost as SavingsPlanCostResponse`（BigQuery依存）
- **新規関数：** `getSavingsPlansClient()` — SavingsplansClientのシングルトン生成
- **新規関数：** `fetchSavingsPlansFromAwsApi(usageType, operation, region)` — DescribeSavingsPlansOfferingRatesを呼び出し、`ReservationDiscount[]` を返す
- **削除関数：** `fetchSavingsPlansFromApi` (BigQuery版)
- **削除関数：** `filterSavingsPlanRows`, `normalizeForMatch`, `buildUsageSuffix`（API直接フィルターで不要）
- **キャッシュ型変更：** `spApiCache` を `Map<string, CacheEntry<SavingsPlanCostResponse>>` → `Map<string, CacheEntry<ReservationDiscount>>`
- **キャッシュキー変更：** `sp:${service}:${locationName}` → `sp:${usageType}:${operation}`

### `scripts/verify-sp-api.ts`（新規）

`DescribeSavingsPlansOfferingRates` APIの動作検証スクリプト。CSVファイルの各行の `lineitem_usagetype` / `lineitem_operation` に対してAPIを呼び出し、返却されるレートを標準出力に表示する。

**実行方法：**
```bash
TS_NODE_PROJECT=tsconfig.scripts.json node --require ts-node/register \
  scripts/verify-sp-api.ts public/test-ec2.csv
```

### `tsconfig.scripts.json`（新規）

`scripts/` 配下のスクリプトを `ts-node` で実行するための専用tsconfig。プロジェクトの `tsconfig.json`（`module: esnext`, `moduleResolution: bundler`）がts-nodeと非互換なため、`module: commonjs` + `moduleResolution: node` でオーバーライドする。

**使用方法：**
```bash
TS_NODE_PROJECT=tsconfig.scripts.json node --require ts-node/register scripts/xxx.ts
```

### `scripts/export-price-compare-csv.ts`

- 動的import（`await import()`）を静的importに戻した
- デバッグ用の `console.log` / `return;` を削除し、main関数を元の完全な実装に復元

### `package.json`

- 誤って追加した `"type": "module"` を削除
- `devDependencies` に `madge` を追加（依存関係循環解析ツール）

---

## 検証結果

`public/test-ec2.csv` を使用した検証結果（`price-compare-test-ec2-rerun.csv`）：

| usageType | operation | OS | テナンシー | API取得件数 | new_best（3yr NoUpfront） |
|---|---|---|---|---|---|
| APN1-DedicatedUsage:c5.xlarge | RunInstances:0002 | Windows | Dedicated | 6件 | **0.323/hr** ✓ |
| APN1-BoxUsage:r5.4xlarge | RunInstances:0010 | RHEL | Shared | 6件 | **0.807/hr** ✓ |
| APN1-BoxUsage:r5.xlarge | RunInstances:0010 | RHEL | Shared | 6件 | **0.216/hr** ✓ |

各 usageType + operation に対して 1年・3年 × NoUpfront / PartialUpfront / AllUpfront = **6パターン** が正しく返却される。

---

## SP単価のデータ構造（`ReservationDiscount`）

APIから返却される各レートは以下のフィールドにマッピングされる：

| `ReservationDiscount` フィールド | ソース |
|---|---|
| `contract_years` | `durationSeconds >= 90000000` → 3年、それ以外 → 1年 |
| `payment_method` | `"No Upfront"` → `NoUpfront` / `"Partial Upfront"` → `PartialUpfront` / その他 → `AllUpfront` |
| `unit_price` | `rate`（文字列をparseFloat） |
| `unit_price_unit` | `"per hour"` 固定 |
| `tenancy` | `properties["tenancy"]`（`"shared"` / `"dedicated"` など） |
| `operating_system` | `properties["productDescription"]` |
| `usage_type` | `usageType`（レスポンス直接） |
| `operation` | `operation`（レスポンス直接） |
| `upfront_fee` | `0`（APIはhourly rateのみ返却。実際の前払い費用は別途計算が必要） |

---

## 注意事項

- `upfront_fee` は常に `0` となる。PartialUpfront / AllUpfront の実際の前払い金額はAPIでは返却されず、hourly rateのみ返却される。
- APIは `us-east-1` リージョンエンドポイントに対してリクエストを送る（`CC_AWS_REGION` 環境変数で変更可）。
- AWS認証情報は `CC_AWS_ACCESS_KEY_ID` / `CC_AWS_SECRET_ACCESS_KEY` 環境変数から読み込む。
