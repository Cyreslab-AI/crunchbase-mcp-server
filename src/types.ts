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

// Extended person profile returned by get_person_details (entity lookup with
// bio + card_ids=jobs,degrees,founded_organizations rather than a search hit).
export interface JobSummary {
  uuid?: string;
  title?: string;
  organization_identifier?: { uuid: string; name: string; permalink?: string };
  person_identifier?: { uuid: string; name: string };
  started_on?: string;
  ended_on?: string;
  is_current?: boolean;
}

export interface DegreeSummary {
  uuid?: string;
  degree_type_name?: string;
  subject?: string;
  school_identifier?: { uuid: string; name: string };
  started_on?: string;
  completed_on?: string;
}

export interface PersonDetails extends Person {
  description?: string;
  born_on?: string;
  died_on?: string;
  aliases?: string[];
  location_identifiers?: LocationIdentifier[];
  num_current_jobs?: number;
  num_founded_organizations?: number;
  jobs?: JobSummary[];
  degrees?: DegreeSummary[];
  founded_organizations?: { uuid: string; name: string; permalink?: string }[];
}

// Investment / investor types
export interface Investment {
  uuid: string;
  name?: string;
  announced_on?: string;
  investor_identifier?: InvestorIdentifier;
  organization_identifier?: { uuid: string; name: string; permalink?: string };
  funding_round_identifier?: { uuid: string; name: string; permalink?: string };
  funding_round_investment_type?: string;
  funding_round_money_raised?: number;
  investor_stage?: string[];
  is_lead_investor?: boolean;
  partner_identifiers?: InvestorIdentifier[];
  money_invested?: number;
  money_invested_currency_code?: string;
  created_at?: string;
  updated_at?: string;
}

// An investor "card" is just an Organization (occasionally a Person) with
// investing-specific fields layered on top, plus its investment portfolio.
export interface InvestorDetails extends Company {
  investor_type?: string[];
  investment_stage?: string[];
  num_investments?: number;
  num_lead_investments?: number;
  num_exits?: number;
  num_investors?: number;
  participated_investments?: Investment[];
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

// name_or_id is kept for backward compatibility (name-search-then-resolve).
// uuid/permalink let a caller skip that ambiguous, two-call resolution when
// the exact entity is already known. At least one of the three is required.
export interface GetCompanyDetailsInput {
  name_or_id?: string;
  uuid?: string;
  permalink?: string;
}

export interface GetFundingRoundsInput {
  company_name_or_id?: string;
  uuid?: string;
  permalink?: string;
  limit?: number;
}

export interface GetAcquisitionsInput {
  company_name_or_id?: string;
  uuid?: string;
  permalink?: string;
  limit?: number;
}

export interface SearchPeopleInput {
  query?: string;
  company?: string;
  title?: string;
  limit?: number;
}

export interface GetPersonDetailsInput {
  name?: string;
  uuid?: string;
  permalink?: string;
}

export interface GetInvestorDetailsInput {
  name?: string;
  uuid?: string;
  permalink?: string;
  limit?: number;
}

export interface SearchInvestmentsInput {
  organization_uuid?: string;
  organization_permalink?: string;
  investor_uuid?: string;
  investor_permalink?: string;
  funding_round_uuid?: string;
  limit?: number;
  after_id?: string;
}
