import axios, { AxiosInstance } from 'axios';
import {
  Acquisition,
  Company,
  CrunchbaseApiResponse,
  FundingRound,
  GetInvestorDetailsInput,
  GetPersonDetailsInput,
  Investment,
  InvestorDetails,
  Person,
  PersonDetails,
  SearchCompaniesInput,
  GetCompanyDetailsInput,
  GetFundingRoundsInput,
  GetAcquisitionsInput,
  SearchInvestmentsInput,
  SearchPeopleInput
} from './types.js';

export class CrunchbaseAPI {
  private apiKey: string;
  private client: AxiosInstance;
  private baseUrl = 'https://api.crunchbase.com/api/v4';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Accept': 'application/json',
        'X-cb-user-key': this.apiKey
      }
    });
  }

  /**
   * Search for companies based on various criteria.
   *
   * Rewritten from a GET-based Lucene query string (which now 404s - see the
   * routing note on resolveOrganizationId) to the current POST-based Search
   * API. Field IDs/operators confirmed against https://data.crunchbase.com/reference/searchorganizations.md:
   * `identifier` (text, contains), `founded_on` (date_precision, gte/lte),
   * `status` (enum: closed/ipo/operating/was_acquired, eq). `location`/
   * `category` are the hard part: `location_identifiers`/`category_groups`
   * are `identifier_multi` fields (operators: includes/includes_all/
   * not_includes/not_includes_all/blank - no eq/contains on plain text), so
   * a caller-supplied name has to be resolved to a Crunchbase identifier via
   * /autocompletes first.
   */
  async searchCompanies(params: SearchCompaniesInput): Promise<Company[]> {
    try {
      const query: Array<{ type: string; field_id: string; operator_id: string; values: string[] }> = [];

      if (params.query) {
        query.push({ type: 'predicate', field_id: 'identifier', operator_id: 'contains', values: [params.query] });
      }

      if (params.founded_after) {
        query.push({ type: 'predicate', field_id: 'founded_on', operator_id: 'gte', values: [params.founded_after] });
      }

      if (params.founded_before) {
        query.push({ type: 'predicate', field_id: 'founded_on', operator_id: 'lte', values: [params.founded_before] });
      }

      if (params.status) {
        query.push({ type: 'predicate', field_id: 'status', operator_id: 'eq', values: [params.status] });
      }

      if (params.location) {
        const locationId = await this.resolveIdentifier(params.location, 'locations');
        if (locationId) {
          query.push({ type: 'predicate', field_id: 'location_identifiers', operator_id: 'includes', values: [locationId] });
        }
      }

      if (params.category) {
        const categoryId = await this.resolveIdentifier(params.category, 'category_groups');
        if (categoryId) {
          query.push({ type: 'predicate', field_id: 'category_groups', operator_id: 'includes', values: [categoryId] });
        }
      }

      const response = await this.client.post('/searches/organizations', {
        field_ids: [
          'identifier', 'short_description', 'website_url', 'linkedin', 'twitter', 'facebook',
          'location_identifiers', 'categories', 'founded_on', 'closed_on',
          'num_employees_enum', 'status', 'rank_org', 'created_at', 'updated_at'
        ],
        query,
        limit: params.limit || 10
      });

      return this.extractEntities<any>(response.data).map((entity) => this.flattenOrganization(entity));
    } catch (error) {
      console.error('Error searching companies:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Resolve a free-text name (e.g. "San Francisco", "Fintech") to a
   * Crunchbase identifier UUID via /autocompletes, for use as the value of
   * an identifier_multi search predicate (location_identifiers,
   * category_groups). Returns undefined rather than throwing when nothing
   * matches, since an unresolvable location/category name is a "no results"
   * condition for the caller's filter, not a hard error.
   */
  private async resolveIdentifier(name: string, collectionId: 'locations' | 'category_groups'): Promise<string | undefined> {
    const response = await this.client.get('/autocompletes', {
      params: { query: name, collection_ids: collectionId, limit: 1 }
    });
    const entities = Array.isArray(response.data?.entities) ? response.data.entities : [];
    return entities[0]?.identifier?.uuid;
  }

  /**
   * Flatten a POST Search API organization entity - `{ uuid, permalink,
   * properties: { identifier: { value, uuid, permalink }, ... } }` - into
   * the flat `Company` shape (`name`, `uuid`, `permalink`, ...) the rest of
   * this server already expects, matching the field names the legacy
   * GET-based endpoint used to return. Best-effort: exact property casing
   * for the less-common fields (num_employees_enum, rank_org) couldn't be
   * confirmed against a live paid key, so those are passed through as-is
   * alongside the confirmed identifier/date/status remapping.
   */
  private flattenOrganization(entity: any): Company {
    const identifier = entity?.identifier ?? {};
    return {
      uuid: entity.uuid ?? identifier.uuid,
      name: identifier.value ?? entity.name,
      short_description: entity.short_description,
      website_url: entity.website_url,
      linkedin_url: entity.linkedin?.value ?? entity.linkedin_url,
      twitter_url: entity.twitter?.value ?? entity.twitter_url,
      facebook_url: entity.facebook?.value ?? entity.facebook_url,
      location_identifiers: entity.location_identifiers,
      categories: entity.categories,
      founded_on: entity.founded_on,
      closed_on: entity.closed_on,
      status: entity.status,
      rank: entity.rank_org ?? entity.rank,
      created_at: entity.created_at,
      updated_at: entity.updated_at
    } as Company;
  }

  /**
   * Resolve a company to a Crunchbase entity_id (uuid or permalink work
   * interchangeably as the {entity_id} path segment for /entities/organizations).
   *
   * Design note (capability-review fix): the original implementation always
   * did a name-search-then-take-first-result, which costs an extra API call
   * and can mis-resolve common names (e.g. "Meta"). Callers who already know
   * the exact uuid/permalink can pass it directly and skip the search entirely;
   * the name-search fallback is kept for backward compatibility.
   *
   * Verification note: live-testing against the real Crunchbase gateway (with
   * an invalid key, just to observe routing) showed the legacy GET
   * `/searches/organizations?query=...` call this fallback used to make
   * returns 404 - that route appears to no longer exist - while the
   * structured POST `/searches/organizations` search used here gets past
   * routing and correctly fails auth (401). The fallback below uses the
   * POST contract for that reason.
   */
  private async resolveOrganizationId(params: { uuid?: string; permalink?: string; name_or_id?: string }): Promise<string> {
    if (params.uuid) {
      return params.uuid;
    }
    if (params.permalink) {
      return params.permalink;
    }
    if (!params.name_or_id) {
      throw new Error('Provide a uuid, permalink, or name_or_id to identify the company');
    }

    const searchResponse = await this.client.post('/searches/organizations', {
      field_ids: ['identifier', 'uuid', 'permalink'],
      query: [{ type: 'predicate', field_id: 'identifier', operator_id: 'contains', values: [params.name_or_id] }],
      limit: 1
    });

    const results = this.extractEntities<{ uuid: string }>(searchResponse.data);
    if (results.length === 0) {
      throw new Error(`Company not found: ${params.name_or_id}`);
    }

    return results[0].uuid;
  }

  /**
   * Resolve a person to a Crunchbase entity_id (uuid or permalink), falling
   * back to a name search when neither is given. See resolveOrganizationId
   * for why this uses the POST-based search contract.
   */
  private async resolvePersonId(params: { uuid?: string; permalink?: string; name?: string }): Promise<string> {
    if (params.uuid) {
      return params.uuid;
    }
    if (params.permalink) {
      return params.permalink;
    }
    if (!params.name) {
      throw new Error('Provide a uuid, permalink, or name to identify the person');
    }

    const searchResponse = await this.client.post('/searches/people', {
      field_ids: ['identifier', 'uuid', 'permalink'],
      query: [{ type: 'predicate', field_id: 'identifier', operator_id: 'contains', values: [params.name] }],
      limit: 1
    });

    const results = this.extractEntities<{ uuid: string }>(searchResponse.data);
    if (results.length === 0) {
      throw new Error(`Person not found: ${params.name}`);
    }

    return results[0].uuid;
  }

  /**
   * Crunchbase v4 has shipped more than one response envelope across API
   * generations: the flat `{ data, count, total_count }` shape the legacy
   * GET-based /searches/* endpoints in this file already assume, and a
   * `{ count, entities: [{ uuid, properties }] }` / `{ cards: { <card_id>: [...] } }`
   * shape used by the current POST-based Search API and card sub-resources.
   * Since this server cannot be exercised against a live paid API key,
   * new endpoints unwrap defensively instead of assuming a single shape.
   */
  private extractEntities<T = any>(payload: any, cardId?: string): T[] {
    if (!payload) {
      return [];
    }
    if (Array.isArray(payload)) {
      return payload as T[];
    }
    if (Array.isArray(payload.data)) {
      return payload.data as T[];
    }
    if (Array.isArray(payload.entities)) {
      return payload.entities.map((e: any) =>
        e && typeof e === 'object' && e.properties
          ? { uuid: e.uuid, permalink: e.permalink, ...e.properties }
          : e
      ) as T[];
    }
    if (cardId && payload.cards && Array.isArray(payload.cards[cardId])) {
      return payload.cards[cardId] as T[];
    }
    if (Array.isArray(payload.cards)) {
      return payload.cards as T[];
    }
    return [];
  }

  /**
   * Get detailed information about a specific company
   */
  async getCompanyDetails(params: GetCompanyDetailsInput): Promise<Company> {
    try {
      const companyId = await this.resolveOrganizationId(params);

      // Then, get the detailed information using the UUID/permalink
      const detailsResponse = await this.client.get<Company>(`/entities/organizations/${companyId}`);
      return detailsResponse.data;
    } catch (error) {
      console.error('Error getting company details:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get funding rounds for a specific company
   */
  async getFundingRounds(params: GetFundingRoundsInput): Promise<FundingRound[]> {
    try {
      // Resolve the company id directly when possible so a caller who already
      // knows the uuid/permalink doesn't pay for an extra details lookup.
      const companyId = await this.resolveOrganizationId({
        uuid: params.uuid,
        permalink: params.permalink,
        name_or_id: params.company_name_or_id
      });

      // Then, get the funding rounds
      const response = await this.client.get<CrunchbaseApiResponse<FundingRound[]>>(`/entities/organizations/${companyId}/funding_rounds`, {
        params: {
          limit: params.limit || 10,
          order: 'announced_on DESC'
        }
      });

      return response.data.data;
    } catch (error) {
      console.error('Error getting funding rounds:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get acquisitions made by or of a specific company
   */
  async getAcquisitions(params: GetAcquisitionsInput): Promise<Acquisition[]> {
    try {
      let companyId: string | undefined;

      if (params.uuid || params.permalink || params.company_name_or_id) {
        companyId = await this.resolveOrganizationId({
          uuid: params.uuid,
          permalink: params.permalink,
          name_or_id: params.company_name_or_id
        });
      }

      const fieldIds = [
        'identifier', 'uuid', 'permalink', 'acquirer_identifier', 'acquiree_identifier',
        'announced_on', 'completed_on', 'price', 'price_currency_code',
        'acquisition_type', 'acquisition_status', 'acquisition_terms', 'created_at', 'updated_at'
      ];
      const limit = params.limit || 10;
      const order = [{ field_id: 'announced_on', sort: 'desc' }];

      // Note: like the other /searches/* calls in this file, this used to be
      // a GET with a Lucene-style query string ("field:value OR field:value").
      // Live-testing against the real gateway showed that route returns 404 -
      // it appears to no longer exist - while the structured POST contract
      // below gets past routing and correctly fails auth instead.
      if (!companyId) {
        const response = await this.client.post('/searches/acquisitions', { field_ids: fieldIds, query: [], order, limit });
        return this.extractEntities<Acquisition>(response.data);
      }

      // The Search API only ANDs predicates together, so "acquirer OR
      // acquiree" needs two requests merged (and deduped) client-side.
      const [asAcquirer, asAcquiree] = await Promise.all([
        this.client.post('/searches/acquisitions', {
          field_ids: fieldIds,
          query: [{ type: 'predicate', field_id: 'acquirer_identifier', operator_id: 'eq', values: [companyId] }],
          order,
          limit
        }),
        this.client.post('/searches/acquisitions', {
          field_ids: fieldIds,
          query: [{ type: 'predicate', field_id: 'acquiree_identifier', operator_id: 'eq', values: [companyId] }],
          order,
          limit
        })
      ]);

      const merged = [
        ...this.extractEntities<Acquisition>(asAcquirer.data),
        ...this.extractEntities<Acquisition>(asAcquiree.data)
      ];
      const seen = new Set<string>();
      const deduped = merged.filter((acquisition) => {
        if (!acquisition.uuid || seen.has(acquisition.uuid)) {
          return false;
        }
        seen.add(acquisition.uuid);
        return true;
      });
      deduped.sort((a, b) => (b.announced_on || '').localeCompare(a.announced_on || ''));

      return deduped.slice(0, limit);
    } catch (error) {
      console.error('Error getting acquisitions:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get a person's full profile: bio fields plus their job (past + current
   * role) and education history, via card_ids on the entity lookup.
   */
  async getPersonDetails(params: GetPersonDetailsInput): Promise<PersonDetails> {
    try {
      const personId = await this.resolvePersonId(params);

      const response = await this.client.get<PersonDetails>(`/entities/people/${personId}`, {
        params: {
          card_ids: 'jobs,degrees,founded_organizations'
        }
      });

      const person = response.data as any;
      return {
        ...person,
        jobs: this.extractEntities(person, 'jobs'),
        degrees: this.extractEntities(person, 'degrees'),
        founded_organizations: this.extractEntities(person, 'founded_organizations')
      };
    } catch (error) {
      console.error('Error getting person details:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get an investor's profile plus the investments it has participated in
   * (its portfolio) - answers "what has investor Y backed". The investor is
   * modeled as an Organization (VC firm, corporate investor, etc.) with the
   * `participated_investments` card layered on top, per the documented v4
   * card taxonomy (e.g. GET /entities/organizations/sequoia-capital/cards/participated_investments).
   */
  async getInvestorDetails(params: GetInvestorDetailsInput): Promise<InvestorDetails> {
    try {
      const investorId = await this.resolveOrganizationId({
        uuid: params.uuid,
        permalink: params.permalink,
        name_or_id: params.name
      });

      const detailsResponse = await this.client.get<InvestorDetails>(`/entities/organizations/${investorId}`);

      let participatedInvestments: Investment[] = [];
      try {
        const cardResponse = await this.client.get(`/entities/organizations/${investorId}/cards/participated_investments`, {
          params: {
            limit: params.limit || 10,
            order: 'announced_on desc'
          }
        });
        participatedInvestments = this.extractEntities<Investment>(cardResponse.data, 'participated_investments');
      } catch (cardError) {
        // The investor profile is still useful even if the portfolio card
        // fails or isn't available for this entity (e.g. it isn't an investor).
        console.error('Error getting participated_investments card:', cardError);
      }

      return {
        ...detailsResponse.data,
        participated_investments: participatedInvestments
      };
    } catch (error) {
      console.error('Error getting investor details:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Search investment records - "who invested in X" (filter by organization)
   * or "what has investor Y backed" (filter by investor). Uses the current
   * documented v4 Search API contract: POST /searches/investments with a
   * structured predicate query, distinct from the older query-string style
   * the pre-existing search_* methods in this file use.
   */
  async searchInvestments(params: SearchInvestmentsInput): Promise<Investment[]> {
    try {
      const query: Array<{ type: string; field_id: string; operator_id: string; values: string[] }> = [];

      const organizationId = params.organization_uuid || params.organization_permalink;
      if (organizationId) {
        query.push({ type: 'predicate', field_id: 'organization_identifier', operator_id: 'eq', values: [organizationId] });
      }

      const investorId = params.investor_uuid || params.investor_permalink;
      if (investorId) {
        query.push({ type: 'predicate', field_id: 'investor_identifier', operator_id: 'eq', values: [investorId] });
      }

      if (params.funding_round_uuid) {
        query.push({ type: 'predicate', field_id: 'funding_round_identifier', operator_id: 'eq', values: [params.funding_round_uuid] });
      }

      const response = await this.client.post('/searches/investments', {
        field_ids: [
          'identifier',
          'uuid',
          'permalink',
          'announced_on',
          'investor_identifier',
          'organization_identifier',
          'funding_round_identifier',
          'funding_round_investment_type',
          'investor_stage',
          'is_lead_investor',
          'partner_identifiers'
        ],
        query,
        order: [{ field_id: 'announced_on', sort: 'desc' }],
        limit: params.limit || 10,
        ...(params.after_id ? { after_id: params.after_id } : {})
      });

      return this.extractEntities<Investment>(response.data);
    } catch (error) {
      console.error('Error searching investments:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Suggest organization permalinks/names for a partial query, backing the
   * `crunchbase://organization/{permalink}` resource template's argument
   * completion via Crunchbase's own /autocompletes endpoint.
   */
  async autocompleteOrganizations(query: string, limit = 10): Promise<string[]> {
    try {
      const response = await this.client.get('/autocompletes', {
        params: {
          query,
          collection_ids: 'organization.companies',
          limit
        }
      });

      const entities = Array.isArray(response.data?.entities) ? response.data.entities : [];
      return entities
        .map((entity: any) => entity?.identifier?.permalink || entity?.permalink)
        .filter((permalink: unknown): permalink is string => typeof permalink === 'string' && permalink.length > 0);
    } catch (error) {
      console.error('Error autocompleting organizations:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Search for people based on various criteria.
   *
   * Rewritten from a GET-based Lucene query string (which now 404s) to the
   * current POST-based Search API, per https://data.crunchbase.com/reference/searchpeople.md.
   * That reference confirms there is no `featured_job_organization_identifier`/
   * `featured_job_title` field in the current API - the equivalents are
   * `primary_organization` (an identifier field: the person's current
   * employer, filterable by eq on an org identifier/uuid) and
   * `primary_job_title` (text_short, filterable by contains). `company` is
   * therefore resolved via the existing org name-search helper first, same
   * as every other "resolve a name to an id" path in this file.
   */
  async searchPeople(params: SearchPeopleInput): Promise<Person[]> {
    try {
      const query: Array<{ type: string; field_id: string; operator_id: string; values: string[] }> = [];

      if (params.query) {
        query.push({ type: 'predicate', field_id: 'identifier', operator_id: 'contains', values: [params.query] });
      }

      if (params.title) {
        query.push({ type: 'predicate', field_id: 'primary_job_title', operator_id: 'contains', values: [params.title] });
      }

      if (params.company) {
        const companyId = await this.resolveOrganizationId({ name_or_id: params.company });
        query.push({ type: 'predicate', field_id: 'primary_organization', operator_id: 'eq', values: [companyId] });
      }

      const response = await this.client.post('/searches/people', {
        field_ids: [
          'identifier', 'first_name', 'last_name', 'gender', 'linkedin', 'twitter', 'facebook',
          'primary_organization', 'primary_job_title', 'rank_person', 'created_at', 'updated_at'
        ],
        query,
        limit: params.limit || 10
      });

      return this.extractEntities<any>(response.data).map((entity) => this.flattenPerson(entity));
    } catch (error) {
      console.error('Error searching people:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Flatten a POST Search API person entity into the flat `Person` shape
   * this server already exposes (`featured_job_organization_uuid/_name`,
   * `featured_job_title`) so existing tool callers see no shape change,
   * even though the current API's own field names are `primary_organization`/
   * `primary_job_title`. Best-effort on the exact social-link property
   * casing, same caveat as flattenOrganization.
   */
  private flattenPerson(entity: any): Person {
    const identifier = entity?.identifier ?? {};
    const primaryOrg = entity?.primary_organization ?? {};
    return {
      uuid: entity.uuid ?? identifier.uuid,
      first_name: entity.first_name,
      last_name: entity.last_name,
      name: identifier.value ?? entity.name,
      gender: entity.gender,
      linkedin_url: entity.linkedin?.value ?? entity.linkedin_url,
      twitter_url: entity.twitter?.value ?? entity.twitter_url,
      facebook_url: entity.facebook?.value ?? entity.facebook_url,
      featured_job_organization_uuid: primaryOrg.uuid,
      featured_job_organization_name: primaryOrg.value,
      featured_job_title: entity.primary_job_title,
      rank: entity.rank_person ?? entity.rank,
      created_at: entity.created_at,
      updated_at: entity.updated_at
    } as Person;
  }

  /**
   * Handle API errors
   */
  private handleError(error: any): Error {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;

      if (status === 401) {
        return new Error('Unauthorized: Invalid API key');
      } else if (status === 404) {
        return new Error('Not found: The requested resource does not exist');
      } else if (status === 429) {
        return new Error('Rate limit exceeded: Too many requests');
      } else {
        return new Error(`Crunchbase API error (${status}): ${message}`);
      }
    }

    return error instanceof Error ? error : new Error('Unknown error');
  }
}
