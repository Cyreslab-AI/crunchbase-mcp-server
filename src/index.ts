#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { CrunchbaseAPI } from './crunchbase-api.js';
import {
  SearchCompaniesInput,
  GetCompanyDetailsInput,
  GetFundingRoundsInput,
  GetAcquisitionsInput,
  SearchPeopleInput
} from './types.js';

// Get API key from environment variable
const API_KEY = process.env.CRUNCHBASE_API_KEY;
if (!API_KEY) {
  throw new Error('CRUNCHBASE_API_KEY environment variable is required');
}
// At this point, API_KEY is guaranteed to be a string
const apiKey: string = API_KEY;

class CrunchbaseMcpServer {
  private server: Server;
  private crunchbaseApi: CrunchbaseAPI;

  constructor() {
    this.server = new Server(
      {
        name: 'crunchbase-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    this.crunchbaseApi = new CrunchbaseAPI(apiKey);

    this.setupResourceHandlers();
    this.setupToolHandlers();

    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupResourceHandlers() {
    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: 'crunchbase://trending/companies',
          name: 'Trending Companies',
          mimeType: 'application/json',
          description: 'List of trending companies on Crunchbase',
        },
      ],
    }));

    // List resource templates
    this.server.setRequestHandler(
      ListResourceTemplatesRequestSchema,
      async () => ({
        resourceTemplates: [
          {
            uriTemplate: 'crunchbase://companies/{name}',
            name: 'Company Details',
            mimeType: 'application/json',
            description: 'Detailed information about a specific company',
          },
          {
            uriTemplate: 'crunchbase://companies/{name}/funding',
            name: 'Company Funding Rounds',
            mimeType: 'application/json',
            description: 'Funding rounds for a specific company',
          },
          {
            uriTemplate: 'crunchbase://companies/{name}/acquisitions',
            name: 'Company Acquisitions',
            mimeType: 'application/json',
            description: 'Acquisitions made by or of a specific company',
          },
        ],
      })
    );

    // Handle resource requests
    this.server.setRequestHandler(
      ReadResourceRequestSchema,
      async (request) => {
        try {
          const uri = request.params.uri;

          // Handle trending companies resource
          if (uri === 'crunchbase://trending/companies') {
            const companies = await this.crunchbaseApi.searchCompanies({ limit: 10 });
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(companies, null, 2),
                },
              ],
            };
          }

          // Handle company details resource template
          const companyMatch = uri.match(/^crunchbase:\/\/companies\/([^/]+)$/);
          if (companyMatch) {
            const companyName = decodeURIComponent(companyMatch[1]);
            const company = await this.crunchbaseApi.getCompanyDetails({ name_or_id: companyName });
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(company, null, 2),
                },
              ],
            };
          }

          // Handle company funding rounds resource template
          const fundingMatch = uri.match(/^crunchbase:\/\/companies\/([^/]+)\/funding$/);
          if (fundingMatch) {
            const companyName = decodeURIComponent(fundingMatch[1]);
            const fundingRounds = await this.crunchbaseApi.getFundingRounds({ company_name_or_id: companyName });
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(fundingRounds, null, 2),
                },
              ],
            };
          }

          // Handle company acquisitions resource template
          const acquisitionsMatch = uri.match(/^crunchbase:\/\/companies\/([^/]+)\/acquisitions$/);
          if (acquisitionsMatch) {
            const companyName = decodeURIComponent(acquisitionsMatch[1]);
            const acquisitions = await this.crunchbaseApi.getAcquisitions({ company_name_or_id: companyName });
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(acquisitions, null, 2),
                },
              ],
            };
          }

          throw new McpError(
            ErrorCode.InvalidRequest,
            `Invalid URI: ${uri}`
          );
        } catch (error) {
          console.error('Error handling resource request:', error);
          if (error instanceof McpError) {
            throw error;
          }
          throw new McpError(
            ErrorCode.InternalError,
            error instanceof Error ? error.message : 'Unknown error'
          );
        }
      }
    );
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'search_companies',
          description: 'Search for companies based on various criteria',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query (e.g., company name, description)',
              },
              location: {
                type: 'string',
                description: 'Filter by location (e.g., "San Francisco", "New York")',
              },
              category: {
                type: 'string',
                description: 'Filter by category (e.g., "Artificial Intelligence", "Fintech")',
              },
              founded_after: {
                type: 'string',
                description: 'Filter by founding date (YYYY-MM-DD)',
              },
              founded_before: {
                type: 'string',
                description: 'Filter by founding date (YYYY-MM-DD)',
              },
              status: {
                type: 'string',
                description: 'Filter by company status (e.g., "active", "closed")',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results to return (default: 10)',
              },
            },
          },
        },
        {
          name: 'get_company_details',
          description: 'Get detailed information about a specific company',
          inputSchema: {
            type: 'object',
            properties: {
              name_or_id: {
                type: 'string',
                description: 'Company name or UUID',
              },
            },
            required: ['name_or_id'],
          },
        },
        {
          name: 'get_funding_rounds',
          description: 'Get funding rounds for a specific company',
          inputSchema: {
            type: 'object',
            properties: {
              company_name_or_id: {
                type: 'string',
                description: 'Company name or UUID',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results to return (default: 10)',
              },
            },
            required: ['company_name_or_id'],
          },
        },
        {
          name: 'get_acquisitions',
          description: 'Get acquisitions made by or of a specific company',
          inputSchema: {
            type: 'object',
            properties: {
              company_name_or_id: {
                type: 'string',
                description: 'Company name or UUID',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results to return (default: 10)',
              },
            },
          },
        },
        {
          name: 'search_people',
          description: 'Search for people based on various criteria',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query (e.g., person name)',
              },
              company: {
                type: 'string',
                description: 'Filter by company name',
              },
              title: {
                type: 'string',
                description: 'Filter by job title',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results to return (default: 10)',
              },
            },
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        switch (name) {
          case 'search_companies': {
            if (!args || typeof args !== 'object') {
              throw new McpError(ErrorCode.InvalidParams, 'Invalid parameters');
            }
            const params: SearchCompaniesInput = {
              query: typeof args.query === 'string' ? args.query : undefined,
              location: typeof args.location === 'string' ? args.location : undefined,
              category: typeof args.category === 'string' ? args.category : undefined,
              founded_after: typeof args.founded_after === 'string' ? args.founded_after : undefined,
              founded_before: typeof args.founded_before === 'string' ? args.founded_before : undefined,
              status: typeof args.status === 'string' ? args.status : undefined,
              limit: typeof args.limit === 'number' ? args.limit : undefined
            };
            const companies = await this.crunchbaseApi.searchCompanies(params);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(companies, null, 2),
                },
              ],
            };
          }

          case 'get_company_details': {
            if (!args || typeof args !== 'object' || !('name_or_id' in args) || typeof args.name_or_id !== 'string') {
              throw new McpError(ErrorCode.InvalidParams, 'Missing or invalid name_or_id parameter');
            }
            const params: GetCompanyDetailsInput = { name_or_id: args.name_or_id };
            const company = await this.crunchbaseApi.getCompanyDetails(params);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(company, null, 2),
                },
              ],
            };
          }

          case 'get_funding_rounds': {
            if (!args || typeof args !== 'object' || !('company_name_or_id' in args) || typeof args.company_name_or_id !== 'string') {
              throw new McpError(ErrorCode.InvalidParams, 'Missing or invalid company_name_or_id parameter');
            }
            const params: GetFundingRoundsInput = {
              company_name_or_id: args.company_name_or_id,
              limit: typeof args.limit === 'number' ? args.limit : undefined
            };
            const fundingRounds = await this.crunchbaseApi.getFundingRounds(params);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(fundingRounds, null, 2),
                },
              ],
            };
          }

          case 'get_acquisitions': {
            if (!args || typeof args !== 'object') {
              throw new McpError(ErrorCode.InvalidParams, 'Invalid parameters');
            }
            const params: GetAcquisitionsInput = {
              company_name_or_id: typeof args.company_name_or_id === 'string' ? args.company_name_or_id : undefined,
              limit: typeof args.limit === 'number' ? args.limit : undefined
            };
            const acquisitions = await this.crunchbaseApi.getAcquisitions(params);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(acquisitions, null, 2),
                },
              ],
            };
          }

          case 'search_people': {
            if (!args || typeof args !== 'object') {
              throw new McpError(ErrorCode.InvalidParams, 'Invalid parameters');
            }
            const params: SearchPeopleInput = {
              query: typeof args.query === 'string' ? args.query : undefined,
              company: typeof args.company === 'string' ? args.company : undefined,
              title: typeof args.title === 'string' ? args.title : undefined,
              limit: typeof args.limit === 'number' ? args.limit : undefined
            };
            const people = await this.crunchbaseApi.searchPeople(params);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(people, null, 2),
                },
              ],
            };
          }

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        console.error('Error handling tool call:', error);
        return {
          content: [
            {
              type: 'text',
              text: error instanceof Error ? error.message : 'Unknown error',
            },
          ],
          isError: true,
        };
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Crunchbase MCP server running on stdio');
  }
}

const server = new CrunchbaseMcpServer();
server.run().catch(console.error);
