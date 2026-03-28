#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { AsecClient } from './api-client.js';
import { tools, handleToolCall, type CallToolResult } from './tools.js';

const ASEC_API_URL = process.env.ASEC_API_URL || 'http://localhost:3000';
const ASEC_TOKEN = process.env.ASEC_TOKEN || '';

const client = new AsecClient(ASEC_API_URL, ASEC_TOKEN);

const server = new Server(
  { name: 'asec-mcp-server', version: '0.0.1' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
  const { name, arguments: args } = request.params;
  return handleToolCall(name, (args ?? {}) as Record<string, unknown>, client);
});

const transport = new StdioServerTransport();
await server.connect(transport);
