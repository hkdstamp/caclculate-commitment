import { BigQuery } from '@google-cloud/bigquery';

export interface ListInput {
  project?: string;
  dataset?: string;
  location?: string;
  service?: string;
  locationName?: string;
  instanceType?: string;
  operatingSystem?: string;
  tenancy?: string;
  deploymentOption?: string;
}

export interface ReservedCost {
  service: string;
  table_name: string;
  usage_id: string;
  operation: string;
  instance_type: string;
  location: string;
  operating_system: string;
  pre_installed_sw: string;
  deployment_option: string;
  tenancy: string;
  lease_contract_length: string;
  offering_class: string;
  purchase_option: string;
  normalization_factor: number;
  hourly_cost: number;
  upfront_cost: number;
  currency: string;
  effective_date: string;
}

export interface SavingsPlanCost {
  service: string;
  product_family: string;
  usage_id: string;
  operation: string;
  location: string;
  instance_family: string;
  tenancy: string;
  operating_system: string;
  lease_contract_length: string;
  purchase_option: string;
  discounted_rate: number;
  currency: string;
  effective_date: string;
}

interface ServiceSpec {
  name: string;
  table: string;
  serviceCode: string;
  filter: string;
  usageExpr: string;
  instanceTypeExpr: string;
  osDbExpr: string;
  preInstalledExpr: string;
  deploymentOptionExpr: string;
  tenancyExpr: string;
  normalizationExpr: string;
}

interface ServiceAccountCredential {
  project_id?: string;
  client_email?: string;
  private_key?: string;
}

const DEFAULT_PROJECT = 'mobingi-main';
const DEFAULT_DATASET = 'aws_pricing';
const DEFAULT_LOCATION = 'asia-northeast1';

function sanitizeIdentifier(value: string, fieldName: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error(`invalid ${fieldName}`);
  }
  return value;
}

function getNormalizedInput(input: ListInput) {
  const project = sanitizeIdentifier(input.project ?? DEFAULT_PROJECT, 'project');
  const dataset = sanitizeIdentifier(input.dataset ?? DEFAULT_DATASET, 'dataset');
  const location = input.location?.trim() || DEFAULT_LOCATION;
  const service = input.service?.trim() || '';
  return { project, dataset, location, service };
}

