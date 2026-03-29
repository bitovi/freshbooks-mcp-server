import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FreshBooksClient } from '../freshbooks/client.js';

export function registerProjectTools(server: McpServer, getClient: () => FreshBooksClient) {
  server.tool(
    'list_projects',
    'List FreshBooks projects with optional filters.',
    {
      page: z.number().int().positive().optional().describe('Page number (default: 1)'),
      per_page: z.number().int().positive().max(100).optional().describe('Results per page (default: 25)'),
      client_id: z.number().int().positive().optional().describe('Filter projects by client ID'),
      active: z.boolean().optional().describe('Filter by active/inactive status'),
    },
    async ({ page, per_page, client_id, active }) => {
      const result = await getClient().listProjects({ page, per_page, client_id, active });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.tool(
    'get_project',
    'Get a specific FreshBooks project by its ID.',
    {
      project_id: z.number().int().positive().describe('The FreshBooks project ID'),
    },
    async ({ project_id }) => {
      const project = await getClient().getProject(project_id);
      return {
        content: [{ type: 'text', text: JSON.stringify(project, null, 2) }],
      };
    }
  );

  server.tool(
    'create_project',
    'Create a new FreshBooks project.',
    {
      title: z.string().describe('Project title'),
      description: z.string().optional().describe('Project description'),
      client_id: z.number().int().positive().optional().describe('Associate with a client ID'),
      due_date: z.string().optional().describe('Project due date (YYYY-MM-DD)'),
      project_type: z
        .enum(['fixed_price', 'hourly_rate'])
        .optional()
        .describe('Billing type for the project'),
      rate: z.string().optional().describe('Hourly rate as a string (e.g. "150.00") — used when project_type is hourly_rate'),
      fixed_price: z.string().optional().describe('Fixed price as a string (e.g. "5000.00") — used when project_type is fixed_price'),
      budget: z.number().optional().describe('Budget in hours'),
      billing_method: z
        .enum(['task_rate', 'project_rate', 'client_rate'])
        .optional()
        .describe('How time entries are billed'),
    },
    async (body) => {
      const project = await getClient().createProject({
        title: body.title,
        description: body.description,
        client_id: body.client_id,
        due_date: body.due_date,
        project_type: body.project_type,
        rate: body.rate,
        fixed_price: body.fixed_price,
        budget: body.budget !== undefined ? String(body.budget) : undefined,
        billing_method: body.billing_method,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(project, null, 2) }],
      };
    }
  );

  server.tool(
    'update_project',
    'Update an existing FreshBooks project.',
    {
      project_id: z.number().int().positive().describe('The FreshBooks project ID to update'),
      title: z.string().optional(),
      description: z.string().optional(),
      client_id: z.number().int().positive().optional(),
      due_date: z.string().optional().describe('Due date (YYYY-MM-DD)'),
      project_type: z.enum(['fixed_price', 'hourly_rate']).optional(),
      rate: z.string().optional(),
      fixed_price: z.string().optional(),
      budget: z.number().optional().describe('Budget in hours'),
      billing_method: z.enum(['task_rate', 'project_rate', 'client_rate']).optional(),
    },
    async ({ project_id, budget, ...rest }) => {
      const project = await getClient().updateProject(project_id, {
        ...rest,
        budget: budget !== undefined ? String(budget) : undefined,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(project, null, 2) }],
      };
    }
  );
}
