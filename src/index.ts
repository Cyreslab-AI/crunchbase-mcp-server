#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { Server, ProtocolError, ProtocolErrorCode } from '@modelcontextprotocol/server';
import { CrunchbaseAPI } from './crunchbase-api.js';
import {
  SearchCompaniesInput,
  GetCompanyDetailsInput,
  GetFundingRoundsInput,
  GetAcquisitionsInput,
  SearchPeopleInput
} from './types.js';

// JSON Schema fragments describing the actual Crunchbase entity shapes returned by
// CrunchbaseAPI (see src/types.ts and src/crunchbase-api.ts).

const LOCATION_IDENTIFIER_SCHEMA = {
  type: 'object',
  properties: {
    uuid: { type: 'string' },
    name: { type: 'string' },
    location_type: { type: 'string' },
  },
} as const;

const CATEGORY_SCHEMA = {
  type: 'object',
  properties: {
    uuid: { type: 'string' },
    name: { type: 'string' },
  },
} as const;

const COMPANY_SCHEMA = {
  type: 'object',
  description: 'A Crunchbase organization',
  properties: {
    uuid: { type: 'string' },
    name: { type: 'string' },
    short_description: { type: 'string' },
    website_url: { type: 'string' },
    linkedin_url: { type: 'string' },
    twitter_url: { type: 'string' },
    facebook_url: { type: 'string' },
    logo_url: { type: 'string' },
    location_identifiers: { type: 'array', items: LOCATION_IDENTIFIER_SCHEMA },
    categories: { type: 'array', items: CATEGORY_SCHEMA },
    founded_on: { type: 'string' },
    closed_on: { type: 'string' },
    num_employees_min: { type: 'number' },
    num_employees_max: { type: 'number' },
    status: { type: 'string' },
    rank: { type: 'number' },
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
  },
  required: ['uuid', 'name'],
} as const;

const SEARCH_COMPANIES_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    count: { type: 'number' },
    companies: { type: 'array', items: COMPANY_SCHEMA },
  },
  required: ['count', 'companies'],
} as const;

const GET_COMPANY_DETAILS_OUTPUT_SCHEMA = COMPANY_SCHEMA;

const INVESTOR_IDENTIFIER_SCHEMA = {
  type: 'object',
  properties: {
    uuid: { type: 'string' },
    name: { type: 'string' },
    investor_type: { type: 'string' },
  },
} as const;

const FUNDING_ROUND_SCHEMA = {
  type: 'object',
  description: 'A Crunchbase funding round',
  properties: {
    uuid: { type: 'string' },
    name: { type: 'string' },
    announced_on: { type: 'string' },
    closed_on: { type: 'string' },
    investment_type: { type: 'string' },
    money_raised: { type: 'number' },
    money_raised_currency_code: { type: 'string' },
    target_money_raised: { type: 'number' },
    target_money_raised_currency_code: { type: 'string' },
    investor_identifiers: { type: 'array', items: INVESTOR_IDENTIFIER_SCHEMA },
    lead_investor_identifiers: { type: 'array', items: INVESTOR_IDENTIFIER_SCHEMA },
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
  },
  required: ['uuid', 'name', 'announced_on', 'investment_type'],
} as const;

const GET_FUNDING_ROUNDS_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    count: { type: 'number' },
    funding_rounds: { type: 'array', items: FUNDING_ROUND_SCHEMA },
  },
  required: ['count', 'funding_rounds'],
} as const;

const ACQUISITION_SCHEMA = {
  type: 'object',
  description: 'A Crunchbase acquisition',
  properties: {
    uuid: { type: 'string' },
    acquirer_identifier: {
      type: 'object',
      properties: { uuid: { type: 'string' }, name: { type: 'string' } },
    },
    acquiree_identifier: {
      type: 'object',
      properties: { uuid: { type: 'string' }, name: { type: 'string' } },
    },
    announced_on: { type: 'string' },
    completed_on: { type: 'string' },
    price: { type: 'number' },
    price_currency_code: { type: 'string' },
    acquisition_type: { type: 'string' },
    acquisition_status: { type: 'string' },
    acquisition_terms: { type: 'string' },
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
  },
  required: ['uuid', 'acquirer_identifier', 'acquiree_identifier', 'announced_on'],
} as const;

const GET_ACQUISITIONS_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    count: { type: 'number' },
    acquisitions: { type: 'array', items: ACQUISITION_SCHEMA },
  },
  required: ['count', 'acquisitions'],
} as const;