function getServiceSpecs(filter: string): ServiceSpec[] {
  const specs: ServiceSpec[] = [
    {
      name: 'ec2',
      table: 'amazonec2',
      serviceCode: 'AmazonEC2',
      filter: "STRPOS(operation, 'RunInstances') > 0 AND STRPOS(usagetype, 'Usage') > 0",
      usageExpr: String.raw`REGEXP_REPLACE(usagetype, r'\.([^\.]*)$', '')`,
      instanceTypeExpr: "COALESCE(instance_type, '')",
      osDbExpr: "COALESCE(operating_system, '')",
      preInstalledExpr: "IF(pre_installed_sw = 'NA', '', COALESCE(pre_installed_sw, ''))",
      deploymentOptionExpr: "''",
      tenancyExpr: "COALESCE(tenancy, '')",
      normalizationExpr: 'normalization_size_factor',
    },
    {
      name: 'rds',
      table: 'amazonrds',
      serviceCode: 'AmazonRDS',
      filter: "STRPOS(operation, 'CreateDBInstance') > 0 AND STRPOS(usagetype, 'Usage') > 0",
      usageExpr: String.raw`IF((normalization_size_factor IS NULL) OR normalization_size_factor = 'NA', usagetype, REGEXP_REPLACE(usagetype, r'\.([^\.]*)$', ''))`,
      instanceTypeExpr: "COALESCE(instance_type, '')",
      osDbExpr: String.raw`TRIM(IF(ARRAY_LENGTH(SPLIT(pricedescription, "running")) = 2, SPLIT(pricedescription, "running")[OFFSET(1)], CONCAT(COALESCE(database_engine, ''), IF(database_edition IS NULL, '', CONCAT(' ', database_edition)))))`,
      preInstalledExpr: "''",
      deploymentOptionExpr: "COALESCE(deployment_option, '')",
      tenancyExpr: "''",
      normalizationExpr: 'normalization_size_factor',
    },
    {
      name: 'elasticache',
      table: 'amazonelasticache',
      serviceCode: 'AmazonElastiCache',
      filter: "STRPOS(usagetype, 'Node') > 0",
      usageExpr: 'usagetype',
      instanceTypeExpr: "COALESCE(instance_type, '')",
      osDbExpr: "COALESCE(cache_engine, '')",
      preInstalledExpr: "''",
      deploymentOptionExpr: "''",
      tenancyExpr: "''",
      normalizationExpr: '1.0',
    },
    {
      name: 'redshift',
      table: 'amazonredshift',
      serviceCode: 'AmazonRedshift',
      filter: "STRPOS(usagetype, 'Node') > 0",
      usageExpr: 'usagetype',
      instanceTypeExpr: "COALESCE(instance_type, '')",
      osDbExpr: "''",
      preInstalledExpr: "''",
      deploymentOptionExpr: "''",
      tenancyExpr: "''",
      normalizationExpr: '1.0',
    },
    {
      name: 'es',
      table: 'amazones',
      serviceCode: 'AmazonES',
      filter: "STRPOS(usagetype, 'ESInstance') > 0",
      usageExpr: 'usagetype',
      instanceTypeExpr: "COALESCE(instance_type, '')",
      osDbExpr: "''",
      preInstalledExpr: "''",
      deploymentOptionExpr: "''",
      tenancyExpr: "''",
      normalizationExpr: '1.0',
    },
  ];

  if (!filter.trim()) {
    return specs;
  }

  const aliases: Record<string, string> = {
    ec2: 'ec2',
    amazonec2: 'ec2',
    rds: 'rds',
    amazonrds: 'rds',
    elasticache: 'elasticache',
    amazonelasticache: 'elasticache',
    redshift: 'redshift',
    amazonredshift: 'redshift',
    es: 'es',
    amazones: 'es',
    opensearch: 'es',
  };

  const mapped = aliases[filter.trim().toLowerCase()];
  if (!mapped) {
    throw new Error(`unsupported service "${filter}" (supported: ec2, rds, elasticache, redshift, es)`);
  }

  const selected = specs.find((spec) => spec.name === mapped);
  if (!selected) {
    throw new Error(`service spec "${filter}" not found`);
  }
  return [selected];
}

