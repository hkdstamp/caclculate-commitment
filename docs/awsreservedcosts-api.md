# AWS Reserved Costs API仕様（Next.js / TypeScript）

このドキュメントは、旧Goモジュール `app/awsreservedcosts` の代替として実装した Next.js API の仕様を整理したものです。

## 概要

- 実装言語: TypeScript
- 実行基盤: Next.js App Router API Route
- BigQueryデータソース: `aws_pricing` dataset
- 実装ファイル:
  - `app/api/awsreservedcosts/route.ts`
  - `app/api/awsreservedcosts/sp-list/route.ts`
  - `lib/awsreservedcosts.ts`

## エンドポイント

### 1) Reserved Instance一覧

- Method: `GET`
- Path: `/api/awsreservedcosts`

#### Query Parameters

| パラメータ | 必須 | デフォルト | 説明 |
|---|---|---|---|
| `project` | 任意 | `mobingi-main` | BigQuery project ID |
| `dataset` | 任意 | `aws_pricing` | BigQuery dataset |
| `location` | 任意 | `asia-northeast1` | BigQuery job location |
| `service` | 任意 | 空（全サービス） | `ec2`, `rds`, `elasticache`, `redshift`, `es`（エイリアス対応） |
| `location_name` | 任意 | なし | 例: `Asia Pacific (Tokyo)` |
| `instance_type` | 任意 | なし | 例: `db.r5.4xlarge` |
| `operating_system` | 任意 | なし | OS/DB属性で絞り込み |
| `tenancy` | 任意 | なし | `Shared`, `Dedicated`, `Host` |
| `deployment_option` | 任意 | なし | RDSの配置オプション |

#### 正常レスポンス

- Status: `200`
- Body: `ReservedCost[]` (JSON)

```json
[
  {
    "service": "ec2",
    "table_name": "amazonec2",
    "usage_id": "BoxUsage:m5.large",
    "operation": "RunInstances",
    "instance_type": "m5.large",
    "location": "Asia Pacific (Tokyo)",
    "operating_system": "Linux",
    "pre_installed_sw": "",
    "deployment_option": "",
    "tenancy": "Shared",
    "lease_contract_length": "1yr",
    "offering_class": "convertible",
    "purchase_option": "All Upfront",
    "normalization_factor": 1,
    "hourly_cost": 0.123,
    "upfront_cost": 1076.88,
    "currency": "USD",
    "effective_date": "2026-03-01T00:00:00.000Z"
  }
]
```

#### 異常レスポンス

- `400`: 不正な `service`、不正な `project`/`dataset` 形式
- `500`: BigQuery実行エラーなどサーバー内部エラー

---

### 2) Savings Plans一覧

- Method: `GET`
- Path: `/api/awsreservedcosts/sp-list`

#### Query Parameters

| パラメータ | 必須 | デフォルト | 説明 |
|---|---|---|---|
| `project` | 任意 | `mobingi-main` | BigQuery project ID |
| `dataset` | 任意 | `aws_pricing` | BigQuery dataset |
| `location` | 任意 | `asia-northeast1` | BigQuery job location |
| `service` | 任意 | 空（全商品） | `ec2`, `rds`, `compute`, `database` など（LIKEマッチ） |
| `location_name` | 任意 | なし | 例: `Asia Pacific (Tokyo)` |

#### 正常レスポンス

- Status: `200`
- Body: `SavingsPlanCost[]` (JSON)

```json
[
  {
    "service": "compute",
    "product_family": "ComputeSavingsPlans",
    "usage_id": "BoxUsage:m5.large",
    "operation": "RunInstances",
    "location": "Asia Pacific (Tokyo)",
    "instance_family": "m5",
    "tenancy": "Shared",
    "operating_system": "Linux",
    "lease_contract_length": "1yr",
    "purchase_option": "All Upfront",
    "discounted_rate": 0.089,
    "currency": "USD",
    "effective_date": "2026-03-01T00:00:00.000Z"
  }
]
```

#### 異常レスポンス

- `400`: 不正な `project`/`dataset` 形式
- `500`: BigQuery実行エラーなどサーバー内部エラー

## 認証・実行前提

- Node.js runtime で動作（`runtime = 'nodejs'`）
- `@google-cloud/bigquery` を使用
- 実行環境で Google Cloud 認証情報が有効であること
  - 例: `GOOGLE_APPLICATION_CREDENTIALS` の設定
  - または `CC_GCP_SERVICE_ACCOUNT_B64` にサービスアカウントJSONをBase64で設定

### `CC_GCP_SERVICE_ACCOUNT_B64` の作成例

```bash
base64 -i mobingi-main-69325e565c16.json | tr -d '\n'
```

`.env.local` 設定例:

```dotenv
CC_GCP_SERVICE_ACCOUNT_B64=<base64文字列>
```

## 旧Goモジュールとの差分

- CLI (`awsreservedcosts list`, `sp-list`) ではなく HTTP API として提供
- 出力は常に JSON（整形オプションなし）
- バッチ実行前提なし（リクエストごとにクエリ実行）

## 動作確認コマンド例

```bash
curl "http://localhost:3000/api/awsreservedcosts"
curl "http://localhost:3000/api/awsreservedcosts?service=ec2"
curl "http://localhost:3000/api/awsreservedcosts/sp-list"
curl "http://localhost:3000/api/awsreservedcosts/sp-list?service=compute"
```

## 廃止予定フォルダ

- 旧実装: `app/awsreservedcosts`
- 本ドキュメント追加後は、上記フォルダを削除しても API 仕様参照は `docs/awsreservedcosts-api.md` で継続可能