const PERSON_SCHEMA = {
  type: 'object',
  description: 'A Crunchbase person',
  properties: {
    uuid: { type: 'string' },
    first_name: { type: 'string' },
    last_name: { type: 'string' },
    name: { type: 'string' },
    gender: { type: 'string' },
    linkedin_url: { type: 'string' },
    twitter_url: { type: 'string' },
    facebook_url: { type: 'string' },
    featured_job_organization_uuid: { type: 'string' },
    featured_job_organization_name: { type: 'string' },
    featured_job_title: { type: 'string' },
    rank: { type: 'number' },
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
  },
  required: ['uuid', 'name'],
} as const;

const SEARCH_PEOPLE_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    count: { type: 'number' },
    people: { type: 'array', items: PERSON_SCHEMA },
  },
  required: ['count', 'people'],
} as const;

// All tools only read data from the public Crunchbase API; none of them modify
// anything, so every tool shares the same annotations.
const READ_ONLY_EXTERNAL_ANNOTATIONS = {
  readOnlyHint: true,
  openWorldHint: true,
} as const;

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
    this.server.setRequestHandler('resources/list', async () => ({
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
      'resources/templates/list',
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
      'resources/read',
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

          throw new ProtocolError(
            ProtocolErrorCode.InvalidRequest,
            `Invalid URI: ${uri}`
          );
        } catch (error) {
          console.error('Error handling resource request:', error);
          if (error instanceof ProtocolError) {
            throw error;
          }
          throw new ProtocolError(
            ProtocolErrorCode.InternalError,
            error instanceof Error ? error.message : 'Unknown error'
          );
        }
      }
    );
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler('tools/list', async (): Promise<any> => ({
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
          outputSchema: SEARCH_COMPANIES_OUTPUT_SCHEMA,
          annotations: READ_ONLY_EXTERNAL_ANNOTATIONS,
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
          outputSchema: GET_COMPANY_DETAILS_OUTPUT_SCHEMA,
          annotations: READ_ONLY_EXTERNAL_ANNOTATIONS,
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
          outputSchema: GET_FUNDING_ROUNDS_OUTPUT_SCHEMA,
          annotations: READ_ONLY_EXTERNAL_ANNOTATIONS,
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
          outputSchema: GET_ACQUISITIONS_OUTPUT_SCHEMA,
          annotations: READ_ONLY_EXTERNAL_ANNOTATIONS,
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
          outputSchema: SEARCH_PEOPLE_OUTPUT_SCHEMA,
          annotations: READ_ONLY_EXTERNAL_ANNOTATIONS,
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler('tools/call', async (request) => {
      try {
        const { name, arguments: args } = request.params;

        switch (name) {
          case 'search_companies': {
            if (!args || typeof args !== 'object') {
              throw new ProtocolError(ProtocolErrorCode.InvalidParams, 'Invalid parameters');
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
              structuredContent: {
                count: companies.length,
                companies,
              },
            };
          }

          case 'get_company_details': {
            if (!args || typeof args !== 'object' || !('name_or_id' in args) || typeof args.name_or_id !== 'string') {
              throw new ProtocolError(ProtocolErrorCode.InvalidParams, 'Missing or invalid name_or_id parameter');
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
              structuredContent: company,
            };
          }

          case 'get_funding_rounds': {
            if (!args || typeof args !== 'object' || !('company_name_or_id' in args) || typeof args.company_name_or_id !== 'string') {
              throw new ProtocolError(ProtocolErrorCode.InvalidParams, 'Missing or invalid company_name_or_id parameter');
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
              structuredContent: {
                count: fundingRounds.length,
                funding_rounds: fundingRounds,
              },
            };
          }

          case 'get_acquisitions': {
            if (!args || typeof args !== 'object') {
              throw new ProtocolError(ProtocolErrorCode.InvalidParams, 'Invalid parameters');
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
              structuredContent: {
                count: acquisitions.length,
                acquisitions,
              },
            };
          }

          case 'search_people': {
            if (!args || typeof args !== 'object') {
              throw new ProtocolError(ProtocolErrorCode.InvalidParams, 'Invalid parameters');
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
              structuredContent: {
                count: people.length,
                people,
              },
            };
          }

          default:
            throw new ProtocolError(
              ProtocolErrorCode.MethodNotFound,
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
