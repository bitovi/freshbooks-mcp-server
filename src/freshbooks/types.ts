// ── Identity ──────────────────────────────────────────────────────────────────

export interface FreshBooksUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  business_memberships: BusinessMembership[];
  roles: Role[];
}

export interface BusinessMembership {
  id: number;
  role: string;
  business: {
    id: number;
    name: string;
    account_id: string;
    business_uuid: string;
    address?: {
      street: string;
      city: string;
      province: string;
      country: string;
      postal_code: string;
    };
  };
}

export interface Role {
  id: number;
  role: string;
  accountid: string;
  userid: number;
}

// ── Clients ───────────────────────────────────────────────────────────────────

export interface FreshBooksClientRecord {
  id: number;
  userid: number;
  fname: string;
  lname: string;
  email: string;
  organization: string;
  phone: string;
  mobile: string;
  fax: string;
  note: string;
  p_street: string;
  p_city: string;
  p_province: string;
  p_code: string;
  p_country: string;
  num_active_invoices: number;
  outstanding: { amount: string; code: string };
  last_invoice_date: string | null;
  vis_state: number; // 0 = active, 1 = deleted
}

export interface ClientListResponse {
  clients: FreshBooksClientRecord[];
  total: number;
  per_page: number;
  page: number;
  pages: number;
}

// ── Invoices ──────────────────────────────────────────────────────────────────

export interface InvoiceLine {
  lineid: number;
  name: string;
  description: string;
  qty: string;
  unit_cost: { amount: string; code: string };
  amount: { amount: string; code: string };
  type: number;
  taxName1?: string;
  taxAmount1?: string;
  taxName2?: string;
  taxAmount2?: string;
}

export interface FreshBooksInvoice {
  id: number;
  invoiceid: number;
  invoice_number: string;
  status: number; // 1=draft, 2=sent, 3=viewed, 4=paid, 5=auto-paid, 6=retry, 7=failed, 8=partial
  customerid: number;
  create_date: string;
  due_date: string | null;
  payment_details: string;
  discount_value: string;
  notes: string;
  terms: string;
  currency_code: string;
  language: string;
  amount: { amount: string; code: string };
  outstanding: { amount: string; code: string };
  paid: { amount: string; code: string };
  lines: InvoiceLine[];
  sent_date: string | null;
  autobill_status: string | null;
}

export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'paid' | 'partial' | 'overdue';

export interface InvoiceListResponse {
  invoices: FreshBooksInvoice[];
  total: number;
  per_page: number;
  page: number;
  pages: number;
}

// ── Expenses ──────────────────────────────────────────────────────────────────

export interface FreshBooksExpense {
  id: number;
  expenseid: number;
  staffid: number;
  categoryid: number;
  clientid: number;
  projectid: number | null;
  vendor: string;
  notes: string;
  date: string;
  amount: { amount: string; code: string };
  status: number; // 0=internal, 1=billable, 2=billed, 3=to_be_billed
  has_receipt: boolean;
  include_receipt: boolean;
  vis_state: number;
}

export interface ExpenseListResponse {
  expenses: FreshBooksExpense[];
  total: number;
  per_page: number;
  page: number;
  pages: number;
}

// ── Payments ──────────────────────────────────────────────────────────────────

export interface FreshBooksPayment {
  id: number;
  paymentid: number;
  invoiceid: number;
  amount: { amount: string; code: string };
  date: string;
  type: string; // 'Check', 'Credit', 'Cash', etc.
  note: string;
  vis_state: number;
}

export interface PaymentListResponse {
  payments: FreshBooksPayment[];
  total: number;
  per_page: number;
  page: number;
  pages: number;
}

// ── Projects ──────────────────────────────────────────────────────────────────

export interface FreshBooksProject {
  id: number;
  title: string;
  description: string | null;
  client_id: number | null;
  due_date: string | null;
  fixed_price: string | null;
  rate: string | null;
  budget: string | null;
  billing_method: string; // 'task_rate', 'project_rate', 'client_rate'
  project_type: string; // 'fixed_price', 'hourly_rate'
  billed_amount: string;
  billed_status: string;
  created_at: string;
  updated_at: string;
  active: boolean;
}

export interface ProjectListResponse {
  projects: FreshBooksProject[];
  total: number;
  per_page: number;
  page: number;
  pages: number;
}

// ── Time Entries ──────────────────────────────────────────────────────────────

export interface FreshBooksTimeEntry {
  id: number;
  identity_id: number;
  project_id: number;
  task_id: number | null;
  client_id: number | null;
  is_logged: boolean;
  duration: number; // seconds
  note: string | null;
  started_at: string; // ISO 8601
  created_at: string;
  updated_at: string;
  billable: boolean;
  billed: boolean;
  active: boolean;
}

export interface TimeEntryListResponse {
  time_entries: FreshBooksTimeEntry[];
  total: number;
  per_page: number;
  page: number;
  pages: number;
}

// ── Items ─────────────────────────────────────────────────────────────────────

export interface FreshBooksItem {
  id: number;
  itemid: number;
  name: string;
  description: string;
  qty: string;
  rate: { amount: string; code: string };
  tax1: string;
  tax2: string;
  vis_state: number;
}

export interface ItemListResponse {
  items: FreshBooksItem[];
  total: number;
  per_page: number;
  page: number;
  pages: number;
}

// ── Team Members ──────────────────────────────────────────────────────────────

export interface TeamMember {
  identity_id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}

// ── Stored token (for stdio mode) ─────────────────────────────────────────────

export interface StoredTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Unix ms
}
