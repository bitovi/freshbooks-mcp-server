import axios, { type AxiosInstance } from 'axios';
import { config } from '../config.js';
import type {
  FreshBooksUser,
  ClientListResponse,
  FreshBooksClientRecord,
  InvoiceListResponse,
  FreshBooksInvoice,
  ExpenseListResponse,
  FreshBooksExpense,
  PaymentListResponse,
  FreshBooksPayment,
  ProjectListResponse,
  FreshBooksProject,
  TimeEntryListResponse,
  FreshBooksTimeEntry,
  ItemListResponse,
  FreshBooksItem,
  TeamMember,
  ServiceListResponse,
  FreshBooksService,
  FreshBooksServiceRate,
  FreshBooksProjectServiceRate,
} from './types.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildParams(obj: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== '') {
      out[k] = String(v);
    }
  }
  return out;
}

// ── FreshBooks API client ─────────────────────────────────────────────────────

export class FreshBooksClient {
  private http: AxiosInstance;
  accountId: string = '';
  businessId: number = 0;

  constructor(accessToken: string) {
    this.http = axios.create({
      baseURL: config.freshbooks.apiBase,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Api-Version': 'alpha',
        'Content-Type': 'application/json',
      },
    });
  }

  // ── Identity ────────────────────────────────────────────────────────────────

  async getCurrentUser(): Promise<FreshBooksUser> {
    const { data } = await this.http.get('/auth/api/v1/users/me');
    return data.response;
  }

  /** Resolve and cache account/business IDs from the current user. */
  async resolveIdentity(): Promise<void> {
    if (this.accountId) return;
    const user = await this.getCurrentUser();
    const membership = user.business_memberships?.[0];
    if (!membership) throw new Error('No business memberships found for this FreshBooks account.');
    this.businessId = membership.business.id;
    this.accountId = membership.business.account_id;
  }

  private async ensureIdentity() {
    if (!this.accountId) await this.resolveIdentity();
  }

  // ── Clients ─────────────────────────────────────────────────────────────────

  async listClients(opts: {
    page?: number;
    per_page?: number;
    search?: string;
    email?: string;
    vis_state?: 0 | 1;
  } = {}): Promise<ClientListResponse> {
    await this.ensureIdentity();
    const params = buildParams({
      page: opts.page ?? 1,
      per_page: opts.per_page ?? 25,
      'search[email]': opts.email,
      'search[name]': opts.search,
      vis_state: opts.vis_state ?? 0,
    });
    const { data } = await this.http.get(
      `/accounting/account/${this.accountId}/users/clients`,
      { params }
    );
    return data.response.result;
  }

  async getClient(clientId: number): Promise<FreshBooksClientRecord> {
    await this.ensureIdentity();
    const { data } = await this.http.get(
      `/accounting/account/${this.accountId}/users/clients/${clientId}`
    );
    return data.response.result.client;
  }

  async createClient(body: {
    fname?: string;
    lname?: string;
    email?: string;
    organization?: string;
    phone?: string;
    mobile?: string;
    p_street?: string;
    p_city?: string;
    p_province?: string;
    p_code?: string;
    p_country?: string;
    note?: string;
  }): Promise<FreshBooksClientRecord> {
    await this.ensureIdentity();
    const { data } = await this.http.post(
      `/accounting/account/${this.accountId}/users/clients`,
      { client: body }
    );
    return data.response.result.client;
  }

  async updateClient(clientId: number, body: {
    fname?: string;
    lname?: string;
    email?: string;
    organization?: string;
    phone?: string;
    mobile?: string;
    p_street?: string;
    p_city?: string;
    p_province?: string;
    p_code?: string;
    p_country?: string;
    note?: string;
  }): Promise<FreshBooksClientRecord> {
    await this.ensureIdentity();
    const { data } = await this.http.put(
      `/accounting/account/${this.accountId}/users/clients/${clientId}`,
      { client: body }
    );
    return data.response.result.client;
  }

  async deleteClient(clientId: number): Promise<void> {
    await this.ensureIdentity();
    await this.http.put(
      `/accounting/account/${this.accountId}/users/clients/${clientId}`,
      { client: { vis_state: 1 } }
    );
  }

  // ── Invoices ────────────────────────────────────────────────────────────────

  async listInvoices(opts: {
    page?: number;
    per_page?: number;
    customerid?: number;
    status?: number;
    date_from?: string;
    date_to?: string;
    search?: string;
  } = {}): Promise<InvoiceListResponse> {
    await this.ensureIdentity();
    const params = buildParams({
      page: opts.page ?? 1,
      per_page: opts.per_page ?? 25,
      'search[customerid]': opts.customerid,
      'search[status]': opts.status,
      'search[date_from]': opts.date_from,
      'search[date_to]': opts.date_to,
      'search[invoice_number]': opts.search,
    });
    const { data } = await this.http.get(
      `/accounting/account/${this.accountId}/invoices/invoices`,
      { params }
    );
    return data.response.result;
  }

  async getInvoice(invoiceId: number): Promise<FreshBooksInvoice> {
    await this.ensureIdentity();
    const { data } = await this.http.get(
      `/accounting/account/${this.accountId}/invoices/invoices/${invoiceId}`
    );
    return data.response.result.invoice;
  }

  async createInvoice(body: {
    customerid: number;
    create_date?: string;
    due_date?: string;
    notes?: string;
    terms?: string;
    currency_code?: string;
    discount_value?: string;
    lines?: Array<{
      name: string;
      description?: string;
      qty: number;
      unit_cost: { amount: string; code: string };
      type?: number;
      taxName1?: string;
      taxAmount1?: string;
    }>;
  }): Promise<FreshBooksInvoice> {
    await this.ensureIdentity();
    const { data } = await this.http.post(
      `/accounting/account/${this.accountId}/invoices/invoices`,
      { invoice: body }
    );
    return data.response.result.invoice;
  }

  async updateInvoice(invoiceId: number, body: Partial<{
    status: number;
    due_date: string;
    notes: string;
    terms: string;
    discount_value: string;
    lines: unknown[];
  }>): Promise<FreshBooksInvoice> {
    await this.ensureIdentity();
    const { data } = await this.http.put(
      `/accounting/account/${this.accountId}/invoices/invoices/${invoiceId}`,
      { invoice: body }
    );
    return data.response.result.invoice;
  }

  async sendInvoice(invoiceId: number, email?: string): Promise<void> {
    await this.ensureIdentity();
    const body: Record<string, unknown> = { invoice: { action_email: true } };
    if (email) body.email = { recipient: email };
    await this.http.put(
      `/accounting/account/${this.accountId}/invoices/invoices/${invoiceId}`,
      body
    );
  }

  // ── Expenses ────────────────────────────────────────────────────────────────

  async listExpenses(opts: {
    page?: number;
    per_page?: number;
    clientid?: number;
    projectid?: number;
    date_from?: string;
    date_to?: string;
    categoryid?: number;
  } = {}): Promise<ExpenseListResponse> {
    await this.ensureIdentity();
    const params = buildParams({
      page: opts.page ?? 1,
      per_page: opts.per_page ?? 25,
      'search[clientid]': opts.clientid,
      'search[projectid]': opts.projectid,
      'search[date_from]': opts.date_from,
      'search[date_to]': opts.date_to,
      'search[categoryid]': opts.categoryid,
    });
    const { data } = await this.http.get(
      `/accounting/account/${this.accountId}/expenses/expenses`,
      { params }
    );
    return data.response.result;
  }

  async getExpense(expenseId: number): Promise<FreshBooksExpense> {
    await this.ensureIdentity();
    const { data } = await this.http.get(
      `/accounting/account/${this.accountId}/expenses/expenses/${expenseId}`
    );
    return data.response.result.expense;
  }

  async createExpense(body: {
    categoryid: number;
    amount: { amount: string; code: string };
    date?: string;
    vendor?: string;
    notes?: string;
    clientid?: number;
    projectid?: number;
    staffid?: number;
  }): Promise<FreshBooksExpense> {
    await this.ensureIdentity();
    const { data } = await this.http.post(
      `/accounting/account/${this.accountId}/expenses/expenses`,
      { expense: body }
    );
    return data.response.result.expense;
  }

  async updateExpense(expenseId: number, body: {
    categoryid?: number;
    amount?: { amount: string; code: string };
    date?: string;
    vendor?: string;
    notes?: string;
    clientid?: number;
    projectid?: number;
    staffid?: number;
  }): Promise<FreshBooksExpense> {
    await this.ensureIdentity();
    const { data } = await this.http.put(
      `/accounting/account/${this.accountId}/expenses/expenses/${expenseId}`,
      { expense: body }
    );
    return data.response.result.expense;
  }

  // ── Payments ────────────────────────────────────────────────────────────────

  async listPayments(opts: {
    page?: number;
    per_page?: number;
    invoiceid?: number;
    date_from?: string;
    date_to?: string;
  } = {}): Promise<PaymentListResponse> {
    await this.ensureIdentity();
    const params = buildParams({
      page: opts.page ?? 1,
      per_page: opts.per_page ?? 25,
      'search[invoiceid]': opts.invoiceid,
      'search[date_from]': opts.date_from,
      'search[date_to]': opts.date_to,
    });
    const { data } = await this.http.get(
      `/accounting/account/${this.accountId}/payments/payments`,
      { params }
    );
    return data.response.result;
  }

  async getPayment(paymentId: number): Promise<FreshBooksPayment> {
    await this.ensureIdentity();
    const { data } = await this.http.get(
      `/accounting/account/${this.accountId}/payments/payments/${paymentId}`
    );
    return data.response.result.payment;
  }

  async createPayment(body: {
    invoiceid: number;
    amount: { amount: string; code: string };
    date?: string;
    type?: string;
    note?: string;
  }): Promise<FreshBooksPayment> {
    await this.ensureIdentity();
    const { data } = await this.http.post(
      `/accounting/account/${this.accountId}/payments/payments`,
      { payment: body }
    );
    return data.response.result.payment;
  }

  // ── Projects ─────────────────────────────────────────────────────────────────

  async listProjects(opts: {
    page?: number;
    per_page?: number;
    client_id?: number;
    active?: boolean;
  } = {}): Promise<ProjectListResponse> {
    await this.ensureIdentity();
    const params = buildParams({
      page: opts.page ?? 1,
      per_page: opts.per_page ?? 25,
      client_id: opts.client_id,
      active: opts.active !== undefined ? String(opts.active) : undefined,
    });
    const { data } = await this.http.get(
      `/projects/business/${this.businessId}/projects`,
      { params }
    );
    return data;
  }

  async getProject(projectId: number): Promise<FreshBooksProject> {
    await this.ensureIdentity();
    const { data } = await this.http.get(
      `/projects/business/${this.businessId}/projects/${projectId}`
    );
    return data.project;
  }

  async createProject(body: {
    title: string;
    description?: string;
    client_id?: number;
    due_date?: string;
    project_type?: 'fixed_price' | 'hourly_rate';
    rate?: string;
    fixed_price?: string;
    budget?: string;
    billing_method?: string;
  }): Promise<FreshBooksProject> {
    await this.ensureIdentity();
    const { data } = await this.http.post(
      `/projects/business/${this.businessId}/projects`,
      { project: body }
    );
    return data.project;
  }

  async updateProject(projectId: number, body: {
    title?: string;
    description?: string;
    client_id?: number;
    due_date?: string;
    project_type?: 'fixed_price' | 'hourly_rate';
    rate?: string;
    fixed_price?: string;
    budget?: string;
    billing_method?: string;
  }): Promise<FreshBooksProject> {
    await this.ensureIdentity();
    const { data } = await this.http.put(
      `/projects/business/${this.businessId}/projects/${projectId}`,
      { project: body }
    );
    return data.project;
  }

  // ── Time Entries ─────────────────────────────────────────────────────────────

  async listTimeEntries(opts: {
    page?: number;
    per_page?: number;
    project_id?: number;
    client_id?: number;
    identity_id?: number;
    started_from?: string;
    started_to?: string;
    billed?: boolean;
    billable?: boolean;
    include_team?: boolean;
  } = {}): Promise<TimeEntryListResponse> {
    await this.ensureIdentity();
    const params = buildParams({
      page: opts.page ?? 1,
      per_page: opts.per_page ?? 25,
      project_id: opts.project_id,
      client_id: opts.client_id,
      identity_id: opts.identity_id,
      started_from: opts.started_from,
      started_to: opts.started_to,
      billed: opts.billed !== undefined ? String(opts.billed) : undefined,
      billable: opts.billable !== undefined ? String(opts.billable) : undefined,
      team: opts.include_team ? 'true' : undefined,
    });
    const { data } = await this.http.get(
      `/timetracking/business/${this.businessId}/time_entries`,
      { params }
    );
    return data;
  }

  async listTeamMembers(): Promise<TeamMember[]> {
    await this.ensureIdentity();
    const { data } = await this.http.get(
      `/auth/api/v1/businesses/${this.businessId}/team_members`
    );
    return data.response;
  }

  async getTeamMember(identityId: number): Promise<TeamMember> {
    const members = await this.listTeamMembers();
    const member = members.find((m) => m.identity_id === identityId);
    if (!member) throw new Error(`Team member with identity_id ${identityId} not found.`);
    return member;
  }

  async getTimeEntry(timeEntryId: number): Promise<FreshBooksTimeEntry> {
    await this.ensureIdentity();
    const { data } = await this.http.get(
      `/timetracking/business/${this.businessId}/time_entries/${timeEntryId}`
    );
    return data.time_entry;
  }

  async createTimeEntry(body: {
    project_id: number;
    duration: number;
    started_at: string;
    note?: string;
    task_id?: number;
    is_logged?: boolean;
    billable?: boolean;
  }): Promise<FreshBooksTimeEntry> {
    await this.ensureIdentity();
    const { data } = await this.http.post(
      `/timetracking/business/${this.businessId}/time_entries`,
      { time_entry: body }
    );
    return data.time_entry;
  }

  async updateTimeEntry(timeEntryId: number, body: {
    project_id?: number;
    duration?: number;
    started_at?: string;
    note?: string;
    task_id?: number;
    is_logged?: boolean;
    billable?: boolean;
  }): Promise<FreshBooksTimeEntry> {
    await this.ensureIdentity();
    const { data } = await this.http.put(
      `/timetracking/business/${this.businessId}/time_entries/${timeEntryId}`,
      { time_entry: body }
    );
    return data.time_entry;
  }

  async deleteTimeEntry(timeEntryId: number): Promise<void> {
    await this.ensureIdentity();
    await this.http.delete(
      `/timetracking/business/${this.businessId}/time_entries/${timeEntryId}`
    );
  }

  // ── Items ────────────────────────────────────────────────────────────────────

  async listItems(opts: {
    page?: number;
    per_page?: number;
    search?: string;
  } = {}): Promise<ItemListResponse> {
    await this.ensureIdentity();
    const params = buildParams({
      page: opts.page ?? 1,
      per_page: opts.per_page ?? 25,
      'search[name]': opts.search,
    });
    const { data } = await this.http.get(
      `/accounting/account/${this.accountId}/items/items`,
      { params }
    );
    return data.response.result;
  }

  async getItem(itemId: number): Promise<FreshBooksItem> {
    await this.ensureIdentity();
    const { data } = await this.http.get(
      `/accounting/account/${this.accountId}/items/items/${itemId}`
    );
    return data.response.result.item;
  }

  // ── Services ─────────────────────────────────────────────────────────────────

  async listServices(opts: {
    page?: number;
    per_page?: number;
  } = {}): Promise<ServiceListResponse> {
    await this.ensureIdentity();
    const params = buildParams({
      page: opts.page ?? 1,
      per_page: opts.per_page ?? 25,
    });
    const { data } = await this.http.get(
      `/comments/business/${this.businessId}/services`,
      { params }
    );
    return data;
  }

  async getService(serviceId: number): Promise<FreshBooksService> {
    await this.ensureIdentity();
    const { data } = await this.http.get(
      `/comments/business/${this.businessId}/service/${serviceId}`
    );
    return data.service;
  }

  async getServiceRate(serviceId: number): Promise<FreshBooksServiceRate> {
    await this.ensureIdentity();
    const { data } = await this.http.get(
      `/comments/business/${this.businessId}/service/${serviceId}/rate`
    );
    return data.service_rate;
  }

  async listProjectServiceRates(projectId: number): Promise<FreshBooksProjectServiceRate[]> {
    await this.ensureIdentity();
    const { data } = await this.http.get(
      `/comments/business/${this.businessId}/project/${projectId}/service_rates`
    );
    return data.project_service_rates;
  }
}
