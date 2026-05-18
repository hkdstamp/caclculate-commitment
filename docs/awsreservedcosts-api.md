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

#### 実装上の補足（計算時の候補絞り込み）

- `sp-list` エンドポイント自体は、`service` と `location_name` を中心に広く候補を返却する。
- 一方、実際の見積計算と比較スクリプトでは、`lineitem_operation` と `lineitem_usagetype`（および `instanceType`）を使って候補を段階的に絞る。
- 絞り込み優先順は以下。
  - usage_type + operation 完全一致
  - usage_type 一致
  - instanceType 由来サフィックス + operation 一致
  - instanceType 由来サフィックス一致
  - operation 一致
  - 最後に全件フォールバック
- この処理により、対象行と無関係な最小SP単価が選ばれることを防ぐ。

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

---

## 価格データキャッシュ仕様

実装ファイル: `lib/awsreservedcosts-endpoint-client.ts`

### 概要

BigQuery への問い合わせコストと応答時間を削減するため、取得した価格データを以下の2段階でキャッシュします。

```
取得優先順:
  1. ファイルキャッシュ (JSON)   ← サーバー再起動をまたいで永続化
  2. メモリキャッシュ            ← プロセス存続中の高速アクセス
  3. BigQuery API リクエスト     ← キャッシュ未ヒット時のみ実行
```

### キャッシュファイルの保存場所

| ファイル | 内容 |
|---|---|
| `.cache/pricing/reserved-costs.json` | RI（Reserved Instance）価格データ |
| `.cache/pricing/savings-plans.json` | SP（Savings Plans）価格データ |

デフォルトはプロジェクトルートの `.cache/pricing/` 以下。`CC_PRICE_CACHE_DIR` で変更可能。  
`.cache/` は `.gitignore` に登録済みのためリポジトリには含まれません。

### 起動時の動作

1. モジュールロード時に上記２ファイルを読み込む
2. 有効期限（`CC_PRICE_CACHE_DURATION`）内のエントリのみメモリに展開する
3. 期限切れエントリはロード時に破棄される（ファイルは次回書き込みで更新）

### データ取得時の動作

```
fetchReservedCostsFromApi / fetchSavingsPlansFromApi 呼び出し
  │
  ├─ メモリキャッシュあり（期限内）→ そのまま返す
  │
  ├─ メモリキャッシュなし or 期限切れ
  │     └─ BigQuery API を呼び出す
  │           └─ 結果をメモリに保存
  │                 └─ デバウンスタイマーをセット（CC_PRICE_PERSIST_DEBOUNCE 後にファイル書き込み）
  │
  └─ 結果を返す
```

> **注意**: ファイルキャッシュはメモリに展開済みのため、「ファイルを直接参照する」パスは起動時のみです。  
> 実行中はメモリキャッシュが常にファイルキャッシュより新しい状態になります。

### デバウンス書き込み

API取得後すぐにファイルへ書き込むのではなく、`CC_PRICE_PERSIST_DEBOUNCE` ミリ秒後に書き込みます。  
短時間に複数キーが取得された場合はタイマーがリセットされ、まとめて1回の書き込みになります。

> 補足: 短命プロセス（単発スクリプト実行など）では、デバウンス書き込み前に終了して `.cache/pricing/savings-plans.json` が作成されないことがあります。

### 環境変数

| 変数名 | デフォルト | 説明 |
|---|---|---|
| `CC_PRICE_CACHE_DIR` | `<cwd>/.cache/pricing` | キャッシュJSONファイルの保存ディレクトリ |
| `CC_PRICE_CACHE_DURATION` | `86400`（秒） | キャッシュ有効期間。期限切れエントリは再取得される |
| `CC_PRICE_PERSIST_DEBOUNCE` | `10000`（ms） | API取得後にファイルへ書き込むまでの遅延（デバウンス） |

`.env.local` 設定例:

```dotenv
# キャッシュを /tmp に保存（例: コンテナ環境）
CC_PRICE_CACHE_DIR=/tmp/pricing-cache

# キャッシュを7日間有効にする
CC_PRICE_CACHE_DURATION=604800

# ファイル書き込みを即時に近い形で行う（開発用）
CC_PRICE_PERSIST_DEBOUNCE=1000
```

### キャッシュの手動削除

```bash
# すべての価格キャッシュを削除（次回リクエスト時に再取得される）
rm -rf .cache/pricing/
```
