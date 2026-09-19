import { createHash } from "node:crypto";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";

// Ordered by preference. Brotli first: these bodies are built once per upstream
// refresh and served to every client until the next one, so the slower
// compression is paid once while the smaller body is paid on every response.
const encoders = [
  ["br", (buffer) => brotliCompressSync(buffer, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } })],
  ["gzip", (buffer) => gzipSync(buffer, { level: 6 })],
];

const parseAcceptEncoding = (header) => {
  const accepted = new Set();

  for (const part of String(header ?? "").toLowerCase().split(",")) {
    const [name, ...params] = part.trim().split(";");
    if (!name) continue;
    // "br;q=0" means the client explicitly refuses brotli.
    const quality = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
    if (quality && Number(quality.slice(2)) === 0) continue;
    accepted.add(name.trim());
  }

  return accepted;
};

export const pickEncoding = (header) => {
  const accepted = parseAcceptEncoding(header);
  return encoders.find(([name]) => accepted.has(name))?.[0] ?? null;
};

const compress = (buffer, encoding) =>
  encoders.find(([name]) => name === encoding)?.[1](buffer) ?? buffer;

/**
 * Serializes a value once and compresses it lazily per encoding, keeping every
 * variant. Ten thousand requests between two upstream refreshes cost one
 * JSON.stringify and one brotli pass, not ten thousand of each.
 */
export const encodeBody = (value) => {
  const identity = Buffer.from(JSON.stringify(value));
  const etag = `W/"${createHash("sha1").update(identity).digest("base64url")}"`;
  const variants = new Map([["identity", identity]]);

  return {
    etag,
    variant: (encoding) => {
      if (!encoding) return { body: identity, encoding: null };
      if (!variants.has(encoding)) variants.set(encoding, compress(identity, encoding));
      return { body: variants.get(encoding), encoding };
    },
  };
};

/** Same lazy-per-encoding cache, for bytes that are already serialized. */
export const encodeBuffer = (identity) => {
  const variants = new Map([["identity", identity]]);
  return {
    etag: `W/"${createHash("sha1").update(identity).digest("base64url")}"`,
    variant: (encoding) => {
      if (!encoding) return { body: identity, encoding: null };
      if (!variants.has(encoding)) variants.set(encoding, compress(identity, encoding));
      return { body: variants.get(encoding), encoding };
    },
  };
};
