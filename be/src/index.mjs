import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { createHistoryStore } from "./history.mjs";

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "127.0.0.1";
// Resolved from the repo root, which is the cwd because the root package.json
// runs the server with `node be/src/index.mjs` rather than through a workspace.
// The env overrides exist so a host can point at a mounted disk explicitly.
const root = process.env.APP_ROOT ?? process.cwd();
const distDir = process.env.CLIENT_DIST ?? join(root, "fe", "dist");
const dataDir = process.env.DATA_DIR ?? join(root, "data");
const history = createHistoryStore(dataDir);
const cache = new Map();

const hypixel = {
  bazaar: "https://api.hypixel.net/v2/skyblock/bazaar",
  auctions: "https://api.hypixel.net/v2/skyblock/auctions",
};

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

const sendJson = (response, status, body) => {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
};

const fetchCached = async (key, url, ttlMs) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.cachedAt < ttlMs) {
    return { ...cached.body, cache: { cached: true, cachedAt: cached.cachedAt } };
  }

  const upstream = await fetch(url);
  if (!upstream.ok) {
    throw new Error(`Hypixel returned ${upstream.status}`);
  }

  const body = await upstream.json();
  const cachedAt = Date.now();
  cache.set(key, { cachedAt, body });
  return { ...body, cache: { cached: false, cachedAt } };
};

const serveStatic = async (requestUrl, response) => {
  const url = new URL(requestUrl, `http://127.0.0.1:${port}`);
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = normalize(join(distDir, requested));

  if (!filePath.startsWith(distDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const content = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": contentTypes[extname(filePath)] ?? "application/octet-stream",
      "Cache-Control": "public, max-age=60",
    });
    response.end(content);
  } catch {
    const fallback = await readFile(join(distDir, "index.html"));
    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end(fallback);
  }
};

createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);

    if (url.pathname === "/api/health") {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (url.pathname === "/api/bazaar") {
      const body = await fetchCached("bazaar", hypixel.bazaar, 60_000);
      history.recordSnapshot(body);
      sendJson(response, 200, body);
      return;
    }

    if (url.pathname === "/api/auctions") {
      const page = Math.max(0, Number(url.searchParams.get("page") ?? 0) || 0);
      sendJson(
        response,
        200,
        await fetchCached(`auctions:${page}`, `${hypixel.auctions}?page=${page}`, 60_000),
      );
      return;
    }

    if (url.pathname.startsWith("/api/history/")) {
      const productId = decodeURIComponent(url.pathname.replace("/api/history/", "")).toUpperCase();
      sendJson(response, 200, {
        success: true,
        productId,
        points: history.getProductHistory(productId),
      });
      return;
    }

    await serveStatic(request.url ?? "/", response);
  } catch (error) {
    sendJson(response, 502, {
      success: false,
      error: error instanceof Error ? error.message : "Unknown server error",
    });
  }
}).listen(port, host, () => {
  console.log(`API server running at http://${host}:${port}`);
});
