/**
 * MCP server WebSocket katmanı. CLI tarafı standart MCP JSON-RPC ile bağlanır:
 *   - initialize
 *   - tools/list
 *   - tools/call
 *   - notifications/* (ide_connected vb. — şu an sadece logluyoruz)
 *
 * Auth: bağlantı kurarken `?token=<authToken>` veya `Authorization: Bearer <token>`
 * header'ı zorunlu. Lockfile'a yazılan token ile eşleşmezse bağlantı reddedilir.
 */

import { WebSocketServer, WebSocket } from "ws";
import * as http from "http";
import { TOOLS, ToolName } from "./tools";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: number | string;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface McpServer {
  port: number;
  close(): Promise<void>;
}

export async function startMcpServer(authToken: string, log: (msg: string) => void): Promise<McpServer> {
  const httpServer = http.createServer();
  const wss = new WebSocketServer({ noServer: true });

  // Auth check on upgrade.
  httpServer.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const queryToken = url.searchParams.get("token");
    const headerAuth = req.headers["authorization"];
    const bearerToken =
      typeof headerAuth === "string" && headerAuth.startsWith("Bearer ")
        ? headerAuth.slice(7)
        : undefined;
    const provided = queryToken ?? bearerToken;

    if (provided !== authToken) {
      log(`Auth fail: ${req.socket.remoteAddress}`);
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, ws => wss.emit("connection", ws, req));
  });

  wss.on("connection", (ws: WebSocket) => {
    log("MCP client connected");

    ws.on("message", async (data) => {
      let req: JsonRpcRequest;
      try {
        req = JSON.parse(data.toString()) as JsonRpcRequest;
      } catch {
        return;
      }

      const id = req.id ?? null;
      const send = (resp: Omit<JsonRpcResponse, "jsonrpc" | "id">) => {
        if (id === null) return; // notification, no response
        const out: JsonRpcResponse = { jsonrpc: "2.0", id, ...resp };
        ws.send(JSON.stringify(out));
      };

      try {
        if (req.method === "initialize") {
          send({
            result: {
              protocolVersion: "2024-11-05",
              capabilities: { tools: {} },
              serverInfo: { name: "altaris-vscode", version: "0.1.0" },
            },
          });
          return;
        }

        if (req.method === "tools/list") {
          const tools = Object.entries(TOOLS).map(([name, def]) => ({
            name,
            description: def.description,
            inputSchema: def.inputSchema,
          }));
          send({ result: { tools } });
          return;
        }

        if (req.method === "tools/call") {
          const params = req.params as { name: ToolName; arguments?: Record<string, unknown> };
          const tool = TOOLS[params.name];
          if (!tool) {
            send({ error: { code: -32601, message: `Unknown tool: ${params.name}` } });
            return;
          }
          const result = await (tool.handler as (args: unknown) => Promise<unknown>)(
            params.arguments ?? {},
          );
          send({ result });
          return;
        }

        if (req.method.startsWith("notifications/") || req.method === "ide_connected") {
          // Notifications: id ya yok ya da null — yanıt göndermiyoruz.
          log(`notification: ${req.method}`);
          return;
        }

        send({ error: { code: -32601, message: `Unknown method: ${req.method}` } });
      } catch (err) {
        send({
          error: {
            code: -32000,
            message: err instanceof Error ? err.message : String(err),
          },
        });
      }
    });

    ws.on("close", () => log("MCP client disconnected"));
    ws.on("error", err => log(`WS error: ${err.message}`));
  });

  // Bind to 127.0.0.1 only — extension localhost ile sınırlı.
  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(0, "127.0.0.1", () => resolve());
  });

  const addr = httpServer.address();
  if (!addr || typeof addr === "string") {
    throw new Error("Invalid server address");
  }
  const port = addr.port;
  log(`MCP server listening on 127.0.0.1:${port}`);

  return {
    port,
    async close() {
      await new Promise<void>(resolve => {
        wss.clients.forEach(c => c.terminate());
        wss.close(() => httpServer.close(() => resolve()));
      });
    },
  };
}
