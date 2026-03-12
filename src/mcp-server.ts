import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { readFileSync, existsSync } from 'node:fs';
import type { TrustReport } from './types.js';

const RESULTS_PATH = 'data/scan-results.json';

interface ScanData {
  totalAgents: number;
  scannedAt: string;
  scanMode: string;
  reports: TrustReport[];
}

// Cache scan data in memory instead of re-reading from disk on every tool call
let cachedData: ScanData | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // Refresh from disk every 60s

function loadScanData(): ScanData | null {
  const now = Date.now();
  if (cachedData && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedData;
  }
  if (!existsSync(RESULTS_PATH)) return null;
  try {
    cachedData = JSON.parse(readFileSync(RESULTS_PATH, 'utf-8'));
    cacheTimestamp = now;
    return cachedData;
  } catch {
    return null;
  }
}

function findReport(agentId: number): TrustReport | null {
  const data = loadScanData();
  if (!data) return null;
  return data.reports.find(r => r.agentId === agentId) || null;
}

export async function startMCPServer() {
  const server = new Server(
    {
      name: 'agentguard',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'check_agent_trust',
        description: 'Check the trust score and risk flags for a specific ERC-8004 agent on Celo. Returns composite score (0-100), layer breakdown, and any warning flags.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            agentId: {
              type: 'number',
              description: 'The ERC-8004 agent ID to check (1-based)',
            },
          },
          required: ['agentId'],
        },
      },
      {
        name: 'list_flagged_agents',
        description: 'List agents below a trust score threshold. Useful for finding potentially risky or spam agents. Returns agent IDs, names, scores, and flags.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            maxScore: {
              type: 'number',
              description: 'Maximum trust score threshold (default: 30). Agents at or below this score are returned.',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results (default: 20)',
            },
          },
        },
      },
      {
        name: 'get_agent_report',
        description: 'Get the full trust report for an agent, including all layer details, scoring rationale, and error information.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            agentId: {
              type: 'number',
              description: 'The ERC-8004 agent ID',
            },
          },
          required: ['agentId'],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'check_agent_trust': {
        const agentId = (args as { agentId: number }).agentId;
        const report = findReport(agentId);
        if (!report) {
          return {
            content: [{
              type: 'text' as const,
              text: `Agent #${agentId} not found in scan results. Run a scan first or check the agent ID.`,
            }],
          };
        }

        const flags = report.layers.flatMap(l => l.flags);
        const summary = [
          `Agent #${report.agentId}: "${report.name}"`,
          `Owner: ${report.owner}`,
          `Trust Score: ${report.compositeScore}/100 (confidence: ${report.confidence || 'unknown'})`,
          '',
          'Layer Scores:',
          ...report.layers.map(l => `  ${l.layer}: ${l.score}/${l.maxScore}`),
        ];

        if (report.circuitBreakers && report.circuitBreakers.length > 0) {
          summary.push('', 'Circuit Breakers Active:', ...report.circuitBreakers.map(cb => `  - ${cb}`));
        }

        if (flags.length > 0) {
          summary.push('', 'Flags:', ...flags.map(f => `  - ${f}`));
        }

        if (report.errors.length > 0) {
          summary.push('', 'Errors:', ...report.errors.map(e => `  - ${e}`));
        }

        return {
          content: [{ type: 'text' as const, text: summary.join('\n') }],
        };
      }

      case 'list_flagged_agents': {
        const maxScore = (args as { maxScore?: number }).maxScore ?? 30;
        const limit = (args as { limit?: number }).limit ?? 20;
        const data = loadScanData();

        if (!data) {
          return {
            content: [{ type: 'text' as const, text: 'No scan results available. Run a scan first.' }],
          };
        }

        const flagged = data.reports
          .filter(r => r.compositeScore <= maxScore)
          .sort((a, b) => a.compositeScore - b.compositeScore)
          .slice(0, limit);

        if (flagged.length === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: `No agents found with score <= ${maxScore}. Total agents scanned: ${data.reports.length}`,
            }],
          };
        }

        const lines = [
          `Found ${flagged.length} agents with score <= ${maxScore}:`,
          '',
          ...flagged.map(r => {
            const flags = r.layers.flatMap(l => l.flags);
            return `#${r.agentId} "${r.name}" → ${r.compositeScore}/100${flags.length > 0 ? ` [${flags.join(', ')}]` : ''}`;
          }),
        ];

        return {
          content: [{ type: 'text' as const, text: lines.join('\n') }],
        };
      }

      case 'get_agent_report': {
        const agentId = (args as { agentId: number }).agentId;
        const report = findReport(agentId);

        if (!report) {
          return {
            content: [{
              type: 'text' as const,
              text: `Agent #${agentId} not found in scan results.`,
            }],
          };
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(report, null, 2),
          }],
        };
      }

      default:
        return {
          content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('AgentGuard MCP server started on stdio');
}
