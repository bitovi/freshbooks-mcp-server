import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FreshBooksClient } from '../freshbooks/client.js';

// FreshBooks invoice status codes
const STATUS_MAP: Record<string, number> = {
  draft: 1,
  sent: 2,
  viewed: 3,
  paid: 4,
  'auto-paid': 5,
  partial: 8,
};

function statusNameToCode(name: string): number | undefined {
  return STATUS_MAP[name.toLowerCase()];
}

export function registerInvoiceTools(server: McpServer, getClient: () => FreshBooksClient) {
  server.tool(
    'list_invoices',
    'List FreshBooks invoices with optional filters by client, status, or date range.',
    {
      page: z.number().int().positive().optional().describe('Page number (default: 1)'),
      per_page: z.number().int().positive().max(100).optional().describe('Results per page (default: 25)'),
      client_id: z.number().int().positive().optional().describe('Filter by client ID'),
      status: z
        .enum(['draft', 'sent', 'viewed', 'paid', 'auto-paid', 'partial'])
        .optional()
        .describe('Filter by invoice status'),
      date_from: z.string().optional().describe('Filter invoices created on or after this date (YYYY-MM-DD)'),
      date_to: z.string().optional().describe('Filter invoices created on or before this date (YYYY-MM-DD)'),
      invoice_number: z.string().optional().describe('Search by invoice number'),
    },
    async ({ page, per_page, client_id, status, date_from, date_to, invoice_number }) => {
      const result = await getClient().listInvoices({
        page,
        per_page,
        customerid: client_id,
        status: status ? statusNameToCode(status) : undefined,
        date_from,
        date_to,
        search: invoice_number,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.tool(
    'get_invoice',
    'Get a specific FreshBooks invoice by its ID, including all line items.',
    {
      invoice_id: z.number().int().positive().describe('The FreshBooks invoice ID'),
    },
    async ({ invoice_id }) => {
      const invoice = await getClient().getInvoice(invoice_id);
      return {
        content: [{ type: 'text', text: JSON.stringify(invoice, null, 2) }],
      };
    }
  );

  const lineSchema = z.object({
    name: z.string().describe('Line item name / service'),
    description: z.string().optional().describe('Line item description'),
    qty: z.number().positive().describe('Quantity'),
    unit_cost: z.object({
      amount: z.string().describe('Unit price as a string, e.g. "150.00"'),
      code: z.string().describe('Currency code, e.g. "USD"'),
    }),
    tax_name: z.string().optional().describe('Tax name (e.g. "HST")'),
    tax_amount: z.string().optional().describe('Tax percentage as string (e.g. "13")'),
  });

  server.tool(
    'create_invoice',
    'Create a new FreshBooks invoice for a client.',
    {
      client_id: z.number().int().positive().describe('The FreshBooks client ID to invoice'),
      create_date: z.string().optional().describe('Invoice date (YYYY-MM-DD). Defaults to today.'),
      due_date: z.string().optional().describe('Payment due date (YYYY-MM-DD)'),
      currency_code: z.string().length(3).optional().describe('Currency code (e.g. "USD"). Defaults to account currency.'),
      notes: z.string().optional().describe('Notes visible on the invoice'),
      terms: z.string().optional().describe('Payment terms text'),
      discount_value: z.string().optional().describe('Discount percentage as a string (e.g. "10" for 10%)'),
      lines: z.array(lineSchema).optional().describe('Line items to add to the invoice'),
    },
    async ({ client_id, create_date, due_date, currency_code, notes, terms, discount_value, lines }) => {
      const invoice = await getClient().createInvoice({
        customerid: client_id,
        create_date,
        due_date,
        currency_code,
        notes,
        terms,
        discount_value,
        lines: lines?.map((l) => ({
          name: l.name,
          description: l.description,
          qty: l.qty,
          unit_cost: l.unit_cost,
          type: 0,
          taxName1: l.tax_name,
          taxAmount1: l.tax_amount,
        })),
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(invoice, null, 2) }],
      };
    }
  );

  server.tool(
    'update_invoice',
    'Update an existing FreshBooks invoice (e.g. change due date, notes, or status).',
    {
      invoice_id: z.number().int().positive().describe('The FreshBooks invoice ID to update'),
      status: z
        .enum(['draft', 'sent', 'viewed', 'paid', 'auto-paid', 'partial'])
        .optional()
        .describe('New status for the invoice'),
      due_date: z.string().optional().describe('New due date (YYYY-MM-DD)'),
      notes: z.string().optional().describe('Updated notes'),
      terms: z.string().optional().describe('Updated terms'),
      discount_value: z.string().optional().describe('Discount percentage'),
    },
    async ({ invoice_id, status, ...rest }) => {
      const invoice = await getClient().updateInvoice(invoice_id, {
        status: status ? statusNameToCode(status) : undefined,
        ...rest,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(invoice, null, 2) }],
      };
    }
  );

  server.tool(
    'send_invoice',
    'Send a FreshBooks invoice to the client via email.',
    {
      invoice_id: z.number().int().positive().describe('The FreshBooks invoice ID to send'),
      email: z.string().email().optional().describe('Override recipient email (defaults to the client\'s email)'),
    },
    async ({ invoice_id, email }) => {
      await getClient().sendInvoice(invoice_id, email);
      return {
        content: [{ type: 'text', text: `Invoice ${invoice_id} has been sent.` }],
      };
    }
  );
}
