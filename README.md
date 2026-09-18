[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/cyreslab-ai-crunchbase-mcp-server-badge.png)](https://mseep.ai/app/cyreslab-ai-crunchbase-mcp-server)

# Crunchbase MCP Server

A Model Context Protocol (MCP) server that provides access to Crunchbase data for AI assistants. This server allows AI assistants to search for companies, get company details, funding information, acquisitions, investor/investment data, and people data from Crunchbase.

## Features

- Search for companies based on various criteria
- Get detailed information about specific companies (by name, UUID, or permalink)
- Retrieve funding rounds for companies
- Get acquisition data
- Search for people associated with companies
- Get a person's full profile, including job and education history
- Get an investor's profile and investment portfolio ("what has investor Y backed")
- Search individual investment records ("who invested in X")

## Prerequisites

- Node.js (v16 or higher)
- A Crunchbase API key

## Installation

1. Clone the repository:

```bash
git clone https://github.com/Cyreslab-AI/crunchbase-mcp-server.git
cd crunchbase-mcp-server
```

2. Install dependencies:

```bash
npm install
```

3. Build the project:

```bash
npm run build
```

## Configuration

The server requires a Crunchbase API key to function. You can obtain an API key by signing up for the [Crunchbase API](https://data.crunchbase.com/docs/using-the-api).

### Setting up the API Key

Set the API key as an environment variable:

```bash
export CRUNCHBASE_API_KEY=your_api_key_here
```

### MCP Configuration

You can use the included setup script to automatically configure the MCP server:

```bash
# Build the project first
npm run build

# Run the setup script
npm run setup
```

The setup script will:

1. Ask for your Crunchbase API key
2. Find your MCP settings file (or create a new one)
3. Add the Crunchbase MCP server to your settings

Alternatively, you can manually add it to your MCP configuration file:

```json
{
  "mcpServers": {
    "crunchbase": {
      "command": "node",
      "args": ["/path/to/crunchbase-mcp-server/build/index.js"],
      "env": {
        "CRUNCHBASE_API_KEY": "your_api_key_here"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

## Usage

### Running the Server

Start the server:

```bash
npm start
```

For development with automatic reloading:

```bash
npm run dev
```

### Available Tools

The server exposes the following tools:

1. **search_companies** - Search for companies based on various criteria

   - Parameters:
     - `query` (optional): Search query (e.g., company name, description)
     - `location` (optional): Filter by location (e.g., "San Francisco", "New York")
     - `category` (optional): Filter by category (e.g., "Artificial Intelligence", "Fintech")
     - `founded_after` (optional): Filter by founding date (YYYY-MM-DD)
     - `founded_before` (optional): Filter by founding date (YYYY-MM-DD)
     - `status` (optional): Filter by company status (e.g., "active", "closed")
     - `limit` (optional): Maximum number of results to return (default: 10)

2. **get_company_details** - Get detailed information about a specific company

   - Parameters (provide at least one; `uuid`/`permalink` take priority over `name_or_id`):
     - `name_or_id` (optional): Company name to search for. This resolves **ambiguously** - it's a name search that takes the first result, which can pick the wrong company for common names (e.g. "Meta"). Prefer `uuid` or `permalink` when you know them.
     - `uuid` (optional): Exact Crunchbase UUID of the company.
     - `permalink` (optional): Exact Crunchbase permalink of the company (e.g. `"openai"`).

3. **get_funding_rounds** - Get funding rounds for a specific company

   - Parameters (provide at least one identifier):
     - `company_name_or_id` (optional): Company name to search for (ambiguous, see above).
     - `uuid` / `permalink` (optional): Exact identifiers for the company. Preferred - also skips an extra lookup call.
     - `limit` (optional): Maximum number of results to return (default: 10)

4. **get_acquisitions** - Get acquisitions made by or of a specific company (or recent acquisitions generally, if no company is given)

   - Parameters:
     - `company_name_or_id` (optional): Company name to search for (ambiguous, see above).
     - `uuid` / `permalink` (optional): Exact identifiers for the company. Preferred.
     - `limit` (optional): Maximum number of results to return (default: 10)

5. **search_people** - Search for people based on various criteria

   - Parameters:
     - `query` (optional): Search query (e.g., person name)
     - `company` (optional): Filter by company name
     - `title` (optional): Filter by job title
     - `limit` (optional): Maximum number of results to return (default: 10)

6. **get_person_details** - Get a person's full profile: bio fields (description, born_on, aliases, etc.) plus their job history (past and current roles) and education. Complements `search_people`, which only returns a person's current featured role.

   - Parameters (provide at least one identifier):
     - `name` (optional): Person name to search for (ambiguous - first result wins).
     - `uuid` / `permalink` (optional): Exact identifiers for the person. Preferred.

7. **get_investor_details** - Get an investor's profile (an organization such as a VC firm or corporate investor) plus the investments it has participated in - answers "what has investor Y backed".

   - Parameters (provide at least one identifier):
     - `name` (optional): Investor name to search for (ambiguous - first result wins).
     - `uuid` / `permalink` (optional): Exact identifiers for the investor organization. Preferred (e.g. permalink `"sequoia-capital"`).
     - `limit` (optional): Maximum number of portfolio investments to return (default: 10)

8. **search_investments** - Search individual investment records (one investor participating in one funding round). Filter by organization to answer "who invested in X", or by investor to answer "what has investor Y backed".
   - Parameters:
     - `organization_uuid` / `organization_permalink` (optional): The company that received the investment.
     - `investor_uuid` / `investor_permalink` (optional): The investor that made the investment.
     - `funding_round_uuid` (optional): A specific funding round to list investments for.
     - `limit` (optional): Maximum number of results to return (default: 10)
     - `after_id` (optional): Pagination cursor - pass the `uuid` of the last result from a previous call to get the next page.

### Available Resources

The server also exposes the following resources:

1. **Trending Companies** - List of trending companies on Crunchbase

   - URI: `crunchbase://trending/companies`

2. **Company Details** - Detailed information about a specific company (resolved by name search)

   - URI Template: `crunchbase://companies/{name}`

3. **Company Funding Rounds** - Funding rounds for a specific company

   - URI Template: `crunchbase://companies/{name}/funding`

4. **Company Acquisitions** - Acquisitions made by or of a specific company

   - URI Template: `crunchbase://companies/{name}/acquisitions`

5. **Organization Details (by permalink)** - Detailed information about a specific organization, looked up directly by its exact Crunchbase permalink (skips the ambiguous name-search-then-resolve step used by `crunchbase://companies/{name}`).
   - URI Template: `crunchbase://organization/{permalink}`
   - The `{permalink}` argument supports **completion**: an MCP client that calls `completion/complete` for this template gets live suggestions from Crunchbase's own `/autocompletes` endpoint (e.g. typing `"open"` can suggest `"openai"`).

## Example Queries

Here are some examples of how an AI assistant might use this MCP server:

1. Search for AI companies in San Francisco:

```json
{
  "query": "AI",
  "location": "San Francisco",
  "limit": 5
}
```

2. Get details for a specific company:

```json
{
  "name_or_id": "OpenAI"
}
```

3. Get funding rounds for a company:

```json
{
  "company_name_or_id": "Anthropic"
}
```

4. Search for CEOs at tech companies:

```json
{
  "title": "CEO",
  "limit": 10
}
```

5. Get an investor's profile and portfolio (`get_investor_details`):

```json
{
  "permalink": "sequoia-capital",
  "limit": 10
}
```

6. Find who invested in a company (`search_investments`):

```json
{
  "organization_permalink": "openai"
}
```

7. Get a person's full bio and job history (`get_person_details`):

```json
{
  "permalink": "sam-altman"
}
```

## License

MIT

## Contact

For questions or support, please contact: contact@cyreslab.ai
