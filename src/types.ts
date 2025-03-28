// Types for Crunchbase API responses and MCP server

// Common types for Crunchbase API
export interface CrunchbaseApiResponse<T> {
  data: T;
  count: number;
  total_count: number;
}

// Company types
export interface Company {
  uuid: string;
  name: string;
  short_description: string;
  website_url: string;
  linkedin_url?: string;
  twitter_url?: string;
  facebook_url?: string;
  logo_url?: string;
  location_identifiers?: LocationIdentifier[];
  categories?: Category[];
  founded_on?: string;
  closed_on?: string;
  num_employees_min?: number;
  num_employees_max?: number;
  status?: string;
  rank?: number;
  created_at?: string;
  updated_at?: string;
}

export interface LocationIdentifier {
  uuid: string;
  name: string;
  location_type: string;
}

export interface Category {
  uuid: string;
  name: string;
}

// Funding types
export interface FundingRound {
  uuid: string;
  name: string;
  announced_on: string;
  closed_on?: string;
  investment_type: string;
  money_raised?: number;
  money_raised_currency_code?: string;
  target_money_raised?: number;
  target_money_raised_currency_code?: string;
  investor_identifiers?: InvestorIdentifier[];
  lead_investor_identifiers?: InvestorIdentifier[];
  created_at: string;
  updated_at: string;
}

export interface InvestorIdentifier {
  uuid: string;
  name: string;
  investor_type: string;
}

// Acquisition types
export interface Acquisition {
  uuid: string;
  acquirer_identifier: {
    uuid: string;
    name: string;
  };
  acquiree_identifier: {
    uuid: string;
    name: string;
  };
  announced_on: string;
  completed_on?: string;
  price?: number;
  price_currency_code?: string;
  acquisition_type?: string;
  acquisition_status?: string;
  acquisition_terms?: string;
  created_at: string;
  updated_at: string;
}

// People types
export interface Person {
  uuid: string;
  first_name: string;
  last_name: string;
  name: string;
  gender?: string;
  linkedin_url?: string;
  twitter_url?: string;
  facebook_url?: string;
  featured_job_organization_uuid?: string;
  featured_job_organization_name?: string;
  featured_job_title?: string;
  rank?: number;
  created_at: string;
  updated_at: string;
}

// Search parameters
export interface SearchParams {
  query?: string;
  field_ids?: string[];
  limit?: number;
  order?: string;
}

// MCP Tool input types
export interface SearchCompaniesInput {
  query?: string;
  location?: string;
  category?: string;
  founded_after?: string;
  founded_before?: string;
  status?: string;
  limit?: number;
}

export interface GetCompanyDetailsInput {
  name_or_id: string;
}

export interface GetFundingRoundsInput {
  company_name_or_id: string;
  limit?: number;
}

export interface GetAcquisitionsInput {
  company_name_or_id?: string;
  limit?: number;
}

export interface SearchPeopleInput {
  query?: string;
  company?: string;
  title?: string;
  limit?: number;
}
