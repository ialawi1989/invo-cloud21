// ─── Employee ─────────────────────────────────────────────────────────────────
export interface Employee {
  id: string;

  // Name — backend may return any of these depending on the endpoint
  name?:         string;
  employeeName?: string;
  fullName?:     string;
  firstName?:    string;
  lastName?:     string;

  email: string;
  role?: string;
  avatar?: string;
  companyId?: string;
  branchId?: string;
  permissions?: Permission[];
  [key: string]: any;
}

/** Resolve the display name from whatever field the backend returns */
export function resolveEmployeeName(emp: Employee | null): string {
  if (!emp) return '';
  return (
    emp.name         ||
    emp.employeeName ||
    emp.fullName     ||
    [emp.firstName, emp.lastName].filter(Boolean).join(' ') ||
    emp.email?.split('@')[0] ||   // fallback: part before @
    ''
  );
}

/** Generate 1–2 letter initials from display name */
export function resolveInitials(emp: Employee | null): string {
  const name = resolveEmployeeName(emp);
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length === 1
    ? parts[0][0].toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─── Auth API shapes ──────────────────────────────────────────────────────────
export interface AuthResponse {
  success: boolean;
  msg?: string;
  data: {
    accessToken?: string;
    temporaryAccessToken?: string;
    employee?: Employee | Employee[];
    apply2fa?: boolean;
    sessionId?: string;
    tenant?: TenantConfig;
    [key: string]: any;
  };
}

// ─── Permissions (role-level) ─────────────────────────────────────────────────
export type Permission =
  | 'dashboard.view'
  | 'sales.view'
  | 'sales.invoices.view'  | 'sales.invoices.create' | 'sales.invoices.edit' | 'sales.invoices.delete'
  | 'sales.estimates.view' | 'sales.estimates.create'
  | 'products.view'        | 'products.create'        | 'products.edit'
  | 'customers.view'
  | 'reports.view'
  | 'settings.view'        | 'settings.users.manage'  | 'settings.billing.view'
  | 'builders.view'
  | string;

// ─── Features (tenant-level) ──────────────────────────────────────────────────
export type AppFeature =
  | 'dashboard'
  | 'sales.invoices' | 'sales.estimates' | 'sales.payments'
  | 'products'
  | 'customers'
  | 'reports'
  | 'website-builder'
  | 'settings.billing' | 'settings.integrations'
  | string;

// ─── Tenant config ────────────────────────────────────────────────────────────
export interface TenantConfig {
  tenantId: string;
  tenantName?: string;
  enabledFeatures: AppFeature[];
  plan?: 'starter' | 'pro' | 'enterprise';
}

// ─── Company ──────────────────────────────────────────────────────────────────
export interface Company {
  id: string;
  name: string;
  slug?: string;
  logo?: string;
  logoUrl?: string;
  country?: string;
  [key: string]: any;
}
