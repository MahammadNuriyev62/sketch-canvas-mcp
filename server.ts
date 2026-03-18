import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs/promises";
import path from "node:path";

const DIST_DIR = import.meta.filename.endsWith(".ts")
  ? path.join(import.meta.dirname, "dist")
  : import.meta.dirname;

export function createServer(): McpServer {
  const server = new McpServer({
    name: "Sketch Canvas",
    version: "1.0.0",
  });

  const resourceUri = "ui://sketch-canvas/mcp-app.html";

  registerAppTool(server,
    "sketch-canvas",
    {
      title: "Sketch Canvas",
      description:
        "Opens an interactive drawing canvas for the user to visually explain an idea. " +
        "Invoke this tool when the user wants to sketch, draw, or diagram something — " +
        'for example when they say "let me show you", "easier to draw", "let me sketch it", ' +
        '"I\'ll diagram it", or when a verbal explanation seems insufficient and a visual ' +
        "would help. The user draws on the canvas and clicks Done to send the sketch as " +
        "an image for you to interpret.",
      inputSchema: {},
      _meta: { ui: { resourceUri } },
    },
    async (): Promise<CallToolResult> => {
      return {
        content: [
          {
            type: "text",
            text: "Sketch canvas opened. The user is drawing. Wait for them to click Done to send their sketch.",
          },
        ],
      };
    },
  );

  registerAppResource(server,
    resourceUri,
    resourceUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async (): Promise<ReadResourceResult> => {
      const html = await fs.readFile(path.join(DIST_DIR, "mcp-app.html"), "utf-8");
      return {
        contents: [
          { uri: resourceUri, mimeType: RESOURCE_MIME_TYPE, text: html },
        ],
      };
    },
  );

  return server;
}
