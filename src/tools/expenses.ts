import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FreshBooksClient } from '../freshbooks/client.js';

export function registerExpenseTools(server: McpServer, getClient: () => FreshBooksClient) {
  server.tool(
    'list_expenses',
    'List FreshBooks expenses with optional filters by client, project, or date range.',
    {
      page: z.number().int().positive().optional().describe('Page number (default: 1)'),
      per_page: z.number().int().positive().max(100).optional().describe('Results per page (default: 25)'),
      client_id: z.number().int().positive().optional().describe('Filter by client ID'),
      project_id: z.number().int().positive().optional().describe('Filter by project ID'),
      category_id: z.number().int().positive().optional().describe('Filter by expense category ID'),
      date_from: z.string().optional().describe('Filter expenses on or after this date (YYYY-MM-DD)'),
      date_to: z.string().optional().describe('Filter expenses on or before this date (YYYY-MM-DD)'),
    },
    async ({ page, per_page, client_id, project_id, category_id, date_from, date_to }) => {
      const result = await getClient().listExpenses({
        page,
        per_page,
        clientid: client_id,
        projectid: project_id,
        categoryid: category_id,
        date_from,
        date_to,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.tool(
    'get_expense',
    'Get a specific FreshBooks expense by its ID.',
    {
      expense_id: z.number().int().positive().describe('The FreshBooks expense ID'),
    },
    async ({ expense_id }) => {
      const expense = await getClient().getExpense(expense_id);
      return {
        content: [{ type: 'text', text: JSON.stringify(expense, null, 2) }],
      };
    }
  );

  server.tool(
    'create_expense',
    'Create a new FreshBooks expense.',
    {
      category_id: z.number().int().positive().describe('Expense category ID'),
      amount: z.string().describe('Amount as a string (e.g. "49.99")'),
      currency_code: z.string().length(3).optional().describe('Currency code (e.g. "USD")'),
      date: z.string().optional().describe('Expense date (YYYY-MM-DD). Defaults to today.'),
      vendor: z.string().optional().describe('Vendor / merchant name'),
      notes: z.string().optional().describe('Notes about the expense'),
      client_id: z.number().int().positive().optional().describe('Associate with a client ID'),
      project_id: z.number().int().positive().optional().describe('Associate with a project ID'),
    },
    async ({ category_id, amount, currency_code, date, vendor, notes, client_id, project_id }) => {
      const expense = await getClient().createExpense({
        categoryid: category_id,
        amount: { amount, code: currency_code ?? 'USD' },
        date,
        vendor,
        notes,
        clientid: client_id,
        projectid: project_id,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(expense, null, 2) }],
      };
    }
  );

  server.tool(
    'update_expense',
    'Update an existing FreshBooks expense.',
    {
      expense_id: z.number().int().positive().describe('The FreshBooks expense ID to update'),
      amount: z.string().optional().describe('New amount as a string'),
      currency_code: z.string().length(3).optional().describe('Currency code'),
      date: z.string().optional().describe('New date (YYYY-MM-DD)'),
      vendor: z.string().optional().describe('Vendor name'),
      notes: z.string().optional().describe('Notes'),
      client_id: z.number().int().positive().optional().describe('Associate with a client ID'),
      project_id: z.number().int().positive().optional().describe('Associate with a project ID'),
      category_id: z.number().int().positive().optional().describe('Expense category ID'),
    },
    async ({ expense_id, amount, currency_code, client_id, project_id, category_id, ...rest }) => {
      const expense = await getClient().updateExpense(expense_id, {
        ...(amount ? { amount: { amount, code: currency_code ?? 'USD' } } : {}),
        clientid: client_id,
        projectid: project_id,
        categoryid: category_id,
        ...rest,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(expense, null, 2) }],
      };
    }
  );
}
