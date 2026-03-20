#!/usr/bin/env node
// One-shot script to update Synthesis project with Open Track + richer conversationLog
// Usage: SYNTHESIS_API_KEY=sk-synth-... node scripts/update-synthesis.mjs

import { readFileSync } from 'fs';

const payload = JSON.parse(readFileSync('ai/synthesis-update.json', 'utf8')).payload;

const updateBody = {
  trackUUIDs: payload.trackUUIDs,
  conversationLog: JSON.stringify(payload.conversationLog),
};

const apiKey = process.env.SYNTHESIS_API_KEY;
if (!apiKey) {
  console.error('Error: SYNTHESIS_API_KEY not set');
  process.exit(1);
}

const PROJECT_UUID = '44047eed8b3545f28c33779685d88e00';

const res = await fetch(`https://synthesis.devfolio.co/projects/${PROJECT_UUID}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  },
  body: JSON.stringify(updateBody),
});

const text = await res.text();
try {
  const json = JSON.parse(text);
  console.log('HTTP Status:', res.status);
  console.log('Tracks:', json.trackUUIDs?.length ?? 'n/a');
  console.log('ConversationLog length:', json.conversationLog?.length ?? 'n/a');
  console.log('Status:', json.status ?? json.error ?? 'unknown');
  if (json.error) console.error('Error:', json.error, json.message);
} catch {
  console.log('HTTP Status:', res.status);
  console.log('Raw response:', text.substring(0, 500));
}
