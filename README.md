[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/cyreslab-ai-crunchbase-mcp-server-badge.png)](https://mseep.ai/app/cyreslab-ai-crunchbase-mcp-server)

# Crunchbase MCP Server

A Model Context Protocol (MCP) server that provides access to Crunchbase data for AI assistants. This server allows AI assistants to search for companies, get company details, funding information, acquisitions, and people data from Crunchbase.

## Features

- Search for companies based on various criteria
- Get detailed information about specific companies
- Retrieve funding rounds for companies
- Get acquisition data
- Search for people associated with companies

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

   - Parameters:
     - `name_or_id` (required): Company name or UUID

3. **get_funding_rounds** - Get funding rounds for a specific company

   - Parameters:
     - `company_name_or_id` (required): Company name or UUID
     - `limit` (optional): Maximum number of results to return (default: 10)

4. **get_acquisitions** - Get acquisitions made by or of a specific company

   - Parameters:
     - `company_name_or_id` (optional): Company name or UUID
     - `limit` (optional): Maximum number of results to return (default: 10)

5. **search_people** - Search for people based on various criteria
   - Parameters:
     - `query` (optional): Search query (e.g., person name)
     - `company` (optional): Filter by company name
     - `title` (optional): Filter by job title
     - `limit` (optional): Maximum number of results to return (default: 10)

### Available Resources

The server also exposes the following resources:

1. **Trending Companies** - List of trending companies on Crunchbase

   - URI: `crunchbase://trending/companies`

2. **Company Details** - Detailed information about a specific company

   - URI Template: `crunchbase://companies/{name}`

3. **Company Funding Rounds** - Funding rounds for a specific company

   - URI Template: `crunchbase://companies/{name}/funding`

4. **Company Acquisitions** - Acquisitions made by or of a specific company
   - URI Template: `crunchbase://companies/{name}/acquisitions`

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

## License

MIT

## Contact

For questions or support, please contact: contact@cyreslab.ai
