# 検証スクリプト実行手順

`scripts/` 配下の検証スクリプトを実行するための手順書。

---

## 前提条件

### 必要な環境変数 (`.env.local`)

スクリプトは起動時に `.env.local` を自動読み込みする。以下のキーが揃っていることを確認する。

| 変数名 | 用途 | 対象スクリプト |
|---|---|---|
| `CC_GCP_SERVICE_ACCOUNT_B64` | BigQuery 認証 (base64 エンコードされたサービスアカウント JSON) | RDS RI 系 |
| `CC_AWS_ACCESS_KEY_ID` | AWS API 認証 | SP 系 |
| `CC_AWS_SECRET_ACCESS_KEY` | AWS API 認証 | SP 系 |
| `CC_AWS_REGION` | AWS リージョン (デフォルト `us-east-1`) | SP 系 |

### キャッシュのクリア

BigQuery から最新データを取得したい場合は事前にキャッシュファイルを削除する。

```bash
rm -f .cache/pricing/reserved-costs.json
```

キャッシュが残っている場合、前回の取得結果が再利用されるため価格変更が反映されない。

---

## スクリプト一覧

### 1. `verify-rds-ri-pricing.ts` — RDS RI 価格の BigQuery クエリ調査

**目的:** Oracle Standard Two の RDS インスタンスについて、フィルタあり/なしで BigQuery から何が返るかを段階的に確認する。`os_db` / `usage_id` / `operation` 各フィルタの効果を検証する。

**対象インスタンス:** `db.r5.4xlarge` Multi-AZ、`db.r5.2xlarge` Single-AZ (Oracle Standard Two)

**期待値:** 1yr NoUpfront で `db.r5.4xlarge`=5.9749/hr、`db.r5.2xlarge`=1.4937/hr

```bash
# キャッシュクリア後に実行
rm -f .cache/pricing/reserved-costs.json
npx ts-node --project tsconfig.scripts.json scripts/verify-rds-ri-pricing.ts
```

---

### 2. `verify-rds-3yr-partial.ts` — RDS 3年契約 PartialUpfront 計算検証

**目的:** `public/test-rds.csv` の全インスタンスについて、BigQuery から 3yr PartialUpfront の `unit_price`/`upfront_fee` を取得し、`calculator.ts` と同じ計算式でコミットメントコストを算出・検証する。

**対象:** `public/test-rds.csv` に含まれる全 Oracle Standard Two インスタンス

**期待値 (Oracle Standard Two、24/7 稼働時の実効割引率):**

| インスタンス | Deploy | unit_price | upfront_fee | 実効割引率 |
|---|---|---|---|---|
| `db.r5.4xlarge` | Multi-AZ | $1.9562/hr | $51,410 | ~56.4% |
| `db.r5.2xlarge` | Single-AZ | $0.4891/hr | $12,853 | ~56.4% |
| `db.r5.xlarge` | Single-AZ | $0.2445/hr | $6,426 | ~56.4% |

> **注意:** `usage_amount` が月 744hr より大幅に少ない行（Usage 行の端数など）では、upfront の月額償却が支配的になり実効割引率が低く見える。これは期待される動作。

```bash
# キャッシュクリア後に実行
rm -f .cache/pricing/reserved-costs.json
npx ts-node --project tsconfig.scripts.json scripts/verify-rds-3yr-partial.ts
```

---

### 3. `verify-sp-api.ts` — Savings Plans API 疎通確認

**目的:** `public/test-ec2.csv` の各行について、AWS `DescribeSavingsPlansOfferingRates` API から ComputeSavingsPlans の単価が取得できることを確認する。

**必要条件:** `CC_AWS_ACCESS_KEY_ID` / `CC_AWS_SECRET_ACCESS_KEY` が有効な AWS 認証情報であること。

```bash
npx ts-node --project tsconfig.scripts.json scripts/verify-sp-api.ts
```

---

### 4. `export-price-compare-csv.ts` — 価格比較 CSV エクスポート

**目的:** AWS Price List API / BigQuery / Savings Plans API の各取得方式で取得した RI/SP 割引単価を横並びに比較する CSV を生成する。新旧実装の価格差の確認などに使用する。

**入力:** `public/` 配下の各 CSV ファイル (例: `sample-data.csv`)

**出力:** 標準出力に CSV 形式で出力（リダイレクトしてファイルに保存可能）

```bash
# 結果をファイルに保存する場合
npx ts-node --project tsconfig.scripts.json scripts/export-price-compare-csv.ts > public/price-compare-result.csv
```

---

## 共通の実行手順まとめ

```bash
# 1. プロジェクトルートに移動
cd /path/to/caclculate-commitment

# 2. .env.local が存在することを確認
ls -la .env.local

# 3. (BigQuery を使うスクリプトのみ) キャッシュをクリア
rm -f .cache/pricing/reserved-costs.json

# 4. スクリプトを実行
npx ts-node --project tsconfig.scripts.json scripts/<スクリプト名>.ts
```

### ログノイズを除去して出力を見やすくする

```bash
npx ts-node --project tsconfig.scripts.json scripts/verify-rds-ri-pricing.ts 2>&1 \
  | grep -v "^Fetching\|^Successfully\|^No \|^\[pricing"
```

---

## トラブルシューティング

| 症状 | 原因 | 対処 |
|---|---|---|
| `CC_GCP_SERVICE_ACCOUNT_B64 が未設定` エラー | `.env.local` が読み込まれていない | プロジェクトルートで実行しているか確認 |
| BigQuery の結果が古い / 変わらない | キャッシュが残っている | `rm -f .cache/pricing/reserved-costs.json` |
| `ThrottlingException` が発生する | AWS API のレート制限 | `.env.local` の `CC_AWS_API_CALL_DELAY` を大きくする (例: `2000`) |
| TypeScript コンパイルエラー | `tsconfig.scripts.json` が不一致 | `--project tsconfig.scripts.json` オプションを忘れずに指定する |