function buildReservedPricingQuery(project: string, dataset: string, spec: ServiceSpec): string {
  const table = `\`${project}.${dataset}.${spec.table}\``;
  return `
WITH pricing_base AS (
  SELECT
    '${spec.name}' AS service,
    '${spec.table}' AS table_name,
    ${spec.usageExpr} AS usage_id,
    operation,
    ${spec.instanceTypeExpr} AS instance_type,
    COALESCE(location, '') AS location,
    ${spec.osDbExpr} AS os_db,
    ${spec.preInstalledExpr} AS pre_installed_sw,
    ${spec.deploymentOptionExpr} AS deployment_option,
    ${spec.tenancyExpr} AS tenancy,
    COALESCE(leasecontractlength, '') AS lease_contract_length,
    COALESCE(offeringclass, '') AS offering_class,
    COALESCE(purchaseoption, '') AS purchase_option,
    COALESCE(SAFE_CAST(${spec.normalizationExpr} AS FLOAT64), 1.0) AS normalization_factor,
    CAST(priceperunit AS FLOAT64) AS price_per_unit,
    COALESCE(currency, '') AS currency,
    unit,
    SAFE_CAST(effectivedate AS TIMESTAMP) AS effective_date
  FROM ${table}
  WHERE
    termtype = 'Reserved'
    AND servicecode = '${spec.serviceCode}'
    AND ${spec.filter}
), reserved_pricing AS (
  SELECT
    *,
    ROW_NUMBER() OVER (
      PARTITION BY
        usage_id,
        operation,
        instance_type,
        location,
        os_db,
        pre_installed_sw,
        deployment_option,
        tenancy,
        lease_contract_length,
        offering_class,
        purchase_option,
        unit
      ORDER BY
        effective_date DESC
    ) AS rn
  FROM pricing_base
), latest_hourly AS (
  SELECT *
  FROM reserved_pricing
  WHERE unit IN ('Hrs', 'Hours') AND rn = 1
), latest_upfront AS (
  SELECT *
  FROM reserved_pricing
  WHERE unit = 'Quantity' AND rn = 1
)
SELECT
  h.service,
  h.table_name,
  h.usage_id,
  h.operation,
  h.instance_type,
  h.location,
  h.os_db,
  h.pre_installed_sw,
  h.deployment_option,
  h.tenancy,
  h.lease_contract_length,
  h.offering_class,
  h.purchase_option,
  h.normalization_factor,
  h.price_per_unit AS hourly_cost,
  COALESCE(u.price_per_unit, 0.0) AS upfront_cost,
  h.currency,
  h.effective_date
FROM latest_hourly AS h
LEFT JOIN latest_upfront AS u
  ON h.usage_id = u.usage_id
  AND h.operation = u.operation
  AND h.instance_type = u.instance_type
  AND h.location = u.location
  AND h.os_db = u.os_db
  AND h.pre_installed_sw = u.pre_installed_sw
  AND h.deployment_option = u.deployment_option
  AND h.tenancy = u.tenancy
  AND h.lease_contract_length = u.lease_contract_length
  AND h.offering_class = u.offering_class
  AND h.purchase_option = u.purchase_option
ORDER BY
  h.location,
  h.instance_type,
  h.usage_id,
  h.operation,
  h.lease_contract_length,
  h.offering_class,
  h.purchase_option
`;
}

function escapeSqlString(value: string): string {
  return value.replaceAll("'", "''");
}

function buildReservedWhereFilter(input: ListInput): string {
  const clauses: string[] = [];

  if (input.locationName?.trim()) {
    clauses.push(`h.location = '${escapeSqlString(input.locationName.trim())}'`);
  }

  if (input.instanceType?.trim()) {
    clauses.push(`h.instance_type = '${escapeSqlString(input.instanceType.trim())}'`);
  }

  if (input.operatingSystem?.trim()) {
    clauses.push(`h.os_db = '${escapeSqlString(input.operatingSystem.trim())}'`);
  }

  if (input.tenancy?.trim()) {
    clauses.push(`h.tenancy = '${escapeSqlString(input.tenancy.trim())}'`);
  }

  if (input.deploymentOption?.trim()) {
    clauses.push(`h.deployment_option = '${escapeSqlString(input.deploymentOption.trim())}'`);
  }

  if (clauses.length === 0) {
    return '';
  }

  return `\nWHERE ${clauses.join(' AND ')}`;
}

