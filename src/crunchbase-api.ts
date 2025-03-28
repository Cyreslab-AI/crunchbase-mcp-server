import axios, { AxiosInstance } from 'axios';
import {
  Acquisition,
  Company,
  CrunchbaseApiResponse,
  FundingRound,
  Person,
  SearchCompaniesInput,
  GetCompanyDetailsInput,
  GetFundingRoundsInput,
  GetAcquisitionsInput,
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
   * Search for companies based on various criteria
   */
  async searchCompanies(params: SearchCompaniesInput): Promise<Company[]> {
    try {
      // Build the query string based on the provided parameters
      let query = params.query || '';

      if (params.location) {
        query += ` AND location:${params.location}`;
      }

      if (params.category) {
        query += ` AND category:${params.category}`;
      }

      if (params.founded_after) {
        query += ` AND founded_on:>=${params.founded_after}`;
      }

      if (params.founded_before) {
        query += ` AND founded_on:<=${params.founded_before}`;
      }

      if (params.status) {
        query += ` AND status:${params.status}`;
      }

      const response = await this.client.get<CrunchbaseApiResponse<Company[]>>('/searches/organizations', {
        params: {
          query,
          limit: params.limit || 10,
          order: 'rank DESC'
        }
      });

      return response.data.data;
    } catch (error) {
      console.error('Error searching companies:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get detailed information about a specific company
   */
  async getCompanyDetails(params: GetCompanyDetailsInput): Promise<Company> {
    try {
      // First, try to search for the company by name
      const searchResponse = await this.client.get<CrunchbaseApiResponse<Company[]>>('/searches/organizations', {
        params: {
          query: params.name_or_id,
          limit: 1
        }
      });

      if (searchResponse.data.count === 0) {
        throw new Error(`Company not found: ${params.name_or_id}`);
      }

      const companyId = searchResponse.data.data[0].uuid;

      // Then, get the detailed information using the UUID
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
      // First, get the company UUID
      const company = await this.getCompanyDetails({ name_or_id: params.company_name_or_id });

      // Then, get the funding rounds
      const response = await this.client.get<CrunchbaseApiResponse<FundingRound[]>>(`/entities/organizations/${company.uuid}/funding_rounds`, {
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

      if (params.company_name_or_id) {
        // Get the company UUID
        const company = await this.getCompanyDetails({ name_or_id: params.company_name_or_id });
        companyId = company.uuid;
      }

      // Build the query
      let query = '';
      if (companyId) {
        query = `acquirer_identifier.uuid:${companyId} OR acquiree_identifier.uuid:${companyId}`;
      }

      // Get the acquisitions
      const response = await this.client.get<CrunchbaseApiResponse<Acquisition[]>>('/searches/acquisitions', {
        params: {
          query,
          limit: params.limit || 10,
          order: 'announced_on DESC'
        }
      });

      return response.data.data;
    } catch (error) {
      console.error('Error getting acquisitions:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Search for people based on various criteria
   */
  async searchPeople(params: SearchPeopleInput): Promise<Person[]> {
    try {
      // Build the query string based on the provided parameters
      let query = params.query || '';

      if (params.company) {
        query += ` AND featured_job_organization_name:${params.company}`;
      }

      if (params.title) {
        query += ` AND featured_job_title:${params.title}`;
      }

      const response = await this.client.get<CrunchbaseApiResponse<Person[]>>('/searches/people', {
        params: {
          query,
          limit: params.limit || 10,
          order: 'rank DESC'
        }
      });

      return response.data.data;
    } catch (error) {
      console.error('Error searching people:', error);
      throw this.handleError(error);
    }
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
