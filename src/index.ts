#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { Server, ProtocolError, ProtocolErrorCode } from '@modelcontextprotocol/server';
import { CrunchbaseAPI } from './crunchbase-api.js';
import {
  SearchCompaniesInput,
  GetCompanyDetailsInput,
  GetFundingRoundsInput,
  GetAcquisitionsInput,
  SearchPeopleInput,
  GetPersonDetailsInput,
  GetInvestorDetailsInput,
  SearchInvestmentsInput
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

const JOB_SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    uuid: { type: 'string' },
    title: { type: 'string' },
    organization_identifier: {
      type: 'object',
      properties: { uuid: { type: 'string' }, name: { type: 'string' }, permalink: { type: 'string' } },
    },
    started_on: { type: 'string' },
    ended_on: { type: 'string' },
    is_current: { type: 'boolean' },
  },
} as const;

const DEGREE_SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    uuid: { type: 'string' },
    degree_type_name: { type: 'string' },
    subject: { type: 'string' },
    school_identifier: {
      type: 'object',
      properties: { uuid: { type: 'string' }, name: { type: 'string' } },
    },
    started_on: { type: 'string' },
    completed_on: { type: 'string' },
  },
} as const;

const GET_PERSON_DETAILS_OUTPUT_SCHEMA = {
  type: 'object',
  description: 'A Crunchbase person profile, including bio and career/education history',
  properties: {
    ...PERSON_SCHEMA.properties,
    description: { type: 'string' },
    born_on: { type: 'string' },
    died_on: { type: 'string' },
    aliases: { type: 'array', items: { type: 'string' } },
    location_identifiers: { type: 'array', items: LOCATION_IDENTIFIER_SCHEMA },
    num_current_jobs: { type: 'number' },
    num_founded_organizations: { type: 'number' },
    jobs: { type: 'array', items: JOB_SUMMARY_SCHEMA },
    degrees: { type: 'array', items: DEGREE_SUMMARY_SCHEMA },
    founded_organizations: {
      type: 'array',
      items: {
        type: 'object',
        properties: { uuid: { type: 'string' }, name: { type: 'string' }, permalink: { type: 'string' } },
      },
    },
  },
  required: ['uuid', 'name'],
} as const;

const INVESTMENT_SCHEMA = {
  type: 'object',
  description: 'A Crunchbase investment (one investor participating in one funding round)',
  properties: {
    uuid: { type: 'string' },
    name: { type: 'string' },
    announced_on: { type: 'string' },
    investor_identifier: INVESTOR_IDENTIFIER_SCHEMA,
    organization_identifier: {
      type: 'object',
      properties: { uuid: { type: 'string' }, name: { type: 'string' }, permalink: { type: 'string' } },
    },
    funding_round_identifier: {
      type: 'object',
      properties: { uuid: { type: 'string' }, name: { type: 'string' }, permalink: { type: 'string' } },
    },
    funding_round_investment_type: { type: 'string' },
    funding_round_money_raised: { type: 'number' },
    investor_stage: { type: 'array', items: { type: 'string' } },
    is_lead_investor: { type: 'boolean' },
    partner_identifiers: { type: 'array', items: INVESTOR_IDENTIFIER_SCHEMA },
    money_invested: { type: 'number' },
    money_invested_currency_code: { type: 'string' },
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
  },
  required: ['uuid'],
} as const;

const SEARCH_INVESTMENTS_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    count: { type: 'number' },
    investments: { type: 'array', items: INVESTMENT_SCHEMA },
  },
  required: ['count', 'investments'],
} as const;

