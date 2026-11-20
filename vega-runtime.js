/* Vega Web runtime — loads Vega provider bundles (Nadan-Prinda/vega-providers)
 * in the browser and runs them against a same-origin proxy.
 * Providers are the user's own repo code; they run in page context (not
 * isolated like the mobile app's sandbox worker) — v1 tradeoff, noted in UI.
 */
(function () {
  "use strict";

  var PROXY_BASE = "/proxy/";
  var DEFAULT_AUTHOR = "Nadan-Prinda";

  function cdnGh(author, path) {
    return "https://cdn.jsdelivr.net/gh/" + author + "/vega-providers@main/" + path;
  }
  function rawGh(author, path) {
    return "https://raw.githubusercontent.com/" + author + "/vega-providers/refs/heads/main/" + path;
  }

  /* ---------------- small utils ---------------- */
  function bytesToHex(bytes) {
    var s = "";
    for (var i = 0; i < bytes.length; i++) {
      var h = bytes[i].toString(16);
      s += h.length === 1 ? "0" + h : h;
    }
    return s;
  }
  function bytesToB64(bytes) {
    var s = "";
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }
  function b64ToBytes(b64) {
    var clean = String(b64).replace(/\s/g, "");
    var bin = atob(clean);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function hexToBytes(hex) {
    var clean = String(hex).replace(/\s/g, "");
    var out = new Uint8Array(Math.floor(clean.length / 2));
    for (var i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
    return out;
  }
  function isHttpUrl(u) {
    return typeof u === "string" && /^https?:\/\//i.test(u);
  }
  function proxyUrl(target) {
    return PROXY_BASE + target;
  }
  function proxifyImage(u) {
    if (!u) return "";
    if (u.indexOf("//") === 0) u = "https:" + u;
    // http:// images are blocked as mixed content on an https page — route via proxy.
    if (u.indexOf("http://") === 0) return proxyUrl(u);
    return u;
  }

  /* ---------------- proxy fetch ----------------
   * Same shape as fetch(); routes the request through /proxy/<target-url>.
   * Returns a real Response whose .url is the TARGET url (not the proxy url). */
  async function proxyFetch(input, init) {
    init = init || {};
    var url = typeof input === "string" ? input : input.url;
    var method = ((init.method || (typeof input !== "string" && input.method) || "GET") + "").toUpperCase();
    var headers = {};
    var collect = function (h) {
      if (!h) return;
      if (typeof h.forEach === "function") h.forEach(function (v, k) { headers[k] = v; });
      else if (Array.isArray(h)) h.forEach(function (p) { headers[p[0]] = p[1]; });
      else for (var k in h) headers[k] = h[k];
    };
    collect(init.headers);
    if (typeof input !== "string") collect(input.headers);
    if (init.redirect === "manual") headers["x-proxy-redirect"] = "manual";
    var body = init.body !== undefined ? init.body : (typeof input !== "string" ? input.body : undefined);
    if (body instanceof URLSearchParams) body = body.toString();
    var res = await fetch(proxyUrl(url), {
      method: method,
      headers: headers,
      body: method === "GET" || method === "HEAD" ? undefined : body,
      signal: init.signal,
      redirect: "follow",
    });
    try {
      Object.defineProperty(res, "url", { value: url });
    } catch (e) { /* ignore */ }
    return res;
  }

  /* ---------------- axios over the proxy ---------------- */
  function createProxyAxios() {
    var axios = (typeof window !== "undefined" ? window : globalThis).__vegaVendor.axios;
    var instance = axios.create();
    instance.defaults.adapter = async function (config) {
      var url = config.url || "";
      if (config.baseURL && !/^https?:/i.test(url)) {
        url = config.baseURL.replace(/\/+$/, "") + "/" + url.replace(/^\/+/, "");
      }
      if (config.params) {
        var q = new URLSearchParams(config.params).toString();
        if (q) url += (url.indexOf("?") === -1 ? "?" : "&") + q;
      }
      var headers = {};
      if (config.headers) {
        if (typeof config.headers.forEach === "function") {
          config.headers.forEach(function (v, k) { headers[k] = v; });
        } else {
          for (var k in config.headers) headers[k] = config.headers[k];
        }
      }
      var body;
      if (config.data != null) {
        if (typeof config.data === "string" || config.data instanceof Uint8Array || config.data instanceof ArrayBuffer) {
          body = config.data;
        } else if (config.data instanceof URLSearchParams) {
          body = config.data.toString();
        } else if (typeof FormData !== "undefined" && config.data instanceof FormData) {
          body = config.data;
        } else {
          body = JSON.stringify(config.data);
        }
      }
      var controller = new AbortController();
      var timer = null;
      if (config.timeout) {
        timer = setTimeout(function () { controller.abort(); }, config.timeout);
      }
      if (config.signal) {
        if (config.signal.aborted) controller.abort();
        else config.signal.addEventListener("abort", function () { controller.abort(); }, { once: true });
      }
      var res;
      try {
        res = await proxyFetch(url, {
          method: (config.method || "get").toUpperCase(),
          headers: headers,
          body: body,
          signal: controller.signal,
          redirect: config.maxRedirects === 0 ? "manual" : "follow",
        });
      } catch (e) {
        if (timer) clearTimeout(timer);
        var err = new Error(e && e.name === "AbortError" ? "timeout of " + (config.timeout || 0) + "ms exceeded" : (e && e.message) || String(e));
        err.config = config;
        err.isAxiosError = true;
        err.code = e && e.name === "AbortError" ? "ECONNABORTED" : "ERR_NETWORK";
        throw err;
      }
      if (timer) clearTimeout(timer);
      var respHeaders = {};
      res.headers.forEach(function (v, k) { respHeaders[k] = v; });
      var data;
      if (config.responseType === "arraybuffer") {
        data = await res.arrayBuffer();
      } else if (config.responseType === "blob") {
        data = await res.blob();
      } else {
        var text = await res.text();
        if (config.responseType === "text") {
          data = text;
        } else {
          try { data = text ? JSON.parse(text) : ""; } catch (e) { data = text; }
        }
      }
      var result = {
        data: data,
        status: res.status,
        statusText: res.statusText,
        headers: respHeaders,
        config: config,
        request: { url: url, responseURL: url, res: { responseUrl: url } },
      };
      var ok = config.validateStatus
        ? config.validateStatus(res.status)
        : res.status >= 200 && res.status < 300;
      if (!ok) {
        var httpErr = new Error("Request failed with status code " + res.status);
        httpErr.response = result;
        httpErr.config = config;
        httpErr.isAxiosError = true;
        throw httpErr;
      }
      return result;
    };
    return instance;
  }

  /* ---------------- Crypto (expo-crypto shape) ---------------- */
  var Crypto = Object.freeze({
    CryptoDigestAlgorithm: Object.freeze({ SHA1: "SHA-1", SHA256: "SHA-256", SHA384: "SHA-384", SHA512: "SHA-512", MD5: "MD5" }),
    CryptoEncoding: Object.freeze({ HEX: "hex", BASE64: "base64" }),
    digestStringAsync: async function (algorithm, data, options) {
      var alg = { "SHA-1": "SHA-1", "SHA-256": "SHA-256", "SHA-384": "SHA-384", "SHA-512": "SHA-512" }[algorithm];
      if (!alg) throw new Error("Digest algorithm not supported on web: " + algorithm);
      var buf = await crypto.subtle.digest(alg, new TextEncoder().encode(data));
      var bytes = new Uint8Array(buf);
      var enc = options && (options.encoding || options.Encoding);
      return enc === "base64" ? bytesToB64(bytes) : bytesToHex(bytes);
    },
    getRandomBytesAsync: async function (byteCount) {
      var a = new Uint8Array(byteCount);
      crypto.getRandomValues(a);
      return a;
    },
    randomUUID: function () {
      return crypto.randomUUID();
    },
  });

  /* ---------------- Buffer shim (some dist bundles use Buffer) ---------------- */
  var BufferShim = {
    from: function (input, encoding) {
      var bytes;
      if (typeof input === "string") {
        if (encoding === "base64") bytes = b64ToBytes(input);
        else if (encoding === "binary" || encoding === "latin1") {
          bytes = new Uint8Array(input.length);
          for (var i = 0; i < input.length; i++) bytes[i] = input.charCodeAt(i) & 0xff;
        } else if (encoding === "hex") bytes = hexToBytes(input);
        else bytes = new TextEncoder().encode(input);
      } else if (input instanceof Uint8Array) {
        bytes = input;
      } else if (Array.isArray(input)) {
        bytes = Uint8Array.from(input);
      } else if (input instanceof ArrayBuffer) {
        bytes = new Uint8Array(input);
      } else {
        bytes = new Uint8Array(0);
      }
      var out = bytes;
      out.toString = function (enc) {
        if (enc === "base64") return bytesToB64(out);
        if (enc === "hex") return bytesToHex(out);
        if (enc === "binary" || enc === "latin1") {
          var s = "";
          for (var j = 0; j < out.length; j++) s += String.fromCharCode(out[j]);
          return s;
        }
        return new TextDecoder().decode(out);
      };
      return out;
    },
    isView: function (x) { return ArrayBuffer.isView(x); },
    isBuffer: function (x) { return x instanceof Uint8Array; },
    alloc: function (n, fill) {
      var a = new Uint8Array(n);
      if (fill !== undefined) a.fill(fill);
      return a;
    },
    concat: function (list) {
      var len = 0;
      list.forEach(function (b) { len += b.length; });
      var o = new Uint8Array(len);
      var off = 0;
      list.forEach(function (b) { o.set(b, off); off += b.length; });
      return o;
    },
  };

  /* ---------------- __awaiter (TS helper, same as the app's runtimeSupport) ---------------- */
  function __awaiter(thisArg, args, PromiseCtor, generator) {
    var Constructor = PromiseCtor || Promise;
    function adopt(v) {
      return v instanceof Constructor ? v : new Constructor(function (r) { r(v); });
    }
    return new Constructor(function (resolve, reject) {
      function fulfilled(v) { try { step(it.next(v)); } catch (e) { reject(e); } }
      function rejected(v) { try { step(it.throw(v)); } catch (e) { reject(e); } }
      function step(r) {
        if (r.done) resolve(r.value);
        else adopt(r.value).then(fulfilled, rejected);
      }
      var it = generator.apply(thisArg, args || []);
      step(it.next());
    });
  }

  /* ---------------- common headers (copied from the app) ---------------- */
  var COMMON_HEADERS = {
    "sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    "sec-ch-ua-mobile": "?1",
    "sec-ch-ua-platform": '"Android"',
    "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
  };

  /* ---------------- urls.json (getBaseUrl) ---------------- */
  var urlsCache = null;
  var urlsCacheAt = 0;
  async function fetchUrls(author) {
    if (urlsCache && Date.now() - urlsCacheAt < 3600000) return urlsCache;
    var res = await fetch(rawGh(author, "urls.json"));
    if (!res.ok) throw new Error("urls.json HTTP " + res.status);
    urlsCache = await res.json();
    urlsCacheAt = Date.now();
    return urlsCache;
  }
  async function getBaseUrl(author, providerValue) {
    try {
      var map = await fetchUrls(author);
      if (map[providerValue] && map[providerValue].url) return map[providerValue].url;
      var lower = String(providerValue).toLowerCase();
      for (var k in map) {
        if (k.toLowerCase() === lower && map[k].url) return map[k].url;
      }
      return "";
    } catch (e) {
      return "";
    }
  }

  /* ---------------- kvStore (localStorage, per provider) ---------------- */
  function makeKvStore(providerValue) {
    var prefix = "vegaweb:kv:" + providerValue + ":";
    function ls() {
      try { return window.localStorage; } catch (e) { return null; }
    }
    return {
      get: async function (key) {
        var store = ls();
        if (!store) return undefined;
        var raw = store.getItem(prefix + key);
        return raw === null ? undefined : JSON.parse(raw);
      },
      set: async function (key, value) {
        var store = ls();
        if (store) store.setItem(prefix + key, JSON.stringify(value));
      },
      delete: async function (key) {
        var store = ls();
        if (!store) return false;
        var had = store.getItem(prefix + key) !== null;
        store.removeItem(prefix + key);
        return had;
      },
      keys: async function () {
        var store = ls();
        var out = [];
        if (!store) return out;
        for (var i = 0; i < store.length; i++) {
          var k = store.key(i);
          if (k && k.indexOf(prefix) === 0) out.push(k.slice(prefix.length));
        }
        return out;
      },
      clear: async function () {
        var store = ls();
        if (!store) return;
        var ks = [];
        for (var i = 0; i < store.length; i++) {
          var k = store.key(i);
          if (k && k.indexOf(prefix) === 0) ks.push(k);
        }
        ks.forEach(function (k) { store.removeItem(k); });
      },
    };
  }

  /* ---------------- provider module loading ---------------- */
  var proxyAxios = null;
  function getAxios() {
    if (!proxyAxios) proxyAxios = createProxyAxios();
    return proxyAxios;
  }
  function getCheerio() {
    return (typeof window !== "undefined" ? window : globalThis).__vegaVendor.cheerio;
  }

  var providerContexts = {};
  var providerGlobals = {};
  function getProviderContext(author, value) {
    var key = author + "/" + value;
    if (!providerContexts[key]) {
      providerContexts[key] = Object.freeze({
        axios: getAxios(),
        cheerio: getCheerio(),
        Crypto: Crypto,
        commonHeaders: COMMON_HEADERS,
        getBaseUrl: function (pv) { return getBaseUrl(author, pv); },
        openWebView: async function () {
          throw new Error("WebView WAF solving web par supported nahi hai — ye site browser se nahi khul sakti.");
        },
        getCookies: async function () { return {}; },
        kvStore: makeKvStore(value),
      });
    }
    return providerContexts[key];
  }
  function getProviderGlobal(value) {
    if (!providerGlobals[value]) providerGlobals[value] = {};
    return providerGlobals[value];
  }

  function evalModule(code, context, providerGlobal) {
    var exports = {};
    var module = { exports: exports };
    var fn = new Function(
      "exports", "module", "require", "console", "Promise",
      "setTimeout", "clearTimeout", "setInterval", "clearInterval",
      "fetch", "__awaiter", "providerGlobal", "Buffer",
      "globalThis", "self", "postMessage", "XMLHttpRequest", "WebSocket",
      "EventSource", "Worker", "SharedWorker", "BroadcastChannel",
      "indexedDB", "caches", "importScripts",
      '"use strict";\n' + code
    );
    fn(
      exports, module, function () { return {}; }, console, Promise,
      setTimeout, clearTimeout, setInterval, clearInterval,
      proxyFetch, __awaiter, providerGlobal, BufferShim,
      undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, undefined, undefined
    );
    return module.exports;
  }

  var moduleCache = {};
  function distUrl(author, value, file) {
    // raw.githubusercontent (not jsDelivr): jsDelivr caches @main for hours
    // and served a stale 68-entry manifest after the 71-entry push.
    return rawGh(author, "dist/" + value + "/" + file);
  }
  async function fetchText(url) {
    var res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status + " — " + url);
    return res.text();
  }
  async function loadProviderModule(author, value, file) {
    var key = author + "/" + value + "/" + file;
    if (moduleCache[key]) return moduleCache[key];
    var code = await fetchText(distUrl(author, value, file));
    var mod = evalModule(code, getProviderContext(author, value), getProviderGlobal(value));
    moduleCache[key] = mod;
    return mod;
  }
  async function callProvider(author, value, file, exportName, args) {
    var mod = await loadProviderModule(author, value, file);
    var fn = mod[exportName];
    if (typeof fn !== "function") {
      throw new Error("Provider '" + value + "' mein " + exportName + " nahi mila");
    }
    var signal = new AbortController().signal;
    return fn(Object.assign({}, args, {
      signal: signal,
      providerContext: getProviderContext(author, value),
    }));
  }
  async function readCatalogExport(mod, context, providerGlobal) {
    var out = {};
    for (var k of ["catalog", "genres"]) {
      var v = mod[k];
      if (typeof v === "function") {
        v = await v({ signal: new AbortController().signal, providerContext: context });
      }
      out[k] = Array.isArray(v) ? v : [];
    }
    return out;
  }

  /* ---------------- public provider API ---------------- */
  async function loadManifest(author) {
    // raw.githubusercontent (not jsDelivr): jsDelivr cached a stale manifest.
    var res = await fetch(rawGh(author, "manifest.json"));
    if (!res.ok) throw new Error("Manifest nahi mila (HTTP " + res.status + ") — source code ghalat ho sakta hai.");
    var list = await res.json();
    if (!Array.isArray(list)) throw new Error("Manifest samajh nahi aaya.");
    return list;
  }

  async function getCatalog(author, value) {
    var mod = await loadProviderModule(author, value, "catalog.js");
    return readCatalogExport(mod, getProviderContext(author, value), getProviderGlobal(value));
  }
  async function getPosts(author, value, filter, page) {
    return callProvider(author, value, "posts.js", "getPosts", {
      filter: filter, page: page || 1, providerValue: value,
    });
  }
  async function searchPosts(author, value, query, page) {
    return callProvider(author, value, "posts.js", "getSearchPosts", {
      searchQuery: query, page: page || 1, providerValue: value,
    });
  }
  async function getMeta(author, value, link) {
    return callProvider(author, value, "meta.js", "getMeta", {
      link: link, provider: value,
    });
  }
  async function getEpisodes(author, value, url) {
    return callProvider(author, value, "episodes.js", "getEpisodes", { url: url });
  }
  async function getStreams(author, value, link, type) {
    return callProvider(author, value, "stream.js", "getStream", {
      link: link, type: type || "movie", isDownload: false,
    });
  }
  // Seed provider settings defaults into kvStore (best effort; settings.js may not exist).
  async function seedSettings(author, value) {
    try {
      var mod = await loadProviderModule(author, value, "settings.js");
      if (mod && typeof mod.getSettingsSchema === "function") {
        var schema = await mod.getSettingsSchema({ providerContext: getProviderContext(author, value) });
        var kv = getProviderContext(author, value).kvStore;
        for (var i = 0; i < (schema || []).length; i++) {
          var f = schema[i];
          if (f && f.key && f.defaultValue !== undefined) {
            var cur = await kv.get(f.key);
            if (cur === undefined) await kv.set(f.key, f.defaultValue);
          }
        }
      }
    } catch (e) { /* no settings — fine */ }
  }

  /* ---------------- HLS proxy loader (retry path) ---------------- */
  function createHlsProxyLoader() {
    if (typeof window === "undefined" || !window.Hls || !Hls.DefaultConfig || !Hls.DefaultConfig.loader) return null;
    var Base = Hls.DefaultConfig.loader;
    function ProxyLoader(config) { Base.call(this, config); }
    ProxyLoader.prototype = Object.create(Base.prototype);
    ProxyLoader.prototype.constructor = ProxyLoader;
    ProxyLoader.prototype.load = function (context, config, callbacks) {
      if (/^https?:\/\//i.test(context.url) && context.url.indexOf("/proxy/") === -1) {
        context.url = proxyUrl(context.url);
      }
      return Base.prototype.load.call(this, context, config, callbacks);
    };
    return ProxyLoader;
  }

  /* ---------------- watch progress (localStorage) ---------------- */
  function progressKey(link) {
    return "vegaweb:progress:" + encodeURIComponent(String(link)).slice(0, 200);
  }
  function getProgress(link) {
    try {
      var raw = window.localStorage.getItem(progressKey(link));
      var n = raw === null ? 0 : parseFloat(raw);
      return isFinite(n) && n > 0 ? n : 0;
    } catch (e) { return 0; }
  }
  function setProgress(link, seconds) {
    try {
      if (seconds > 5) window.localStorage.setItem(progressKey(link), String(Math.floor(seconds)));
      else window.localStorage.removeItem(progressKey(link));
    } catch (e) { /* ignore */ }
  }
  function clearProgress(link) {
    try { window.localStorage.removeItem(progressKey(link)); } catch (e) { /* ignore */ }
  }

  var LIVE_TV = [
    { name: "DW English", cat: "News \u2022 English", url: "https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8" },
    { name: "NASA TV", cat: "Science \u2022 English", url: "https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8" },
    { name: "8XM", cat: "Music \u2022 Pakistani", mobileOnly: true, url: "http://116.90.120.149:8000/play/a0tw/index.m3u8" },
  ];

  var api = {
    DEFAULT_AUTHOR: DEFAULT_AUTHOR,
    LIVE_TV: LIVE_TV,
    loadManifest: loadManifest,
    getCatalog: getCatalog,
    getPosts: getPosts,
    searchPosts: searchPosts,
    getMeta: getMeta,
    getEpisodes: getEpisodes,
    getStreams: getStreams,
    seedSettings: seedSettings,
    proxyUrl: proxyUrl,
    proxifyImage: proxifyImage,
    proxyFetch: proxyFetch,
    createHlsProxyLoader: createHlsProxyLoader,
    getProgress: getProgress,
    setProgress: setProgress,
    clearProgress: clearProgress,
    setProxyBase: function (base) { PROXY_BASE = base; },
    getProxyBase: function () { return PROXY_BASE; },
  };

  if (typeof window !== "undefined") window.VegaWeb = api;
  else globalThis.VegaWeb = api;
})();
