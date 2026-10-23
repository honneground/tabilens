// Thin wrapper around the Redpine MCP endpoint.
// Redpine exposes fixed tools (preview, confirm, call-tool, find-tools, inspect-tool, get_balance)
// plus one search-<name> per granted collection. Upstream tools like tobu--* go through call-tool.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { config } from './config.js';

let clientPromise = null;

async function getClient() {
  if (!clientPromise) {
    clientPromise = (async () => {
      if (!config.redpine.url) throw new Error('REDPINE_MCP_URL is not set');
      const transport = new StreamableHTTPClientTransport(new URL(config.redpine.url), {
        requestInit: { headers: { Authorization: `Bearer ${config.redpine.apiKey}` } },
      });
      const client = new Client({ name: 'tabilens', version: '0.1.0' });
      await client.connect(transport);
      return client;
    })().catch((e) => {
      clientPromise = null;
      throw e;
    });
  }
  return clientPromise;
}

// MCP tool results come back as content blocks; Redpine returns JSON in a text block.
function unwrap(result) {
  if (result?.isError) {
    const msg = result.content?.map((c) => c.text).join('\n') || 'Redpine tool error';
    throw new Error(msg);
  }
  if (result?.structuredContent) return result.structuredContent;
  const text = result?.content?.find((c) => c.type === 'text')?.text;
  if (!text) return result;
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

export async function callRaw(name, args = {}) {
  const client = await getClient();
  return unwrap(await client.callTool({ name, arguments: args }));
}

export const redpine = {
  getBalance: () => callRaw('get_balance'),
  findTools: (args) => callRaw('find-tools', args),
  inspectTool: (tool_name) => callRaw('inspect-tool', { tool_name }),

  // Free. Returns teaser + cost + queryId.
  preview: (tool_name, args) => callRaw('preview', { tool_name, arguments: args }),

  // Bills. Pass only the result_ids you need.
  confirm: (queryId, opts = {}) => callRaw('confirm', { queryId, ...opts }),

  // Bills immediately. Used for upstream tools such as tobu--rail_departures.
  callTool: (tool_name, args) => callRaw('call-tool', { tool_name, arguments: args }),
};

/**
 * preview → (guarded) confirm.
 * Auto-confirms only when the quoted cost is under MAX_AUTO_CONFIRM_USD.
 * Returns { preview, unlocked, costUsd, autoConfirmed }.
 */
export async function previewThenConfirm(toolName, args, confirmOpts = {}) {
  const preview = await redpine.preview(toolName, args);
  if (preview.workflow === 'complete') {
    return { preview, unlocked: preview, costUsd: 0, autoConfirmed: false };
  }
  const costUsd = Number(preview.cost ?? preview.cost_usd ?? preview.price ?? NaN);
  const queryId = preview.queryId ?? preview.query_id;
  if (!Number.isFinite(costUsd) || costUsd > config.redpine.maxAutoConfirmUsd) {
    return { preview, unlocked: null, costUsd, autoConfirmed: false, queryId };
  }
  const unlocked = await redpine.confirm(queryId, confirmOpts);
  return { preview, unlocked, costUsd, autoConfirmed: true, queryId };
}