const GET_INVESTOR_DETAILS_OUTPUT_SCHEMA = {
  type: 'object',
  description: 'A Crunchbase investor profile (an organization) plus its investment portfolio',
  properties: {
    ...COMPANY_SCHEMA.properties,
    investor_type: { type: 'array', items: { type: 'string' } },
    investment_stage: { type: 'array', items: { type: 'string' } },
    num_investments: { type: 'number' },
    num_lead_investments: { type: 'number' },
    num_exits: { type: 'number' },
    num_investors: { type: 'number' },
    participated_investments: { type: 'array', items: INVESTMENT_SCHEMA },
  },
  required: ['uuid', 'name'],
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
          // Backs the crunchbase://organization/{permalink} resource
          // template's {permalink} argument completion (see
          // setupCompletionHandlers) with real Crunchbase autocomplete data.
          completions: {},
        },
      }
    );

    this.crunchbaseApi = new CrunchbaseAPI(apiKey);

    this.setupResourceHandlers();
    this.setupToolHandlers();
    this.setupCompletionHandlers();

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
          {
            uriTemplate: 'crunchbase://organization/{permalink}',
            name: 'Organization Details (by permalink)',
            mimeType: 'application/json',
            description:
              'Detailed information about a specific organization, looked up directly by its exact ' +
              'Crunchbase permalink (skips the ambiguous name-search-then-resolve step). The ' +
              '{permalink} argument supports completion backed by the real Crunchbase autocomplete API.',
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

          // Handle organization-by-permalink resource template. Unlike
          // crunchbase://companies/{name} above, {permalink} is resolved
          // directly (no name search), and its completion is backed by the
          // real Crunchbase /autocompletes endpoint (see setupCompletionHandlers).
          const organizationMatch = uri.match(/^crunchbase:\/\/organization\/([^/]+)$/);
          if (organizationMatch) {
            const permalink = decodeURIComponent(organizationMatch[1]);
            const organization = await this.crunchbaseApi.getCompanyDetails({ permalink });
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(organization, null, 2),
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

  // Backs argument completion for resource templates (the `completions`
  // server capability + `completion/complete` request, per the MCP spec).
  // The SDK's higher-level `completable()`/`McpServer` helper isn't in play
  // here since this server is built on the low-level `Server` class, but
  // `completion/complete` is just another typed request handler at that
  // level, so it's wired up directly instead.
  private setupCompletionHandlers() {
    this.server.setRequestHandler('completion/complete', async (request) => {
      try {
        const { ref, argument } = request.params;

        // Only the crunchbase://organization/{permalink} template's
        // {permalink} argument has real completion data (via Crunchbase's
        // own /autocompletes endpoint). Everything else - prompt refs, or
        // other resource templates/arguments - returns no suggestions
        // rather than an error, per the spec's guidance for unsupported refs.
        if (
          ref.type === 'ref/resource' &&
          ref.uri === 'crunchbase://organization/{permalink}' &&
          argument.name === 'permalink' &&
          argument.value
        ) {
          const values = await this.crunchbaseApi.autocompleteOrganizations(argument.value, 10);
          return {
            completion: {
              values,
              hasMore: false,
              total: values.length,
            },
          };
        }

        return { completion: { values: [] } };
      } catch (error) {
        console.error('Error handling completion request:', error);
        // Completion is a best-effort UX affordance, not a hard requirement -
        // fail soft with no suggestions rather than surfacing a protocol error.
        return { completion: { values: [] } };
      }
    });
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
          description:
            'Get detailed information about a specific company. Prefer uuid or permalink when known: ' +
            'name_or_id resolves ambiguously (a name search, first result wins), which can pick the ' +
            'wrong company for common names.',
          inputSchema: {
            type: 'object',
            properties: {
              name_or_id: {
                type: 'string',
                description: 'Company name to search for (ambiguous - first matching result is used). Ignored if uuid or permalink is given.',
              },
              uuid: {
                type: 'string',
                description: 'Exact Crunchbase UUID of the company. Takes priority over permalink and name_or_id.',
              },
              permalink: {
                type: 'string',
                description: 'Exact Crunchbase permalink of the company (e.g. "openai"). Takes priority over name_or_id.',
              },
            },
          },
          outputSchema: GET_COMPANY_DETAILS_OUTPUT_SCHEMA,
          annotations: READ_ONLY_EXTERNAL_ANNOTATIONS,
        },
        {
          name: 'get_funding_rounds',
          description:
            'Get funding rounds for a specific company. Prefer uuid or permalink when known, to avoid ' +
            'ambiguous name resolution and an extra lookup call.',
          inputSchema: {
            type: 'object',
            properties: {
              company_name_or_id: {
                type: 'string',
                description: 'Company name to search for (ambiguous - first matching result is used). Ignored if uuid or permalink is given.',
              },
              uuid: {
                type: 'string',
                description: 'Exact Crunchbase UUID of the company. Takes priority over permalink and company_name_or_id.',
              },
              permalink: {
                type: 'string',
                description: 'Exact Crunchbase permalink of the company. Takes priority over company_name_or_id.',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results to return (default: 10)',
              },
            },
          },
          outputSchema: GET_FUNDING_ROUNDS_OUTPUT_SCHEMA,
          annotations: READ_ONLY_EXTERNAL_ANNOTATIONS,
        },
        {
          name: 'get_acquisitions',
          description:
            'Get acquisitions made by or of a specific company (or all recent acquisitions if no company ' +
            'is given). Prefer uuid or permalink when known, to avoid ambiguous name resolution.',
          inputSchema: {
            type: 'object',
            properties: {
              company_name_or_id: {
                type: 'string',
                description: 'Company name to search for (ambiguous - first matching result is used). Ignored if uuid or permalink is given.',
              },
              uuid: {
                type: 'string',
                description: 'Exact Crunchbase UUID of the company. Takes priority over permalink and company_name_or_id.',
              },
              permalink: {
                type: 'string',
                description: 'Exact Crunchbase permalink of the company. Takes priority over company_name_or_id.',
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
        {
          name: 'get_person_details',
          description:
            "Get a person's full profile: bio fields (description, born_on, aliases, etc.) plus their " +
            'job history (past and current roles) and education. Complements search_people, which only ' +
            "returns a person's current featured role.",
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Person name to search for (ambiguous - first matching result is used). Ignored if uuid or permalink is given.',
              },
              uuid: {
                type: 'string',
                description: 'Exact Crunchbase UUID of the person. Takes priority over permalink and name.',
              },
              permalink: {
                type: 'string',
                description: 'Exact Crunchbase permalink of the person. Takes priority over name.',
              },
            },
          },
          outputSchema: GET_PERSON_DETAILS_OUTPUT_SCHEMA,
          annotations: READ_ONLY_EXTERNAL_ANNOTATIONS,
        },
        {
          name: 'get_investor_details',
          description:
            "Get an investor's profile (an organization such as a VC firm or corporate investor) plus " +
            'the investments it has participated in - answers "what has investor Y backed". Prefer uuid ' +
            'or permalink when known.',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Investor name to search for (ambiguous - first matching result is used). Ignored if uuid or permalink is given.',
              },
              uuid: {
                type: 'string',
                description: 'Exact Crunchbase UUID of the investor organization. Takes priority over permalink and name.',
              },
              permalink: {
                type: 'string',
                description: 'Exact Crunchbase permalink of the investor organization (e.g. "sequoia-capital"). Takes priority over name.',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of portfolio investments to return (default: 10)',
              },
            },
          },
          outputSchema: GET_INVESTOR_DETAILS_OUTPUT_SCHEMA,
          annotations: READ_ONLY_EXTERNAL_ANNOTATIONS,
        },
        {
          name: 'search_investments',
          description:
            'Search individual investment records - one investor participating in one funding round. ' +
            'Filter by organization (the company that received the investment) to answer "who invested ' +
            'in X", or by investor to answer "what has investor Y backed". At least one filter should ' +
            'usually be given, or results are unfiltered/broad.',
          inputSchema: {
            type: 'object',
            properties: {
              organization_uuid: {
                type: 'string',
                description: 'UUID of the company that received the investment (the funded organization).',
              },
              organization_permalink: {
                type: 'string',
                description: 'Permalink of the company that received the investment. Ignored if organization_uuid is given.',
              },
              investor_uuid: {
                type: 'string',
                description: 'UUID of the investor (organization or person) that made the investment.',
              },
              investor_permalink: {
                type: 'string',
                description: 'Permalink of the investor. Ignored if investor_uuid is given.',
              },
              funding_round_uuid: {
                type: 'string',
                description: 'UUID of a specific funding round to list investments for.',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results to return (default: 10)',
              },
              after_id: {
                type: 'string',
                description: 'Pagination cursor: pass the uuid of the last result from a previous call to get the next page.',
              },
            },
          },
          outputSchema: SEARCH_INVESTMENTS_OUTPUT_SCHEMA,
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
            if (!args || typeof args !== 'object') {
              throw new ProtocolError(ProtocolErrorCode.InvalidParams, 'Invalid parameters');
            }
            const params: GetCompanyDetailsInput = {
              name_or_id: typeof args.name_or_id === 'string' ? args.name_or_id : undefined,
              uuid: typeof args.uuid === 'string' ? args.uuid : undefined,
              permalink: typeof args.permalink === 'string' ? args.permalink : undefined,
            };
            if (!params.name_or_id && !params.uuid && !params.permalink) {
              throw new ProtocolError(ProtocolErrorCode.InvalidParams, 'Provide one of: uuid, permalink, or name_or_id');
            }
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
            if (!args || typeof args !== 'object') {
              throw new ProtocolError(ProtocolErrorCode.InvalidParams, 'Invalid parameters');
            }
            const params: GetFundingRoundsInput = {
              company_name_or_id: typeof args.company_name_or_id === 'string' ? args.company_name_or_id : undefined,
              uuid: typeof args.uuid === 'string' ? args.uuid : undefined,
              permalink: typeof args.permalink === 'string' ? args.permalink : undefined,
              limit: typeof args.limit === 'number' ? args.limit : undefined
            };
            if (!params.company_name_or_id && !params.uuid && !params.permalink) {
              throw new ProtocolError(ProtocolErrorCode.InvalidParams, 'Provide one of: uuid, permalink, or company_name_or_id');
            }
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
              uuid: typeof args.uuid === 'string' ? args.uuid : undefined,
              permalink: typeof args.permalink === 'string' ? args.permalink : undefined,
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

          case 'get_person_details': {
            if (!args || typeof args !== 'object') {
              throw new ProtocolError(ProtocolErrorCode.InvalidParams, 'Invalid parameters');
            }
            const params: GetPersonDetailsInput = {
              name: typeof args.name === 'string' ? args.name : undefined,
              uuid: typeof args.uuid === 'string' ? args.uuid : undefined,
              permalink: typeof args.permalink === 'string' ? args.permalink : undefined,
            };
            if (!params.name && !params.uuid && !params.permalink) {
              throw new ProtocolError(ProtocolErrorCode.InvalidParams, 'Provide one of: uuid, permalink, or name');
            }
            const person = await this.crunchbaseApi.getPersonDetails(params);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(person, null, 2),
                },
              ],
              structuredContent: person,
            };
          }

          case 'get_investor_details': {
            if (!args || typeof args !== 'object') {
              throw new ProtocolError(ProtocolErrorCode.InvalidParams, 'Invalid parameters');
            }
            const params: GetInvestorDetailsInput = {
              name: typeof args.name === 'string' ? args.name : undefined,
              uuid: typeof args.uuid === 'string' ? args.uuid : undefined,
              permalink: typeof args.permalink === 'string' ? args.permalink : undefined,
              limit: typeof args.limit === 'number' ? args.limit : undefined,
            };
            if (!params.name && !params.uuid && !params.permalink) {
              throw new ProtocolError(ProtocolErrorCode.InvalidParams, 'Provide one of: uuid, permalink, or name');
            }
            const investor = await this.crunchbaseApi.getInvestorDetails(params);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(investor, null, 2),
                },
              ],
              structuredContent: investor,
            };
          }

          case 'search_investments': {
            if (!args || typeof args !== 'object') {
              throw new ProtocolError(ProtocolErrorCode.InvalidParams, 'Invalid parameters');
            }
            const params: SearchInvestmentsInput = {
              organization_uuid: typeof args.organization_uuid === 'string' ? args.organization_uuid : undefined,
              organization_permalink: typeof args.organization_permalink === 'string' ? args.organization_permalink : undefined,
              investor_uuid: typeof args.investor_uuid === 'string' ? args.investor_uuid : undefined,
              investor_permalink: typeof args.investor_permalink === 'string' ? args.investor_permalink : undefined,
              funding_round_uuid: typeof args.funding_round_uuid === 'string' ? args.funding_round_uuid : undefined,
              limit: typeof args.limit === 'number' ? args.limit : undefined,
              after_id: typeof args.after_id === 'string' ? args.after_id : undefined,
            };
            const investments = await this.crunchbaseApi.searchInvestments(params);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(investments, null, 2),
                },
              ],
              structuredContent: {
                count: investments.length,
                investments,
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
