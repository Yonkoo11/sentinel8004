import type { AgentRecord, LayerScore } from '../types.js';

const PLACEHOLDER_PATTERNS = [
  'YOUR_USER',
  'YOUR_REPO',
  'example.com',
  'test agent',
  'my agent',
  'agent description',
  'lorem ipsum',
  'TODO',
  'placeholder',
];

const ERC8004_TYPE = 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1';

export function scoreRegistration(agent: AgentRecord): LayerScore {
  const details: string[] = [];
  const flags: string[] = [];
  let score = 0;

  // No metadata at all = 0
  if (!agent.metadata) {
    details.push('No parseable metadata');
    flags.push('NO_METADATA');
    return { layer: 'registration', score: 0, maxScore: 25, details, flags };
  }

  const m = agent.metadata;

  // Valid parseable metadata (4pts)
  score += 4;
  details.push('+4 Valid parseable metadata');

  // Has name (5pts)
  if (m.name && m.name.trim().length > 0) {
    score += 5;
    details.push(`+5 Has name: "${m.name}"`);
  } else {
    details.push('+0 Missing name');
    flags.push('NO_NAME');
  }

  // Has description >20 chars (5pts)
  if (m.description && m.description.trim().length > 20) {
    score += 5;
    details.push(`+5 Has description (${m.description.length} chars)`);
  } else if (m.description) {
    score += 2;
    details.push(`+2 Short description (${m.description.length} chars)`);
  } else {
    details.push('+0 Missing description');
    flags.push('NO_DESCRIPTION');
  }

  // Has type field matching ERC-8004 spec (3pts)
  if (m.type === ERC8004_TYPE) {
    score += 3;
    details.push('+3 Correct ERC-8004 type field');
  } else if (m.type) {
    score += 1;
    details.push(`+1 Has type but non-standard: "${m.type}"`);
  } else {
    details.push('+0 Missing type field');
  }

  // Has services array with entries (5pts)
  if (m.services && Array.isArray(m.services) && m.services.length > 0) {
    const validServices = m.services.filter(s => s.endpoint || s.url);
    if (validServices.length > 0) {
      score += 5;
      details.push(`+5 Has ${validServices.length} service endpoint(s)`);
    } else {
      score += 2;
      details.push('+2 Has services array but no valid endpoints');
    }
  } else {
    details.push('+0 No services declared');
    flags.push('NO_SERVICES');
  }

  // Has image URL (3pts)
  if (m.image && (m.image.startsWith('http') || m.image.startsWith('ipfs://'))) {
    score += 3;
    details.push('+3 Has image URL');
  } else {
    details.push('+0 No image');
  }

  // Placeholder detection: deduct points
  const fullText = JSON.stringify(m).toLowerCase();
  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (fullText.includes(pattern.toLowerCase())) {
      const deduction = Math.min(score, 10);
      score -= deduction;
      details.push(`-${deduction} Placeholder pattern detected: "${pattern}"`);
      flags.push(`PLACEHOLDER:${pattern}`);
      break; // Only deduct once
    }
  }

  score = Math.max(0, Math.min(25, score));

  return { layer: 'registration', score, maxScore: 25, details, flags };
}
