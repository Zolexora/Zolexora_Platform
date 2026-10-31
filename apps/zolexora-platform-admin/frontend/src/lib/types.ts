export type SystemHealthStatus = 'ok' | 'degraded' | 'unhealthy';

export interface SystemHealthResponse {
  status: SystemHealthStatus;
  service: string;
  version: string;
  environment: string;
  timestamp: string;
}

export type DatabaseTargetStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unconfigured';

export interface DatabaseTargetHealth {
  target: string;
  status: DatabaseTargetStatus;
  latency_ms: number;
  details?: string | null;
  error?: string | null;
}

export interface DatabaseHealthReport {
  overall_status: 'healthy' | 'degraded' | 'unhealthy';
  targets: Record<string, DatabaseTargetHealth>;
  timestamp: string;
}

export type AccountStatus = 'ACTIVE' | 'DRAINING' | 'DISCONNECTED' | 'QUOTA_THROTTLED';
export type ProviderType = 'firebase' | 'cloudflare' | 'supabase' | 'mongodb' | 'resend' | 'brevo' | 'sendgrid';

export interface DiscoveredAccount {
  id: string;
  provider: ProviderType;
  alias: string;
  project_id_or_account_id: string;
  status: AccountStatus;
  monthly_quota_total?: number | null;
  monthly_quota_used?: number | null;
  daily_quota_total?: number | null;
  daily_quota_used?: number | null;
  quota_percentage: number;
  latency_ms?: number | null;
  last_synced_at: string;
}

export interface AccountDiagnosticAlert {
  event: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  provider: string;
  target_product: string;
  expected_secret: string;
  infisical_path: string;
  message: string;
  timestamp: string;
}

export interface AccountSyncResponse {
  status: 'success' | 'partial' | 'failed';
  discovered_count: number;
  active_count: number;
  throttled_count: number;
  disconnected_count: number;
  diagnostics: string[];
  timestamp: string;
}

export interface AccountsListResponse {
  accounts: DiscoveredAccount[];
  total_count: number;
  active_count: number;
  throttled_count: number;
  alerts: AccountDiagnosticAlert[];
}

export interface HotTableMetric {
  schema_name: string;
  table_name: string;
  row_count_estimate: number;
  total_bytes: number;
  total_size_pretty: string;
  read_activity_score?: number | null;
  is_pinned?: boolean;
}

export interface StorageQuotaMetric {
  service: string;
  project_or_cluster: string;
  free_tier_limit_bytes: number;
  used_bytes: number;
  used_pretty: string;
  usage_percentage: number;
  threshold_state: 'NORMAL' | 'WARNING' | 'CRITICAL' | 'UNCONFIGURED';
  is_configured?: boolean;
  infisical_path?: string | null;
  tables?: HotTableMetric[] | null;
}

export interface CapacityTelemetryResponse {
  databases: StorageQuotaMetric[];
  overall_threshold_alert: boolean;
  hot_tables: HotTableMetric[];
  timestamp: string;
}

export interface ArchivePreviewRequest {
  database: string;
  target_capacity_percent?: number;
}

export interface ArchivePreviewResponse {
  database: string;
  current_usage_bytes: number;
  target_usage_bytes: number;
  estimated_rows_to_archive: number;
  cutoff_date: string;
  pinned_tables_skipped: string[];
}

export interface ArchiveExclusionsResponse {
  pinned_tables: string[];
}

export type EmailProviderName = 'resend' | 'brevo' | 'sendgrid';

export interface ProviderQuotaMetric {
  provider: EmailProviderName;
  account_id: string;
  daily_limit: number;
  daily_used: number;
  remaining_today: number;
  usage_percentage: number;
  is_throttled: boolean;
}

export interface EmailQuotasResponse {
  providers: ProviderQuotaMetric[];
  timestamp: string;
}

export interface EmailLogRecord {
  id: string;
  message_id: string;
  provider: string;
  account: string;
  product: string;
  recipient: string;
  subject: string;
  status: 'queued' | 'sent' | 'delivered' | 'bounced' | 'failed';
  sent_at: string;
  bounce_reason?: string | null;
  opened?: boolean;
}

export interface EmailLogsResponse {
  logs: EmailLogRecord[];
  total: number;
  page: number;
  limit: number;
}

export interface EmailSendRequest {
  product: string;
  to: string[];
  subject: string;
  html_content?: string;
  text_content?: string;
  sender_name?: string;
  sender_email?: string;
  metadata?: Record<string, unknown>;
}

export interface EmailSendResponse {
  success: boolean;
  message_id: string;
  provider_used: EmailProviderName;
  account_used: string;
  status: 'queued' | 'sent' | 'failed';
  attempt_count: number;
  timestamp: string;
}

export interface FleetService {
  id: string;
  name: string;
  category: 'frontend' | 'backend' | 'database' | 'worker' | 'edge';
  environment: string;
  host: string;
  endpoint: string;
  status: 'operational' | 'degraded' | 'critical' | 'stopped' | 'unconfigured';
  latency_ms?: number | null;
  last_checked: string;
  details?: string | null;
}

export interface FleetResponse {
  services: FleetService[];
  total_count: number;
  operational_count: number;
  degraded_count: number;
  stopped_count: number;
  unconfigured_count: number;
  timestamp: string;
}
