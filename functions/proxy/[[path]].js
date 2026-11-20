// Vega Web proxy — Cloudflare Pages Function.
// Path-based proxy so relative HLS segment URLs resolve correctly:
//   /proxy/<full-target-url>  e.g. /proxy/https://net52.cc/page?x=1
// The target is fetched server-side (no browser CORS) and returned with
// Access-Control-Allow-Origin: *. New route only — nothing else changes.

const HOP_HEADERS = new Set([
  "host",
  "origin",
  "referer",
  "connection",
  "content-length",
  "cookie",
  "cf-connecting-ip",
  "cf-ipcountry",
  "cf-ray",
  "cf-visitor",
  "x-forwarded-for",
  "x-forwarded-proto",
  "x-real-ip",
  "x-proxy-redirect",
]);

// Headers safe to pass back to the browser (no set-cookie: a stateless
// proxy must not leak target cookies into the site's own domain).
const PASS_HEADERS = new Set([
  "content-type",
  "content-length",
  "cache-control",
  "location",
  "accept-ranges",
  "content-range",
  "expires",
  "last-modified",
  "etag",
  "content-disposition",
  "content-language",
  "x-content-type-options",
]);

function isPrivateHost(host) {
  const h = String(host || "").toLowerCase();
  if (!h) return true;
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (h === "::1" || h === "0.0.0.0" || h === "[::1]") return true;
  if (h === "metadata.google.internal") return true;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const a = +m[1];
    const b = +m[2];
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a >= 224) return true; // multicast / reserved
  }
  return false;
}

function corsHeaders() {
  const h = new Headers();
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD");
  h.set("Access-Control-Allow-Headers", "*");
  h.set("Access-Control-Expose-Headers", "*");
  h.set("Access-Control-Max-Age", "86400");
  return h;
}

export async function onRequest(context) {
  const { request } = context;

  // CORS preflight from the browser.
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const url = new URL(request.url);
  let target = url.pathname.replace(/^\/proxy\/?/, "");
  try {
    target = decodeURIComponent(target);
  } catch {
    // Keep the raw (still-encoded) suffix if it is not valid encoding.
  }
  if (url.search) target += url.search;

  let targetUrl;
  try {
    targetUrl = new URL(target);
  } catch {
    return new Response("Bad target URL", { status: 400, headers: corsHeaders() });
  }
  if (targetUrl.protocol !== "http:" && targetUrl.protocol !== "https:") {
    return new Response("Only http/https targets are allowed", {
      status: 400,
      headers: corsHeaders(),
    });
  }
  if (isPrivateHost(targetUrl.hostname)) {
    return new Response("Target host not allowed", {
      status: 403,
      headers: corsHeaders(),
    });
  }

  // Forward request headers (minus hop-by-hop / identity headers).
  const fwd = new Headers();
  for (const [k, v] of request.headers) {
    if (!HOP_HEADERS.has(k.toLowerCase())) fwd.set(k, v);
  }
  if (!fwd.has("user-agent")) {
    fwd.set(
      "user-agent",
      "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
    );
  }
  if (!fwd.has("accept-language")) fwd.set("accept-language", "en-US,en;q=0.9");

  const manualRedirect =
    request.headers.get("x-proxy-redirect") === "manual";

  let upstream;
  try {
    upstream = await fetch(targetUrl.toString(), {
      method: request.method,
      headers: fwd,
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : request.body,
      redirect: manualRedirect ? "manual" : "follow",
    });
  } catch (e) {
    return new Response("Proxy fetch failed: " + (e && e.message ? e.message : e), {
      status: 502,
      headers: corsHeaders(),
    });
  }

  const out = corsHeaders();
  for (const [k, v] of upstream.headers) {
    if (PASS_HEADERS.has(k.toLowerCase())) out.set(k, v);
  }
  return new Response(upstream.body, { status: upstream.status, headers: out });
}
