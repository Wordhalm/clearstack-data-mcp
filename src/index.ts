#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

const server = createServer({ token: process.env.APIFY_TOKEN });
await server.connect(new StdioServerTransport());
console.error('clearstack-data MCP server running on stdio');