function buildSavingsPlansPricingQuery(project: string, dataset: string, service: string): string {
  let serviceFilter = '';
  if (service) {
    const escaped = service.toLowerCase().trim().replaceAll("'", "''");
    serviceFilter = `AND LOWER(t.discountedservicecode) LIKE '%${escaped}%'`;
  }

  const table = `\`${project}.${dataset}.sp_*\``;
  return `
WITH sp_base AS (
  SELECT
    CASE
      WHEN LOWER(t.discountedservicecode) LIKE '%amazonec2%' THEN 'ec2'
      WHEN LOWER(t.discountedservicecode) LIKE '%amazonrds%' THEN 'rds'
      WHEN LOWER(t.discountedservicecode) LIKE '%awscompute%' THEN 'compute'
      WHEN LOWER(t.discountedservicecode) LIKE '%awsdatabase%' THEN 'database'
      ELSE 'other'
    END AS service,
    t.product_family,
    t.discountedusagetype AS usage_id,
    t.discountedoperation AS operation,
    COALESCE(t.location, '') AS location,
    COALESCE(JSON_VALUE(TO_JSON_STRING(t), '$.instance_family'), '') AS instance_family,
    COALESCE(JSON_VALUE(TO_JSON_STRING(t), '$.tenancy'), '') AS tenancy,
    COALESCE(JSON_VALUE(TO_JSON_STRING(t), '$.operating_system'), '') AS operating_system,
    COALESCE(t.leasecontractlength, '') AS lease_contract_length,
    COALESCE(t.purchaseoption, '') AS purchase_option,
    CAST(t.discountedrate AS FLOAT64) AS discounted_rate,
    COALESCE(t.currency, '') AS currency,
    t.unit,
    SAFE_CAST(t.effectivedate AS TIMESTAMP) AS effective_date
  FROM ${table} AS t
  WHERE
    t.unit IN ('Hrs', 'Hours')
    AND COALESCE(t.product_family, '') != 'EC2InstanceSavingsPlans'
    ${serviceFilter}
), sp_pricing AS (
  SELECT
    *,
    ROW_NUMBER() OVER (
      PARTITION BY
        service,
        usage_id,
        operation,
        location,
        instance_family,
        tenancy,
        operating_system,
        lease_contract_length,
        purchase_option
      ORDER BY
        effective_date DESC
    ) AS rn
  FROM sp_base
)
SELECT
  service,
  product_family,
  usage_id,
  operation,
  location,
  instance_family,
  tenancy,
  operating_system,
  lease_contract_length,
  purchase_option,
  discounted_rate,
  currency,
  effective_date
FROM sp_pricing
WHERE rn = 1
ORDER BY
  service,
  location,
  product_family,
  usage_id,
  operation,
  lease_contract_length,
  purchase_option
`;
}

function buildSavingsPlansWhereFilter(input: ListInput): string {
  if (!input.locationName?.trim()) {
    return '';
  }
  return `\nAND COALESCE(t.location, '') = '${escapeSqlString(input.locationName.trim())}'`;
}

function toIsoDateTime(value: unknown): string {
  if (!value) {
    return '';
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.toISOString === 'function') {
      return (record.toISOString as () => string)();
    }
    if ('value' in record) {
      return toIsoDateTime(record.value);
    }
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }
  return parsed.toISOString();
}

function toNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function mapReservedRow(row: Record<string, unknown>): ReservedCost {
  return {
    service: String(row.service ?? ''),
    table_name: String(row.table_name ?? ''),
    usage_id: String(row.usage_id ?? ''),
    operation: String(row.operation ?? ''),
    instance_type: String(row.instance_type ?? ''),
    location: String(row.location ?? ''),
    operating_system: String(row.os_db ?? ''),
    pre_installed_sw: String(row.pre_installed_sw ?? ''),
    deployment_option: String(row.deployment_option ?? ''),
    tenancy: String(row.tenancy ?? ''),
    lease_contract_length: String(row.lease_contract_length ?? ''),
    offering_class: String(row.offering_class ?? ''),
    purchase_option: String(row.purchase_option ?? ''),
    normalization_factor: toNumber(row.normalization_factor),
    hourly_cost: toNumber(row.hourly_cost),
    upfront_cost: toNumber(row.upfront_cost),
    currency: String(row.currency ?? ''),
    effective_date: toIsoDateTime(row.effective_date),
  };
}

function mapSavingsPlanRow(row: Record<string, unknown>): SavingsPlanCost {
  return {
    service: String(row.service ?? ''),
    product_family: String(row.product_family ?? ''),
    usage_id: String(row.usage_id ?? ''),
    operation: String(row.operation ?? ''),
    location: String(row.location ?? ''),
    instance_family: String(row.instance_family ?? ''),
    tenancy: String(row.tenancy ?? ''),
    operating_system: String(row.operating_system ?? ''),
    lease_contract_length: String(row.lease_contract_length ?? ''),
    purchase_option: String(row.purchase_option ?? ''),
    discounted_rate: toNumber(row.discounted_rate),
    currency: String(row.currency ?? ''),
    effective_date: toIsoDateTime(row.effective_date),
  };
}

