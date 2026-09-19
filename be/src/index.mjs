import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { encodeBuffer, pickEncoding } from "./compress.mjs";
import { createHistoryStore } from "./history.mjs";
import { createPayloadCache, trimAuctions, trimBazaar } from "./payloads.mjs";

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
const staticCache = new Map();

const bazaarPayload = createPayloadCache(trimBazaar);
const auctionPayload = createPayloadCache(trimAuctions);

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

/**
 * Sends a body from encodeBody/encodeBuffer, negotiating compression and
 * answering 304 when the client already holds this exact payload.
 */
const sendEncoded = (request, response, encoded, { contentType, cacheControl }) => {
  if (request.headers["if-none-match"] === encoded.etag) {
    response.writeHead(304, { ETag: encoded.etag, Vary: "Accept-Encoding" });
    response.end();
    return;
  }

  const { body, encoding } = encoded.variant(pickEncoding(request.headers["accept-encoding"]));
  const headers = {
    "Content-Type": contentType,
    "Content-Length": body.length,
    "Cache-Control": cacheControl,
    ETag: encoded.etag,
    Vary: "Accept-Encoding",
  };
  if (encoding) headers["Content-Encoding"] = encoding;

  response.writeHead(200, headers);
  response.end(request.method === "HEAD" ? undefined : body);
};

const sendApi = (request, response, encoded) =>
  sendEncoded(request, response, encoded, {
    contentType: "application/json; charset=utf-8",
    // Clients poll on their own schedule; the upstream TTL is what actually
    // paces refreshes, so let a proxy hold this only as long as that.
    cacheControl: "public, max-age=30, must-revalidate",
  });

const fetchCached = async (key, url, ttlMs) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.cachedAt < ttlMs) return cached.body;

  const upstream = await fetch(url);
  if (!upstream.ok) {
    throw new Error(`Hypixel returned ${upstream.status}`);
  }

  const body = await upstream.json();
  cache.set(key, { cachedAt: Date.now(), body });
  return body;
};

const serveStatic = async (request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = normalize(join(distDir, requested));

  if (!filePath.startsWith(distDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  let path = filePath;
  let cached = staticCache.get(path);

  if (!cached) {
    let content;
    try {
      content = await readFile(path);
    } catch {
      // The SPA owns client-side routing, so an unknown path falls back to the
      // shell. Anything under /assets is a real file request, and a miss there
      // is a broken build rather than a route.
      if (requested.startsWith("/assets/")) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }
      path = join(distDir, "index.html");
      cached = staticCache.get(path);
      if (!cached) content = await readFile(path);
    }

    if (!cached) {
      cached = encodeBuffer(content);
      staticCache.set(path, cached);
    }
  }

  sendEncoded(request, response, cached, {
    contentType: contentTypes[extname(path)] ?? "application/octet-stream",
    // Vite fingerprints asset filenames, so those are immutable. The shell is
    // not, and must be revalidated or clients pin themselves to an old build.
    cacheControl: path.includes("assets") ? "public, max-age=31536000, immutable" : "no-cache",
  });
};

createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);

    if (url.pathname === "/api/health") {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (url.pathname === "/api/bazaar") {
      const upstream = await fetchCached("bazaar", hypixel.bazaar, 60_000);
      history.recordSnapshot(upstream);
      sendApi(request, response, bazaarPayload(upstream));
      return;
    }

    if (url.pathname === "/api/auctions") {
      const page = Math.max(0, Number(url.searchParams.get("page") ?? 0) || 0);
      const upstream = await fetchCached(
        `auctions:${page}`,
        `${hypixel.auctions}?page=${page}`,
        60_000,
      );
      sendApi(request, response, auctionPayload(upstream, `auctions:${page}`));
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

    await serveStatic(request, response);
  } catch (error) {
    // serveStatic may already have written headers, and writing a second set
    // throws inside the handler and kills the socket.
    if (response.headersSent) {
      response.end();
      return;
    }
    sendJson(response, 502, {
      success: false,
      error: error instanceof Error ? error.message : "Unknown server error",
    });
  }
}).listen(port, host, () => {
  console.log(`API server running at http://${host}:${port}`);
});
