export interface AgentRecord {
  agentId: number;
  owner: string;
  tokenURI: string;
  agentWallet: string | null;
  metadata: AgentMetadata | null;
  metadataFormat: MetadataFormat;
  metadataError: string | null;
}

export type MetadataFormat =
  | 'base64'
  | 'gzip-base64'
  | 'ipfs'
  | 'http'
  | 'raw-json'
  | 'unknown';

export interface AgentMetadata {
  type?: string;
  name?: string;
  description?: string;
  image?: string;
  services?: ServiceEndpoint[];
  active?: boolean;
  supportedTrust?: string[];
  registrations?: Array<{
    agentId: number;
    agentRegistry: string;
  }>;
  [key: string]: unknown;
}

export interface ServiceEndpoint {
  name?: string;
  type?: string;
  endpoint?: string;
  url?: string;
  version?: string;
}

export interface LayerScore {
  layer: 'registration' | 'liveness' | 'onchain' | 'sybil' | 'reputation';
  score: number;
  maxScore: number;
  details: string[];
  flags: string[];
}

export interface TrustReport {
  agentId: number;
  owner: string;
  name: string;
  compositeScore: number;
  confidence: 'high' | 'medium' | 'low';
  layers: LayerScore[];
  circuitBreakers: string[];
  scannedAt: string;
  reportVersion: 'trust-v2';
  errors: string[];
}

export interface ScanResult {
  totalAgents: number;
  scannedAt: string;
  reports: TrustReport[];
  ownerStats: Record<string, number>;
}
