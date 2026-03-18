# Sketch Canvas MCP

An [MCP App](https://modelcontextprotocol.github.io/ext-apps/) that gives Claude a drawing canvas. When you need to visually explain an idea, Claude opens an interactive sketch pad where you can draw diagrams, annotate, and sketch freely. Your drawing auto-syncs into the conversation context, so you just draw and keep talking.

## How it works

1. Tell Claude something like *"let me sketch this out"* or *"easier to draw than explain"*
2. Claude invokes the `sketch-canvas` tool and a canvas appears
3. Draw your idea using the toolbar (freehand, shapes, arrows, text, colors)
4. Your sketch auto-syncs to Claude's context after each action
5. Type your next message and Claude sees both your words and your drawing

No buttons to click, no extra steps. Draw, then talk.

## Tools

| Tool | Description |
|------|-------------|
| Freehand | Draw freely with adjustable stroke width |
| Rectangle | Drag to draw rectangles |
| Circle | Drag to draw ellipses |
| Arrow | Drag to draw arrows with arrowheads |
| Text | Click to place text labels |
| Eraser | Erase parts of your drawing |
| Undo | Ctrl+Z or toolbar button |
| Color picker | Choose any stroke color |

## Connect to Claude

Add the remote server URL as an MCP integration in Claude:

```
https://sketch-canvas-mcp.maganuriyev.workers.dev/mcp
```

Or run locally:

```bash
npm install
npm run dev
# Server starts at http://localhost:3001/mcp
```

## Deploy your own

### Cloudflare Workers

```bash
npm install
npx wrangler login
npm run deploy
```

### Any Node.js host

```bash
npm install
npm run build
node dist/main.js
# Or with stdio transport:
node dist/main.js --stdio
```

## Project structure

```
server.ts          Server-side: registers sketch-canvas tool + UI resource
main.ts            Entry point for local dev (Express + HTTP transport)
worker.ts          Entry point for Cloudflare Workers
mcp-app.html       HTML shell for the canvas UI
src/mcp-app.ts     Canvas app logic (drawing, export, auto-sync)
src/mcp-app.css    Canvas UI styles
src/global.css     Theme variables and base styles
```

## How the sync works

After each drawing action (stroke, shape, text, undo, clear), the app waits 800ms for the user to stop, then:

1. Exports the canvas as a 2x resolution PNG with white background
2. Calls `updateModelContext()` with the image, which attaches it to the user's next message
3. Claude receives the sketch alongside whatever the user types next

The context overwrites on each sync, so Claude always sees the latest state of the drawing.

## License

MIT
