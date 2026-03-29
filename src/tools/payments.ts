import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FreshBooksClient } from '../freshbooks/client.js';

export function registerPaymentTools(server: McpServer, getClient: () => FreshBooksClient) {
  server.tool(
    'list_payments',
    'List FreshBooks payments with optional filters.',
    {
      page: z.number().int().positive().optional().describe('Page number (default: 1)'),
      per_page: z.number().int().positive().max(100).optional().describe('Results per page (default: 25)'),
      invoice_id: z.number().int().positive().optional().describe('Filter payments by invoice ID'),
      date_from: z.string().optional().describe('Filter payments on or after this date (YYYY-MM-DD)'),
      date_to: z.string().optional().describe('Filter payments on or before this date (YYYY-MM-DD)'),
    },
    async ({ page, per_page, invoice_id, date_from, date_to }) => {
      const result = await getClient().listPayments({
        page,
        per_page,
        invoiceid: invoice_id,
        date_from,
        date_to,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.tool(
    'get_payment',
    'Get a specific FreshBooks payment by its ID.',
    {
      payment_id: z.number().int().positive().describe('The FreshBooks payment ID'),
    },
    async ({ payment_id }) => {
      const payment = await getClient().getPayment(payment_id);
      return {
        content: [{ type: 'text', text: JSON.stringify(payment, null, 2) }],
      };
    }
  );

  server.tool(
    'create_payment',
    'Record a payment against a FreshBooks invoice.',
    {
      invoice_id: z.number().int().positive().describe('The invoice ID to apply this payment to'),
      amount: z.string().describe('Payment amount as a string (e.g. "500.00")'),
      currency_code: z.string().length(3).optional().describe('Currency code (e.g. "USD")'),
      date: z.string().optional().describe('Payment date (YYYY-MM-DD). Defaults to today.'),
      type: z
        .enum(['Check', 'Credit', 'Cash', 'PayPal', 'Square', 'Stripe', 'Bank Transfer', 'Other'])
        .optional()
        .describe('Payment type'),
      note: z.string().optional().describe('Note about this payment'),
    },
    async ({ invoice_id, amount, currency_code, date, type, note }) => {
      const payment = await getClient().createPayment({
        invoiceid: invoice_id,
        amount: { amount, code: currency_code ?? 'USD' },
        date,
        type,
        note,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(payment, null, 2) }],
      };
    }
  );
}