function getServiceAccountFromEnv(): ServiceAccountCredential | null {
  const encoded = process.env.CC_GCP_SERVICE_ACCOUNT_B64?.trim();
  if (!encoded) {
    return null;
  }

  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded) as ServiceAccountCredential;
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error('missing client_email or private_key');
    }
    return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown decode error';
    throw new Error(`invalid CC_GCP_SERVICE_ACCOUNT_B64: ${message}`);
  }
}

function createClient(projectId: string): BigQuery {
  const serviceAccount = getServiceAccountFromEnv();
  if (!serviceAccount) {
    return new BigQuery({ projectId });
  }

  return new BigQuery({
    projectId,
    credentials: {
      client_email: serviceAccount.client_email,
      private_key: serviceAccount.private_key,
    },
  });
}

export async function listReservedCosts(input: ListInput): Promise<ReservedCost[]> {
  const normalized = getNormalizedInput(input);
  const specs = getServiceSpecs(normalized.service);
  const client = createClient(normalized.project);
  const whereFilter = buildReservedWhereFilter(input);

  const rows: ReservedCost[] = [];
  for (const spec of specs) {
    const baseQuery = buildReservedPricingQuery(normalized.project, normalized.dataset, spec);
    const query = whereFilter
      ? `${baseQuery.slice(0, baseQuery.lastIndexOf('\nORDER BY'))}${whereFilter}${baseQuery.slice(baseQuery.lastIndexOf('\nORDER BY'))}`
      : baseQuery;
    const [result] = await client.query({ query, location: normalized.location });
    for (const row of result as Record<string, unknown>[]) {
      rows.push(mapReservedRow(row));
    }
  }

  rows.sort((a, b) => {
    if (a.service !== b.service) return a.service.localeCompare(b.service);
    if (a.location !== b.location) return a.location.localeCompare(b.location);
    if (a.instance_type !== b.instance_type) return a.instance_type.localeCompare(b.instance_type);
    if (a.usage_id !== b.usage_id) return a.usage_id.localeCompare(b.usage_id);
    if (a.operation !== b.operation) return a.operation.localeCompare(b.operation);
    if (a.lease_contract_length !== b.lease_contract_length) return a.lease_contract_length.localeCompare(b.lease_contract_length);
    if (a.offering_class !== b.offering_class) return a.offering_class.localeCompare(b.offering_class);
    return a.purchase_option.localeCompare(b.purchase_option);
  });

  return rows;
}

export async function listSavingsPlansCosts(input: ListInput): Promise<SavingsPlanCost[]> {
  const normalized = getNormalizedInput(input);
  const client = createClient(normalized.project);
  const baseQuery = buildSavingsPlansPricingQuery(normalized.project, normalized.dataset, normalized.service);
  const locationFilter = buildSavingsPlansWhereFilter(input);
  const query = locationFilter
    ? baseQuery.replace('WHERE\n    t.unit IN (\'Hrs\', \'Hours\')', `WHERE\n    t.unit IN (\'Hrs\', \'Hours\')${locationFilter}`)
    : baseQuery;
  const [result] = await client.query({ query, location: normalized.location });

  const rows = (result as Record<string, unknown>[]).map(mapSavingsPlanRow);
  rows.sort((a, b) => {
    if (a.service !== b.service) return a.service.localeCompare(b.service);
    if (a.location !== b.location) return a.location.localeCompare(b.location);
    if (a.product_family !== b.product_family) return a.product_family.localeCompare(b.product_family);
    if (a.usage_id !== b.usage_id) return a.usage_id.localeCompare(b.usage_id);
    if (a.operation !== b.operation) return a.operation.localeCompare(b.operation);
    if (a.lease_contract_length !== b.lease_contract_length) return a.lease_contract_length.localeCompare(b.lease_contract_length);
    return a.purchase_option.localeCompare(b.purchase_option);
  });
  return rows;
}
