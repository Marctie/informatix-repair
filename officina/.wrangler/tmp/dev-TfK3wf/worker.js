var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../node_modules/hono/dist/request/constants.js
var GET_MATCH_RESULT = /* @__PURE__ */ Symbol();

// ../node_modules/hono/dist/utils/buffer.js
var bufferToFormData = /* @__PURE__ */ __name((arrayBuffer, contentType) => {
  return new Response(arrayBuffer, { headers: { "Content-Type": contentType.replace(/^[^;]+/, (mediaType) => mediaType.toLowerCase()) } }).formData();
}, "bufferToFormData");

// ../node_modules/hono/dist/utils/body.js
var MAX_NESTED_OBJECTS = 1e4;
var isRawRequest = /* @__PURE__ */ __name((request) => "headers" in request, "isRawRequest");
var parseBody = /* @__PURE__ */ __name(async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const mediaType = (isRawRequest(request) ? request.headers : request.raw.headers).get("Content-Type")?.split(";")[0].trim().toLowerCase();
  if (mediaType === "multipart/form-data" || mediaType === "application/x-www-form-urlencoded") return parseFormData(request, {
    all,
    dot
  });
  return {};
}, "parseBody");
async function parseFormData(request, options) {
  if (!isRawRequest(request) && request.bodyCache.formData) return convertFormDataToBodyData(await request.bodyCache.formData, options);
  const headers = isRawRequest(request) ? request.headers : request.raw.headers;
  const arrayBuffer = await request.arrayBuffer();
  const formDataPromise = bufferToFormData(arrayBuffer, headers.get("Content-Type") || "");
  if (!isRawRequest(request)) request.bodyCache.formData = formDataPromise;
  const formData = await formDataPromise;
  if (formData) return convertFormDataToBodyData(formData, options);
  return {};
}
__name(parseFormData, "parseFormData");
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  const nestingState = { count: 0 };
  formData.forEach((value, key) => {
    if (!(options.all || key.endsWith("[]"))) form[key] = value;
    else handleParsingAllValues(form, key, value);
  });
  if (options.dot) Object.entries(form).forEach(([key, value]) => {
    if (key.includes(".")) {
      handleParsingNestedValues(form, key, value, nestingState);
      delete form[key];
    }
  });
  return form;
}
__name(convertFormDataToBodyData, "convertFormDataToBodyData");
var handleParsingAllValues = /* @__PURE__ */ __name((form, key, value) => {
  if (form[key] !== void 0) {
    if (Array.isArray(form[key])) form[key].push(value);
    else form[key] = [form[key], value];
  } else if (!key.endsWith("[]")) form[key] = value;
  else form[key] = [value];
}, "handleParsingAllValues");
var handleParsingNestedValues = /* @__PURE__ */ __name((form, key, value, state) => {
  if (/(?:^|\.)__proto__\./.test(key)) return;
  let nestedForm = form;
  const keys = key.split(".", 34);
  if (keys.length > 33) throwNestingLimitExceeded();
  keys.forEach((key2, index) => {
    if (index === keys.length - 1) nestedForm[key2] = value;
    else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        if (state.count++ >= MAX_NESTED_OBJECTS) throwNestingLimitExceeded();
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
}, "handleParsingNestedValues");
var throwNestingLimitExceeded = /* @__PURE__ */ __name(() => {
  throw new Error("Nesting limit exceeded");
}, "throwNestingLimitExceeded");

// ../node_modules/hono/dist/utils/url.js
var splitPath = /* @__PURE__ */ __name((path) => {
  const paths = path.split("/");
  if (paths[0] === "") paths.shift();
  return paths;
}, "splitPath");
var splitRoutingPath = /* @__PURE__ */ __name((routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
}, "splitRoutingPath");
var extractGroupsFromPath = /* @__PURE__ */ __name((path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match2, index) => {
    const mark = `@${index}`;
    groups.push([mark, match2]);
    return mark;
  });
  return {
    groups,
    path
  };
}, "extractGroupsFromPath");
var replaceGroupMarks = /* @__PURE__ */ __name((paths, groups) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1; j >= 0; j--) if (paths[j].includes(mark)) {
      paths[j] = paths[j].replace(mark, groups[i][1]);
      break;
    }
  }
  return paths;
}, "replaceGroupMarks");
var patternCache = {};
var getPattern = /* @__PURE__ */ __name((label, next) => {
  if (label === "*") return "*";
  const match2 = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match2) {
    const cacheKey = `${label}#${next}`;
    if (!patternCache[cacheKey]) {
      if (match2[2]) patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [
        cacheKey,
        match2[1],
        new RegExp(`^${match2[2]}(?=/${next})`)
      ] : [
        label,
        match2[1],
        new RegExp(`^${match2[2]}$`)
      ];
      else patternCache[cacheKey] = [
        label,
        match2[1],
        true
      ];
    }
    return patternCache[cacheKey];
  }
  return null;
}, "getPattern");
var tryDecode = /* @__PURE__ */ __name((str3, decoder) => {
  try {
    return decoder(str3);
  } catch {
    return str3.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match2) => {
      try {
        return decoder(match2);
      } catch {
        return match2;
      }
    });
  }
}, "tryDecode");
var tryDecodeURI = /* @__PURE__ */ __name((str3) => tryDecode(str3, decodeURI), "tryDecodeURI");
var getPath = /* @__PURE__ */ __name((request) => {
  const url = request.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i = start;
  for (; i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const hashIndex = url.indexOf("#", i);
      const end = queryIndex === -1 ? hashIndex === -1 ? void 0 : hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
      const path = url.slice(start, end);
      return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
    } else if (charCode === 63 || charCode === 35) break;
  }
  return url.slice(start, i);
}, "getPath");
var getPathNoStrict = /* @__PURE__ */ __name((request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
}, "getPathNoStrict");
var mergePath = /* @__PURE__ */ __name((base, sub, ...rest) => {
  if (rest.length) sub = mergePath(sub, ...rest);
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
}, "mergePath");
var checkOptionalParameter = /* @__PURE__ */ __name((path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) return null;
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) basePath += "/" + segment;
    else if (/\:/.test(segment)) {
      if (segment.charCodeAt(segment.length - 1) === 63) {
        if (results.length === 0 && basePath === "") results.push("/");
        else results.push(basePath);
        const optionalSegment = segment.slice(0, -1);
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else basePath += "/" + segment;
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
}, "checkOptionalParameter");
var tryDecodeURIComponent = /* @__PURE__ */ __name((str3) => str3.indexOf("%") !== -1 ? tryDecode(str3, decodeURIComponent_) : str3, "tryDecodeURIComponent");
var _decodeURI = /* @__PURE__ */ __name((value) => {
  if (value.indexOf("+") !== -1) value = value.replace(/\+/g, " ");
  return tryDecodeURIComponent(value);
}, "_decodeURI");
var _getQueryParam = /* @__PURE__ */ __name((url, key, multiple) => {
  const hashIndex = url.indexOf("#", 8);
  if (hashIndex !== -1) url = url.slice(0, hashIndex);
  let encoded;
  if (!multiple && key && key.indexOf("%") === -1 && key.indexOf("+") === -1) {
    let keyIndex2 = url.indexOf("?", 8);
    if (keyIndex2 === -1) return;
    if (!url.startsWith(key, keyIndex2 + 1)) keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) return "";
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) return;
  }
  const results = /* @__PURE__ */ Object.create(null);
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) valueIndex = -1;
    let name = url.slice(keyIndex + 1, valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex);
    if (encoded) name = _decodeURI(name);
    keyIndex = nextKeyIndex;
    if (name === "") continue;
    let value;
    if (valueIndex === -1) value = "";
    else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) value = _decodeURI(value);
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) results[name] = [];
      results[name].push(value);
    } else results[name] ??= value;
  }
  return key ? results[key] : results;
}, "_getQueryParam");
var getQueryParam = _getQueryParam;
var getQueryParams = /* @__PURE__ */ __name((url, key) => {
  return _getQueryParam(url, key, true);
}, "getQueryParams");
var decodeURIComponent_ = decodeURIComponent;

// ../node_modules/hono/dist/request.js
var HonoRequest = class {
  static {
    __name(this, "HonoRequest");
  }
  /**
  * `.raw` can get the raw Request object.
  *
  * @see {@link https://hono.dev/docs/api/request#raw}
  *
  * @example
  * ```ts
  * // For Cloudflare Workers
  * app.post('/', async (c) => {
  *   const metadata = c.req.raw.cf?.hostMetadata?
  *   ...
  * })
  * ```
  */
  raw;
  #validatedData;
  #matchResult;
  routeIndex = 0;
  /**
  * `.path` can get the pathname of the request.
  *
  * @see {@link https://hono.dev/docs/api/request#path}
  *
  * @example
  * ```ts
  * app.get('/about/me', (c) => {
  *   const pathname = c.req.path // `/about/me`
  * })
  * ```
  */
  path;
  bodyCache = {};
  constructor(request, path = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path;
    this.#matchResult = matchResult;
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex]?.[1][key];
    const param = this.#getParamValue(paramKey);
    return param && tryDecodeURIComponent(param);
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex]?.[1] ?? {});
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value !== void 0) decoded[key] = tryDecodeURIComponent(value);
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) return this.raw.headers.get(name) ?? void 0;
    const headerData = /* @__PURE__ */ Object.create(null);
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return parseBody(this, options);
  }
  #cachedBody = /* @__PURE__ */ __name((key) => {
    const { bodyCache, raw: raw2 } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) return cachedBody;
    for (const anyCachedKey in bodyCache) return bodyCache[anyCachedKey].then((body) => {
      if (anyCachedKey === "json") body = JSON.stringify(body);
      const contentType = anyCachedKey === "formData" ? void 0 : raw2.headers.get("content-type");
      return new Response(body, { headers: contentType ? { "Content-Type": contentType } : void 0 })[key]();
    });
    return bodyCache[key] = raw2[key]();
  }, "#cachedBody");
  /**
  * `.json()` can parse Request body of type `application/json`
  *
  * @see {@link https://hono.dev/docs/api/request#json}
  *
  * @example
  * ```ts
  * app.post('/entry', async (c) => {
  *   const body = await c.req.json()
  * })
  * ```
  */
  json() {
    return this.#cachedBody("text").then((text) => JSON.parse(text));
  }
  /**
  * `.text()` can parse Request body of type `text/plain`
  *
  * @see {@link https://hono.dev/docs/api/request#text}
  *
  * @example
  * ```ts
  * app.post('/entry', async (c) => {
  *   const body = await c.req.text()
  * })
  * ```
  */
  text() {
    return this.#cachedBody("text");
  }
  /**
  * `.arrayBuffer()` parse Request body as an `ArrayBuffer`
  *
  * @see {@link https://hono.dev/docs/api/request#arraybuffer}
  *
  * @example
  * ```ts
  * app.post('/entry', async (c) => {
  *   const body = await c.req.arrayBuffer()
  * })
  * ```
  */
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  /**
  * `.bytes()` parses the request body as a `Uint8Array`.
  *
  * @see {@link https://hono.dev/docs/api/request#bytes}
  *
  * @example
  * ```ts
  * app.post('/entry', async (c) => {
  *   const body = await c.req.bytes()
  * })
  * ```
  */
  bytes() {
    return this.#cachedBody("arrayBuffer").then((buffer) => new Uint8Array(buffer));
  }
  /**
  * Parses the request body as a `Blob`.
  * @example
  * ```ts
  * app.post('/entry', async (c) => {
  *   const body = await c.req.blob();
  * });
  * ```
  * @see https://hono.dev/docs/api/request#blob
  */
  blob() {
    return this.#cachedBody("blob");
  }
  /**
  * Parses the request body as `FormData`.
  * @example
  * ```ts
  * app.post('/entry', async (c) => {
  *   const body = await c.req.formData();
  * });
  * ```
  * @see https://hono.dev/docs/api/request#formdata
  */
  formData() {
    return this.#cachedBody("formData");
  }
  /**
  * Adds validated data to the request.
  *
  * @param target - The target of the validation.
  * @param data - The validated data to add.
  */
  addValidatedData(target, data) {
    (this.#validatedData ??= {})[target] = data;
  }
  valid(target) {
    return this.#validatedData?.[target];
  }
  /**
  * `.url` can get the request url strings.
  *
  * @see {@link https://hono.dev/docs/api/request#url}
  *
  * @example
  * ```ts
  * app.get('/about/me', (c) => {
  *   const url = c.req.url // `http://localhost:8787/about/me`
  *   ...
  * })
  * ```
  */
  get url() {
    return this.raw.url;
  }
  /**
  * `.method` can get the method name of the request.
  *
  * @see {@link https://hono.dev/docs/api/request#method}
  *
  * @example
  * ```ts
  * app.get('/about/me', (c) => {
  *   const method = c.req.method // `GET`
  * })
  * ```
  */
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  /**
  * `.matchedRoutes` can return a matched route in the handler
  *
  * @deprecated
  *
  * Use matchedRoutes helper defined in "hono/route" instead.
  *
  * @see {@link https://hono.dev/docs/api/request#matchedroutes}
  *
  * @example
  * ```ts
  * app.use('*', async function logger(c, next) {
  *   await next()
  *   c.req.matchedRoutes.forEach(({ handler, method, path }, i) => {
  *     const name = handler.name || (handler.length < 2 ? '[handler]' : '[middleware]')
  *     console.log(
  *       method,
  *       ' ',
  *       path,
  *       ' '.repeat(Math.max(10 - path.length, 0)),
  *       name,
  *       i === c.req.routeIndex ? '<- respond from here' : ''
  *     )
  *   })
  * })
  * ```
  */
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  /**
  * `.routePath` can retrieve the path registered within the handler
  *
  * @deprecated
  *
  * Use routePath helper defined in "hono/route" instead.
  *
  * @see {@link https://hono.dev/docs/api/request#routepath}
  *
  * @example
  * ```ts
  * app.get('/posts/:id', (c) => {
  *   return c.json({ path: c.req.routePath })
  * })
  * ```
  */
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
};

// ../node_modules/hono/dist/utils/html.js
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = /* @__PURE__ */ __name((value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
}, "raw");
var resolveCallback = /* @__PURE__ */ __name(async (str3, phase, preserveCallbacks, context, buffer) => {
  if (typeof str3 === "object" && !(str3 instanceof String)) {
    if (!(str3 instanceof Promise)) str3 = str3.toString();
    if (str3 instanceof Promise) str3 = await str3;
  }
  const callbacks = str3.callbacks;
  if (!callbacks?.length) return Promise.resolve(str3);
  if (buffer) buffer[0] += str3;
  else buffer = [str3];
  const resStr = Promise.all(callbacks.map((c) => c({
    phase,
    buffer,
    context
  }))).then((res) => Promise.all(res.filter(Boolean).map((str4) => resolveCallback(str4, phase, false, context, buffer))).then(() => buffer[0]));
  if (preserveCallbacks) return raw(await resStr, callbacks);
  else return resStr;
}, "resolveCallback");

// ../node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = /* @__PURE__ */ __name((contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
}, "setDefaultContentType");
var createResponseInstance = /* @__PURE__ */ __name((body, init2) => new Response(body, init2), "createResponseInstance");
var Context = class {
  static {
    __name(this, "Context");
  }
  #rawRequest;
  #req;
  /**
  * `.env` can get bindings (environment variables, secrets, KV namespaces, D1 database, R2 bucket etc.) in Cloudflare Workers.
  *
  * @see {@link https://hono.dev/docs/api/context#env}
  *
  * @example
  * ```ts
  * // Environment object for Cloudflare Workers
  * app.get('*', async c => {
  *   const counter = c.env.COUNTER
  * })
  * ```
  */
  env = {};
  #var;
  finalized = false;
  /**
  * `.error` can get the error object from the middleware if the Handler throws an error.
  *
  * @see {@link https://hono.dev/docs/api/context#error}
  *
  * @example
  * ```ts
  * app.use('*', async (c, next) => {
  *   await next()
  *   if (c.error) {
  *     // do something...
  *   }
  * })
  * ```
  */
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  /**
  * Creates an instance of the Context class.
  *
  * @param req - The Request object.
  * @param options - Optional configuration options for the context.
  */
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  /**
  * `.req` is the instance of {@link HonoRequest}.
  */
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  /**
  * @see {@link https://hono.dev/docs/api/context#event}
  * The FetchEvent associated with the current request.
  *
  * @throws Will throw an error if the context does not have a FetchEvent.
  */
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) return this.#executionCtx;
    else throw Error("This context has no FetchEvent");
  }
  /**
  * @see {@link https://hono.dev/docs/api/context#executionctx}
  * The ExecutionContext associated with the current request.
  *
  * @throws Will throw an error if the context does not have an ExecutionContext.
  */
  get executionCtx() {
    if (this.#executionCtx) return this.#executionCtx;
    else throw Error("This context has no ExecutionContext");
  }
  /**
  * @see {@link https://hono.dev/docs/api/context#res}
  * The Response object for the current request.
  */
  get res() {
    return this.#res ||= createResponseInstance(null, { headers: this.#preparedHeaders ??= new Headers() });
  }
  /**
  * Sets the Response object for the current request.
  *
  * @param _res - The Response object to set.
  */
  set res(_res) {
    if (this.#res && _res) {
      _res = createResponseInstance(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") continue;
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) _res.headers.append("set-cookie", cookie);
        } else _res.headers.set(k, v);
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  /**
  * `.render()` can create a response within a layout.
  *
  * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
  *
  * @example
  * ```ts
  * app.get('/', (c) => {
  *   return c.render('Hello!')
  * })
  * ```
  */
  render = /* @__PURE__ */ __name((...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  }, "render");
  /**
  * Sets the layout for the response.
  *
  * @param layout - The layout to set.
  * @returns The layout function.
  */
  setLayout = /* @__PURE__ */ __name((layout) => this.#layout = layout, "setLayout");
  /**
  * Gets the current layout for the response.
  *
  * @returns The current layout function.
  */
  getLayout = /* @__PURE__ */ __name(() => this.#layout, "getLayout");
  /**
  * `.setRenderer()` can set the layout in the custom middleware.
  *
  * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
  *
  * @example
  * ```tsx
  * app.use('*', async (c, next) => {
  *   c.setRenderer((content) => {
  *     return c.html(
  *       <html>
  *         <body>
  *           <p>{content}</p>
  *         </body>
  *       </html>
  *     )
  *   })
  *   await next()
  * })
  * ```
  */
  setRenderer = /* @__PURE__ */ __name((renderer) => {
    this.#renderer = renderer;
  }, "setRenderer");
  /**
  * `.header()` can set headers.
  *
  * @see {@link https://hono.dev/docs/api/context#header}
  *
  * @example
  * ```ts
  * app.get('/welcome', (c) => {
  *   // Set headers
  *   c.header('X-Message', 'Hello!')
  *   c.header('Content-Type', 'text/plain')
  *
  *   // Append multiple headers using the append option (e.g. Vary)
  *   c.header('Vary', 'Accept-Encoding', { append: true })
  *   c.header('Vary', 'User-Agent', { append: true })
  *
  *   return c.body('Thank you for coming')
  * })
  * ```
  */
  header = /* @__PURE__ */ __name((name, value, options) => {
    if (this.finalized) this.#res = createResponseInstance(this.#res.body, this.#res);
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
    if (value === void 0) headers.delete(name);
    else if (options?.append) headers.append(name, value);
    else headers.set(name, value);
  }, "header");
  status = /* @__PURE__ */ __name((status) => {
    this.#status = status;
  }, "status");
  /**
  * `.set()` can set the value specified by the key.
  *
  * @see {@link https://hono.dev/docs/api/context#set-get}
  *
  * @example
  * ```ts
  * app.use('*', async (c, next) => {
  *   c.set('message', 'Hono is hot!!')
  *   await next()
  * })
  * ```
  */
  set = /* @__PURE__ */ __name((key, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key, value);
  }, "set");
  /**
  * `.get()` can use the value specified by the key.
  *
  * @see {@link https://hono.dev/docs/api/context#set-get}
  *
  * @example
  * ```ts
  * app.get('/', (c) => {
  *   const message = c.get('message')
  *   return c.text(`The message is "${message}"`)
  * })
  * ```
  */
  get = /* @__PURE__ */ __name((key) => {
    return this.#var ? this.#var.get(key) : void 0;
  }, "get");
  /**
  * `.var` can access the value of a variable.
  *
  * @see {@link https://hono.dev/docs/api/context#var}
  *
  * @example
  * ```ts
  * const result = c.var.client.oneMethod()
  * ```
  */
  get var() {
    if (!this.#var) return {};
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    let responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders;
    if (typeof arg === "object" && arg.headers) {
      responseHeaders ??= new Headers();
      for (const [key, value] of new Headers(arg.headers)) if (key === "set-cookie") responseHeaders.append(key, value);
      else responseHeaders.set(key, value);
    }
    if (headers) {
      if (!responseHeaders) {
        let count = 0;
        for (const k in headers) if (++count > 1 || typeof headers[k] !== "string") {
          responseHeaders = new Headers();
          break;
        }
      }
      if (responseHeaders) for (const k in headers) {
        const v = headers[k];
        if (typeof v === "string") responseHeaders.set(k, v);
        else {
          responseHeaders.delete(k);
          for (const v2 of v) responseHeaders.append(k, v2);
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return createResponseInstance(data, {
      status,
      headers: responseHeaders ?? headers
    });
  }
  newResponse = /* @__PURE__ */ __name((...args) => this.#newResponse(...args), "newResponse");
  /**
  * `.body()` can return the HTTP response.
  * You can set headers with `.header()` and set HTTP status code with `.status`.
  * This can also be set in `.text()`, `.json()` and so on.
  *
  * @see {@link https://hono.dev/docs/api/context#body}
  *
  * @example
  * ```ts
  * app.get('/welcome', (c) => {
  *   // Set headers
  *   c.header('X-Message', 'Hello!')
  *   c.header('Content-Type', 'text/plain')
  *   // Set HTTP status code
  *   c.status(201)
  *
  *   // Return the response body
  *   return c.body('Thank you for coming')
  * })
  * ```
  */
  body = /* @__PURE__ */ __name((data, arg, headers) => this.#newResponse(data, arg, headers), "body");
  /**
  * `.text()` can render text as `Content-Type:text/plain`.
  *
  * @see {@link https://hono.dev/docs/api/context#text}
  *
  * @example
  * ```ts
  * app.get('/say', (c) => {
  *   return c.text('Hello!')
  * })
  * ```
  */
  text = /* @__PURE__ */ __name((text, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text) : this.#newResponse(text, arg, setDefaultContentType(TEXT_PLAIN, headers));
  }, "text");
  /**
  * `.json()` can render JSON as `Content-Type:application/json`.
  *
  * @see {@link https://hono.dev/docs/api/context#json}
  *
  * @example
  * ```ts
  * app.get('/api', (c) => {
  *   return c.json({ message: 'Hello!' })
  * })
  * ```
  */
  json = /* @__PURE__ */ __name((object, arg, headers) => {
    return this.#newResponse(JSON.stringify(object), arg, setDefaultContentType("application/json", headers));
  }, "json");
  html = /* @__PURE__ */ __name((html, arg, headers) => {
    const res = /* @__PURE__ */ __name((html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers)), "res");
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  }, "html");
  /**
  * `.redirect()` can Redirect, default status code is 302.
  *
  * @see {@link https://hono.dev/docs/api/context#redirect}
  *
  * @example
  * ```ts
  * app.get('/redirect', (c) => {
  *   return c.redirect('/')
  * })
  * app.get('/redirect-permanently', (c) => {
  *   return c.redirect('/', 301)
  * })
  * ```
  */
  redirect = /* @__PURE__ */ __name((location, status) => {
    const locationString = String(location);
    this.header("Location", !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString));
    return this.newResponse(null, status ?? 302);
  }, "redirect");
  /**
  * `.notFound()` can return the Not Found Response.
  *
  * @see {@link https://hono.dev/docs/api/context#notfound}
  *
  * @example
  * ```ts
  * app.get('/notfound', (c) => {
  *   return c.notFound()
  * })
  * ```
  */
  notFound = /* @__PURE__ */ __name(() => {
    this.#notFoundHandler ??= () => createResponseInstance();
    return this.#notFoundHandler(this);
  }, "notFound");
};

// ../node_modules/hono/dist/compose.js
var compose = /* @__PURE__ */ __name((middleware, onError, onNotFound) => {
  return (context, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index) throw new Error("next() called multiple times");
      index = i;
      let res;
      let isError = false;
      let handler;
      if (middleware[i]) {
        handler = middleware[i][0][0];
        context.req.routeIndex = i;
      } else handler = i === middleware.length && next || void 0;
      if (handler) try {
        res = await handler(context, () => dispatch(i + 1));
      } catch (err) {
        if (err instanceof Error && onError) {
          context.error = err;
          res = await onError(err, context);
          isError = true;
        } else throw err;
      }
      else if (context.finalized === false && onNotFound) res = await onNotFound(context);
      if (res && (context.finalized === false || isError)) context.res = res;
      return context;
    }
    __name(dispatch, "dispatch");
  };
}, "compose");

// ../node_modules/hono/dist/router.js
var METHODS = [
  "get",
  "post",
  "put",
  "delete",
  "options",
  "patch",
  "query"
];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = class extends Error {
  static {
    __name(this, "UnsupportedPathError");
  }
};

// ../node_modules/hono/dist/utils/constants.js
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";

// ../node_modules/hono/dist/hono-base.js
var notFoundHandler = /* @__PURE__ */ __name((c) => {
  return c.text("404 Not Found", 404);
}, "notFoundHandler");
var errorHandler = /* @__PURE__ */ __name((err, c) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
}, "errorHandler");
var Hono = class Hono2 {
  static {
    __name(this, "Hono");
  }
  get;
  post;
  put;
  delete;
  options;
  patch;
  query;
  all;
  on;
  use;
  router;
  getPath;
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    [...METHODS, "all"].forEach((method) => {
      this[method] = (args1, ...args) => {
        const methodName = method.toUpperCase();
        if (typeof args1 === "string") this.#path = args1;
        else this.#addRoute(methodName, this.#path, args1);
        args.forEach((handler) => {
          this.#addRoute(methodName, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          const methodName = m.toUpperCase();
          for (const handler of handlers) this.#addRoute(methodName, this.#path, handler);
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") this.#path = arg1;
      else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler) => {
        this.#addRoute("ALL", this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new Hono2({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  errorHandler = errorHandler;
  /**
  * `.route()` allows grouping other Hono instance in routes.
  *
  * @see {@link https://hono.dev/docs/api/routing#grouping}
  *
  * @param {string} path - base Path
  * @param {Hono} app - other Hono instance
  * @returns {Hono} routed Hono instance
  *
  * @example
  * ```ts
  * const app = new Hono()
  * const app2 = new Hono()
  *
  * app2.get("/user", (c) => c.text("user"))
  * app.route("/api", app2) // GET /api/user
  * ```
  */
  route(path, app2) {
    const subApp = this.basePath(path);
    app2.routes.map((r) => {
      let handler;
      if (app2.errorHandler === errorHandler) handler = r.handler;
      else {
        handler = /* @__PURE__ */ __name(async (c, next) => (await compose([], app2.errorHandler)(c, () => r.handler(c, next))).res, "handler");
        handler[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler, r.basePath);
    });
    return this;
  }
  /**
  * `.basePath()` allows base paths to be specified.
  *
  * @see {@link https://hono.dev/docs/api/routing#base-path}
  *
  * @param {string} path - base Path
  * @returns {Hono} changed Hono instance
  *
  * @example
  * ```ts
  * const api = new Hono().basePath('/api')
  * ```
  */
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  /**
  * `.onError()` handles an error and returns a customized Response.
  *
  * @see {@link https://hono.dev/docs/api/hono#error-handling}
  *
  * @param {ErrorHandler} handler - request Handler for error
  * @returns {Hono} changed Hono instance
  *
  * @example
  * ```ts
  * app.onError((err, c) => {
  *   console.error(`${err}`)
  *   return c.text('Custom Error Message', 500)
  * })
  * ```
  */
  onError = /* @__PURE__ */ __name((handler) => {
    this.errorHandler = handler;
    return this;
  }, "onError");
  /**
  * `.notFound()` allows you to customize a Not Found Response.
  *
  * @see {@link https://hono.dev/docs/api/hono#not-found}
  *
  * @param {NotFoundHandler} handler - request handler for not-found
  * @returns {Hono} changed Hono instance
  *
  * @example
  * ```ts
  * app.notFound((c) => {
  *   return c.text('Custom 404 Message', 404)
  * })
  * ```
  */
  notFound = /* @__PURE__ */ __name((handler) => {
    this.#notFoundHandler = handler;
    return this;
  }, "notFound");
  /**
  * `.mount()` allows you to mount applications built with other frameworks into your Hono application.
  *
  * @deprecated Use `mount()` from `hono/mount` instead. `.mount()` will be removed in v5.
  *
  * @see {@link https://hono.dev/docs/api/hono#mount}
  *
  * @param {string} path - base Path
  * @param {Function} applicationHandler - other Request Handler
  * @param {MountOptions} [options] - options of `.mount()`
  * @returns {Hono} mounted Hono instance
  *
  * @example
  * ```ts
  * import { Router as IttyRouter } from 'itty-router'
  * import { Hono } from 'hono'
  * // Create itty-router application
  * const ittyRouter = IttyRouter()
  * // GET /itty-router/hello
  * ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
  *
  * const app = new Hono()
  * app.mount('/itty-router', ittyRouter.handle)
  * ```
  *
  * @example
  * ```ts
  * const app = new Hono()
  * // Send the request to another application without modification.
  * app.mount('/app', anotherApp, {
  *   replaceRequest: (req) => req,
  * })
  * ```
  */
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") optionHandler = options;
      else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) replaceRequest = /* @__PURE__ */ __name((request) => request, "replaceRequest");
        else replaceRequest = options.replaceRequest;
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = void 0;
      try {
        executionContext = c.executionCtx;
      } catch {
      }
      return [c.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request) => {
        const url = new URL(request.url);
        url.pathname = this.getPath(request).slice(pathPrefixLength) || "/";
        return new Request(url, request);
      };
    })();
    const handler = /* @__PURE__ */ __name(async (c, next) => {
      const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
      if (res) return res;
      await next();
    }, "handler");
    this.#addRoute("ALL", mergePath(path, "*"), handler);
    return this;
  }
  #addRoute(method, path, handler, baseRoutePath) {
    path = mergePath(this._basePath, path);
    const r = {
      basePath: baseRoutePath !== void 0 ? mergePath(this._basePath, baseRoutePath) : this._basePath,
      path,
      method,
      handler
    };
    this.router.add(method, path, [handler, r]);
    this.routes.push(r);
  }
  #handleError(err, c) {
    if (err instanceof Error) return this.errorHandler(err, c);
    throw err;
  }
  #dispatch(request, executionCtx, env, method) {
    if (method === "HEAD") return (async () => new Response(null, await this.#dispatch(request, executionCtx, env, "GET")))();
    const path = this.getPath(request, { env });
    const matchResult = this.router.match(method, path);
    const c = new Context(request, {
      path,
      matchResult,
      env,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err) {
        return this.#handleError(err, c);
      }
      return res instanceof Promise ? res.then((resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context = await composed(c);
        if (!context.finalized) throw new Error("Context is not finalized. Did you forget to return a Response object or `await next()`?");
        return context.res;
      } catch (err) {
        return this.#handleError(err, c);
      }
    })();
  }
  /**
  * `.fetch()` will be entry point of your app.
  *
  * @see {@link https://hono.dev/docs/api/hono#fetch}
  *
  * @param {Request} request - request Object of request
  * @param {Env} env - env Object
  * @param {ExecutionContext} executionCtx - context of execution
  * @returns {Response | Promise<Response>} response of request
  *
  */
  fetch = /* @__PURE__ */ __name((request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  }, "fetch");
  /**
  * `.request()` is a useful method for testing.
  * You can pass a URL or pathname to send a GET request.
  * app will return a Response object.
  * ```ts
  * test('GET /hello is ok', async () => {
  *   const res = await app.request('/hello')
  *   expect(res.status).toBe(200)
  * })
  * ```
  * @see https://hono.dev/docs/api/hono#request
  */
  request = /* @__PURE__ */ __name((input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    input = input.toString();
    return this.fetch(new Request(/^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`, requestInit), Env, executionCtx);
  }, "request");
  /**
  * `.fire()` automatically adds a global fetch event listener.
  * This can be useful for environments that adhere to the Service Worker API, such as non-ES module Cloudflare Workers.
  * @deprecated
  * Use `fire` from `hono/service-worker` instead.
  * ```ts
  * import { Hono } from 'hono'
  * import { fire } from 'hono/service-worker'
  *
  * const app = new Hono()
  * // ...
  * fire(app)
  * ```
  * @see https://hono.dev/docs/api/hono#fire
  * @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
  * @see https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
  */
  fire = /* @__PURE__ */ __name(() => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  }, "fire");
};

// ../node_modules/hono/dist/router/utils.js
var createNullObject = /* @__PURE__ */ __name(() => /* @__PURE__ */ Object.create(null), "createNullObject");

// ../node_modules/hono/dist/router/reg-exp-router/matcher.js
var emptyParam = [];
function match(method, path) {
  const matchers = this.buildAllMatchers();
  const match2 = /* @__PURE__ */ __name(((method2, path2) => {
    const matcher = matchers[method2] || matchers["ALL"];
    const staticMatch = matcher[2][path2];
    if (staticMatch) return staticMatch;
    const match3 = path2.match(matcher[0]);
    if (!match3) return [[], emptyParam];
    const index = match3.indexOf("", 1);
    return [matcher[1][index], match3];
  }), "match");
  this.match = match2;
  return match2(method, path);
}
__name(match, "match");

// ../node_modules/hono/dist/router/reg-exp-router/node.js
var LABEL_REG_EXP_STR = "[^/]+";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = /* @__PURE__ */ Symbol();
var regExpMetaChars = /* @__PURE__ */ new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) return b.length === 1 ? a < b ? -1 : 1 : -1;
  if (b.length === 1) return 1;
  if (a === ".*" || a === "(?:|/.*)") return b === "(?:|/.*)" ? -1 : 1;
  else if (b === ".*" || b === "(?:|/.*)") return -1;
  if (a === "[^/]+") return 1;
  else if (b === "[^/]+") return -1;
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
__name(compareKey, "compareKey");
var Node = class Node2 {
  static {
    __name(this, "Node");
  }
  #index;
  #varIndex;
  #children = createNullObject();
  insert(tokens, index, paramMap, context, isStatic) {
    let node = this;
    for (let i = 0, len = tokens.length; i < len; i++) {
      const token = tokens[i];
      const pattern = token.length === 1 ? token === "*" ? i === len - 1 ? [
        "",
        "",
        ".*"
      ] : [
        "",
        "",
        LABEL_REG_EXP_STR
      ] : null : token === "/*" ? [
        "",
        "",
        TAIL_WILDCARD_REG_EXP_STR
      ] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
      let nextNode;
      if (pattern) {
        const name = pattern[1];
        let regexpStr = pattern[2] || "[^/]+";
        if (name && pattern[2]) {
          if (regexpStr === ".*") throw PATH_ERROR;
          regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
          if (/\((?!\?:)/.test(regexpStr)) throw PATH_ERROR;
          if (regexpStr.length === 1 && regExpMetaChars.has(regexpStr)) throw PATH_ERROR;
        }
        nextNode = node.#children[regexpStr];
        if (!nextNode) {
          if (regexpStr !== ".*" && regexpStr !== "(?:|/.*)") {
            for (const k in node.#children) if ((regexpStr.length > 1 || k.length > 1) && k !== ".*" && k !== "(?:|/.*)") throw PATH_ERROR;
          }
          nextNode = node.#children[regexpStr] = new Node2();
        }
        if (name !== "") {
          nextNode.#varIndex ??= context.varIndex++;
          paramMap.push([name, nextNode.#varIndex]);
        }
      } else {
        nextNode = node.#children[token];
        if (!nextNode) {
          for (const k in node.#children) if (k.length > 1 && k !== ".*" && k !== "(?:|/.*)") throw PATH_ERROR;
          nextNode = node.#children[token] = new Node2();
        }
      }
      node = nextNode;
    }
    if (node.#index !== void 0) throw PATH_ERROR;
    node.#index = isStatic ? -1 : index;
  }
  buildRegExpStr() {
    const strList = Object.keys(this.#children).sort(compareKey).map((k) => {
      const c = this.#children[k];
      const childStr = c.buildRegExpStr();
      return childStr === "" ? "" : (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + childStr;
    }).filter(Boolean);
    if (typeof this.#index === "number" && this.#index !== -1) strList.unshift(`#${this.#index}`);
    if (strList.length === 0) return "";
    if (strList.length === 1) return strList[0];
    return "(?:" + strList.join("|") + ")";
  }
};

// ../node_modules/hono/dist/router/reg-exp-router/trie.js
var Trie = class {
  static {
    __name(this, "Trie");
  }
  #context = { varIndex: 0 };
  #root = new Node();
  #index = 0;
  paths = createNullObject();
  insert(path, isStatic) {
    if (isStatic) {
      this.#root.insert(path.split(""), 0, [], this.#context, true);
      return;
    }
    const paramAssoc = [];
    const groups = [];
    let markedPath = path;
    for (let i = 0; ; ) {
      let replaced = false;
      markedPath = markedPath.replace(/\{[^}]+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) break;
    }
    const tokens = markedPath.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1; j >= 0; j--) if (tokens[j].indexOf(mark) !== -1) {
        tokens[j] = tokens[j].replace(mark, groups[i][1]);
        break;
      }
    }
    this.#root.insert(tokens, this.#index, paramAssoc, this.#context, false);
    this.paths[path] = [this.#index++, paramAssoc];
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") return [
      /^$/,
      [],
      []
    ];
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [
      new RegExp(`^${regexp}`),
      indexReplacementMap,
      paramReplacementMap
    ];
  }
};

// ../node_modules/hono/dist/router/reg-exp-router/router.js
var wildcardRegExpCache = createNullObject();
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(`^${path.replace(/\/:[^/{}]+(?:\{\[\^\/]\+})?(?=[/{]|$)|\/?\*$|([.\\+*[^\]$()?{}|])/g, (match2, metaChar) => metaChar ? `\\${metaChar}` : match2 === "/*" ? TAIL_WILDCARD_REG_EXP_STR : match2 === "*" ? ".*" : `/:${LABEL_REG_EXP_STR}`)}$`);
}
__name(buildWildcardRegExp, "buildWildcardRegExp");
function findMiddleware(middleware, path) {
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) if (buildWildcardRegExp(k).test(path)) return [...middleware[k]];
}
__name(findMiddleware, "findMiddleware");
var RegExpRouter = class {
  static {
    __name(this, "RegExpRouter");
  }
  name = "RegExpRouter";
  #middleware;
  #routes;
  #tries;
  constructor() {
    this.#middleware = { ["ALL"]: createNullObject() };
    this.#routes = { ["ALL"]: createNullObject() };
    this.#tries = { ["ALL"]: new Trie() };
  }
  #insertPath(method, path) {
    try {
      this.#tries[method].insert(path, !/\*|\/:/.test(path));
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
  }
  add(method, path, handler) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware) throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    if (!middleware[method]) {
      this.#tries[method] = new Trie();
      for (const handlerMap of [middleware, routes]) {
        handlerMap[method] = createNullObject();
        for (const p in handlerMap["ALL"]) {
          handlerMap[method][p] = [...handlerMap["ALL"][p]];
          this.#insertPath(method, p);
        }
      }
    }
    if (path === "/*") path = "*";
    const methods = method === "ALL" ? Object.keys(middleware) : [method];
    if (/\*$/.test(path)) {
      const re = buildWildcardRegExp(path);
      for (const m of methods) if (!middleware[m][path]) {
        this.#insertPath(m, path);
        middleware[m][path] = findMiddleware(middleware[m], path) || findMiddleware(middleware["ALL"], path) || [];
      }
      for (const handlerMap of [middleware, routes]) for (const m of methods) for (const p in handlerMap[m]) re.test(p) && handlerMap[m][p].push([handler, path]);
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (const path2 of paths) for (const m of methods) {
      if (!routes[m][path2]) {
        this.#insertPath(m, path2);
        routes[m][path2] = findMiddleware(middleware[m], path2) || findMiddleware(middleware["ALL"], path2) || [];
      }
      routes[m][path2].push([handler, path2]);
    }
  }
  match = match;
  buildAllMatchers() {
    const matchers = createNullObject();
    for (const method of Object.keys(this.#routes)) matchers[method] = this.#buildMatcher(method);
    this.#middleware = this.#routes = this.#tries = void 0;
    wildcardRegExpCache = createNullObject();
    return matchers;
  }
  #buildMatcher(method) {
    const middleware = this.#middleware[method];
    const routes = this.#routes[method];
    const trie = this.#tries[method];
    const staticMap = createNullObject();
    const handlerData = [];
    const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
    for (const r of [middleware, routes]) for (const path in r) {
      const handlers = r[path];
      const pathData = trie.paths[path];
      if (!pathData) {
        staticMap[path] = [handlers.map(([h2]) => [h2, createNullObject()]), emptyParam];
        continue;
      }
      handlerData[pathData[0]] = handlers.map(([h2, handlerPath]) => [h2, trie.paths[handlerPath][1].reduceRight((map, [key], i) => {
        map[key] = paramReplacementMap[pathData[1][i][1]];
        return map;
      }, createNullObject())]);
    }
    return [
      regexp,
      indexReplacementMap.map((i) => handlerData[i]),
      staticMap
    ];
  }
};

// ../node_modules/hono/dist/router/smart-router/router.js
var SmartRouter = class {
  static {
    __name(this, "SmartRouter");
  }
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init2) {
    this.#routers = init2.routers;
  }
  add(method, path, handler) {
    if (!this.#routes) throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    this.#routes.push([
      method,
      path,
      handler
    ]);
  }
  match(method, path) {
    if (!this.#routes) throw new Error("Fatal error");
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (; i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length; i2 < len2; i2++) router.add(...routes[i2]);
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) continue;
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i === len) throw new Error("Fatal error");
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) throw new Error("No active router has been determined yet.");
    return this.#routers[0];
  }
};

// ../node_modules/hono/dist/router/trie-router/node.js
var emptyParams = createNullObject();
var order = 0;
var Node3 = class Node4 {
  static {
    __name(this, "Node");
  }
  #methods = [];
  #children = createNullObject();
  #patterns = [];
  #pattern;
  #params = emptyParams;
  insert(method, path, handler) {
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = /* @__PURE__ */ new Set();
    let i = 0;
    for (const p of parts) {
      const nextP = parts[++i];
      const pattern = getPattern(p, nextP) || (nextP === void 0 && p && p.indexOf("*") === p.length - 1 ? p : null);
      const isParam = Array.isArray(pattern);
      const key = isParam ? pattern[0] : pattern || p;
      const child = curNode.#children[key] ||= new Node4();
      if (pattern && !child.#pattern) {
        child.#pattern = pattern;
        curNode.#patterns.push(child);
      }
      curNode = child;
      if (isParam) possibleKeys.add(pattern[1]);
    }
    curNode.#methods.push({ [method]: {
      handler,
      possibleKeys: [...possibleKeys],
      score: ++order
    } });
  }
  #pushHandlerSets(handlerSets, node, method, nodeParams, params) {
    for (let i = 0, len = node.#methods.length; i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m["ALL"];
      if (handlerSet) {
        handlerSet.params = createNullObject();
        handlerSets.push(handlerSet);
        for (let i2 = 0, len2 = handlerSet.possibleKeys.length; i2 < len2; i2++) {
          const key = handlerSet.possibleKeys[i2];
          handlerSet.params[key] = params?.[key] && !i2 ? params[key] : nodeParams[key] ?? params?.[key];
        }
      }
    }
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    let curNodes = [this];
    const parts = splitPath(path);
    const curNodesQueue = [];
    const len = parts.length;
    let partOffsets = null;
    for (let i = 0; i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length; j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) this.#pushHandlerSets(handlerSets, nextNode.#children["*"], method, node.#params);
            this.#pushHandlerSets(handlerSets, nextNode, method, node.#params);
          } else tempNodes.push(nextNode);
        }
        for (const child of node.#patterns) {
          const pattern = child.#pattern;
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (typeof pattern === "string") {
            if (pattern === "*" || part.startsWith(pattern.slice(0, -1))) {
              this.#pushHandlerSets(handlerSets, child, method, node.#params);
              if (pattern === "*") {
                child.#params = params;
                tempNodes.push(child);
              }
            }
            continue;
          }
          const [, name, matcher] = pattern;
          if (!part && matcher === true) continue;
          if (matcher !== true) {
            if (!partOffsets) {
              partOffsets = [];
              let offset = path[0] === "/" ? 1 : 0;
              for (let p = 0; p < len; p++) {
                partOffsets[p] = offset;
                offset += parts[p].length + 1;
              }
            }
            const restPathString = path.slice(partOffsets[i]);
            const m = matcher.exec(restPathString);
            if (m) {
              params[name] = m[0];
              this.#pushHandlerSets(handlerSets, child, method, node.#params, params);
              if (m[0].length === restPathString.length && child.#children["*"]) this.#pushHandlerSets(handlerSets, child.#children["*"], method, node.#params, params);
              for (const _ in child.#children) {
                child.#params = params;
                const componentCount = m[0].match(/\//g)?.length ?? 0;
                (curNodesQueue[componentCount] ||= []).push(child);
                break;
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name] = part;
            if (isLast) {
              this.#pushHandlerSets(handlerSets, child, method, params, node.#params);
              if (child.#children["*"]) this.#pushHandlerSets(handlerSets, child.#children["*"], method, params, node.#params);
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      const shifted = curNodesQueue.shift();
      curNodes = shifted ? tempNodes.concat(shifted) : tempNodes;
    }
    if (handlerSets[1]) handlerSets.sort((a, b) => {
      return a.score - b.score;
    });
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
};

// ../node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = class {
  static {
    __name(this, "TrieRouter");
  }
  name = "TrieRouter";
  #node = new Node3();
  add(method, path, handler) {
    for (const result of checkOptionalParameter(path) || [path]) this.#node.insert(method, result, handler);
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
};

// ../node_modules/hono/dist/hono.js
var Hono3 = class extends Hono {
  static {
    __name(this, "Hono");
  }
  /**
  * Creates an instance of the Hono class.
  *
  * @param options - Optional configuration options for the Hono instance.
  */
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({ routers: [new RegExpRouter(), new TrieRouter()] });
  }
};

// dbref.mjs
var impl = null;
var setDb = /* @__PURE__ */ __name((d2) => {
  impl = d2;
}, "setDb");
var db = {
  prepare: /* @__PURE__ */ __name((sql) => ({
    get: /* @__PURE__ */ __name((...a) => impl.get(sql, a), "get"),
    all: /* @__PURE__ */ __name((...a) => impl.all(sql, a), "all"),
    run: /* @__PURE__ */ __name((...a) => impl.run(sql, a), "run")
  }), "prepare"),
  exec: /* @__PURE__ */ __name((sql) => impl.exec(sql), "exec"),
  batch: /* @__PURE__ */ __name((stmts) => impl.batch(stmts), "batch")
};
var tx = /* @__PURE__ */ __name((fn) => impl.tx(fn), "tx");
var fmt = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
var nowLocal = /* @__PURE__ */ __name((d2 = /* @__PURE__ */ new Date()) => fmt.format(d2).replace(",", ""), "nowLocal");
var fixSql = /* @__PURE__ */ __name((sql) => sql.includes("datetime('now','localtime')") ? sql.replaceAll("datetime('now','localtime')", `'${nowLocal()}'`) : sql, "fixSql");
var DEFAULT_SETTINGS = {
  shop_name: "Informatix Repair",
  shop_address: "Via Pecorari 178, Nocera Superiore (SA)",
  shop_phone: "+39 376 234 4151",
  public_base_url: "",
  default_warranty_days: "90",
  terms: "Il preventivo \xE8 indicativo fino all\u2019approvazione. I dispositivi non ritirati entro 60 giorni dalla comunicazione di fine lavori possono essere trattenuti a copertura delle spese. Il negozio non risponde dei dati presenti sul dispositivo: si consiglia di effettuare un backup prima della consegna. Garanzia sulla riparazione secondo quanto indicato in ricevuta."
};
async function ensureDefaults() {
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    await db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)").run(k, v);
  }
}
__name(ensureDefaults, "ensureDefaults");
var getSettings = /* @__PURE__ */ __name(async () => Object.fromEntries((await db.prepare("SELECT key, value FROM settings").all()).map((r) => [r.key, r.value])), "getSettings");
async function ensureOwner(email) {
  if (!email) return;
  await db.prepare("INSERT OR IGNORE INTO users (email, name, role, protected, created_at) VALUES (?,?,?,?,datetime('now','localtime'))").run(email.toLowerCase(), "Proprietario", "admin", 1);
}
__name(ensureOwner, "ensureOwner");

// db-d1.mjs
function useD1(d1) {
  const st = /* @__PURE__ */ __name((sql, a) => d1.prepare(fixSql(sql)).bind(...a), "st");
  setDb({
    get: /* @__PURE__ */ __name(async (sql, a) => await st(sql, a).first() ?? void 0, "get"),
    all: /* @__PURE__ */ __name(async (sql, a) => (await st(sql, a).all()).results, "all"),
    run: /* @__PURE__ */ __name(async (sql, a) => {
      const r = await st(sql, a).run();
      return { changes: r.meta.changes, lastInsertRowid: r.meta.last_row_id };
    }, "run"),
    exec: /* @__PURE__ */ __name(async (sql) => {
      await d1.exec(sql.replace(/\s*\n\s*/g, " "));
    }, "exec"),
    batch: /* @__PURE__ */ __name(async (stmts) => {
      await d1.batch(stmts.map(([sql, a]) => st(sql, a)));
    }, "batch"),
    // D1 non ha transazioni interattive: le operazioni validano prima e scrivono poi, in sequenza.
    tx: /* @__PURE__ */ __name(async (fn) => fn(), "tx")
  });
}
__name(useD1, "useD1");

// ../node_modules/uqr/dist/index.mjs
var QrCodeDataType = /* @__PURE__ */ ((QrCodeDataType2) => {
  QrCodeDataType2[QrCodeDataType2["Border"] = -1] = "Border";
  QrCodeDataType2[QrCodeDataType2["Data"] = 0] = "Data";
  QrCodeDataType2[QrCodeDataType2["Function"] = 1] = "Function";
  QrCodeDataType2[QrCodeDataType2["Position"] = 2] = "Position";
  QrCodeDataType2[QrCodeDataType2["Timing"] = 3] = "Timing";
  QrCodeDataType2[QrCodeDataType2["Alignment"] = 4] = "Alignment";
  return QrCodeDataType2;
})(QrCodeDataType || {});
var LOW = [0, 1];
var MEDIUM = [1, 0];
var QUARTILE = [2, 3];
var HIGH = [3, 2];
var EccMap = {
  L: LOW,
  M: MEDIUM,
  Q: QUARTILE,
  H: HIGH
};
var NUMERIC_REGEX = /^\d*$/;
var ALPHANUMERIC_REGEX = /^[A-Z0-9 $%*+./:-]*$/;
var ALPHANUMERIC_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
var MIN_VERSION = 1;
var MAX_VERSION = 40;
var PENALTY_N1 = 3;
var PENALTY_N2 = 3;
var PENALTY_N3 = 40;
var PENALTY_N4 = 10;
var ECC_CODEWORDS_PER_BLOCK = [
  // Version: (note that index 0 is for padding, and is set to an illegal value)
  // 0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40    Error correction level
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  // Low
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  // Medium
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  // Quartile
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
  // High
];
var NUM_ERROR_CORRECTION_BLOCKS = [
  // Version: (note that index 0 is for padding, and is set to an illegal value)
  // 0, 1, 2, 3, 4, 5, 6, 7, 8, 9,10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40    Error correction level
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  // Low
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  // Medium
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  // Quartile
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
  // High
];
var QrCode = class {
  static {
    __name(this, "QrCode");
  }
  /* -- Constructor (low level) and fields -- */
  // Creates a new QR Code with the given version number,
  // error correction level, data codeword bytes, and mask number.
  // This is a low-level API that most users should not use directly.
  // A mid-level API is the encodeSegments() function.
  constructor(version, ecc, dataCodewords, msk) {
    this.version = version;
    this.ecc = ecc;
    if (version < MIN_VERSION || version > MAX_VERSION)
      throw new RangeError("Version value out of range");
    if (msk < -1 || msk > 7)
      throw new RangeError("Mask value out of range");
    this.size = version * 4 + 17;
    const row = Array.from({ length: this.size }).fill(false);
    for (let i = 0; i < this.size; i++) {
      this.modules.push(row.slice());
      this.types.push(row.map(() => 0));
    }
    this.drawFunctionPatterns();
    const allCodewords = this.addEccAndInterleave(dataCodewords);
    this.drawCodewords(allCodewords);
    if (msk === -1) {
      let minPenalty = 1e9;
      for (let i = 0; i < 8; i++) {
        this.applyMask(i);
        this.drawFormatBits(i);
        const penalty = this.getPenaltyScore();
        if (penalty < minPenalty) {
          msk = i;
          minPenalty = penalty;
        }
        this.applyMask(i);
      }
    }
    this.mask = msk;
    this.applyMask(msk);
    this.drawFormatBits(msk);
  }
  /* -- Fields -- */
  // The width and height of this QR Code, measured in modules, between
  // 21 and 177 (inclusive). This is equal to version * 4 + 17.
  size;
  // The index of the mask pattern used in this QR Code, which is between 0 and 7 (inclusive).
  // Even if a QR Code is created with automatic masking requested (mask = -1),
  // the resulting object still has a mask value between 0 and 7.
  mask;
  // The modules of this QR Code (false = light, true = dark).
  // Immutable after constructor finishes. Accessed through getModule().
  modules = [];
  types = [];
  /* -- Accessor methods -- */
  // Returns the color of the module (pixel) at the given coordinates, which is false
  // for light or true for dark. The top left corner has the coordinates (x=0, y=0).
  // If the given coordinates are out of bounds, then false (light) is returned.
  getModule(x, y) {
    return x >= 0 && x < this.size && y >= 0 && y < this.size && this.modules[y][x];
  }
  /* -- Private helper methods for constructor: Drawing function modules -- */
  // Reads this object's version field, and draws and marks all function modules.
  drawFunctionPatterns() {
    for (let i = 0; i < this.size; i++) {
      this.setFunctionModule(6, i, i % 2 === 0, QrCodeDataType.Timing);
      this.setFunctionModule(i, 6, i % 2 === 0, QrCodeDataType.Timing);
    }
    this.drawFinderPattern(3, 3);
    this.drawFinderPattern(this.size - 4, 3);
    this.drawFinderPattern(3, this.size - 4);
    const alignPatPos = this.getAlignmentPatternPositions();
    const numAlign = alignPatPos.length;
    for (let i = 0; i < numAlign; i++) {
      for (let j = 0; j < numAlign; j++) {
        if (!(i === 0 && j === 0 || i === 0 && j === numAlign - 1 || i === numAlign - 1 && j === 0))
          this.drawAlignmentPattern(alignPatPos[i], alignPatPos[j]);
      }
    }
    this.drawFormatBits(0);
    this.drawVersion();
  }
  // Draws two copies of the format bits (with its own error correction code)
  // based on the given mask and this object's error correction level field.
  drawFormatBits(mask) {
    const data = this.ecc[1] << 3 | mask;
    let rem = data;
    for (let i = 0; i < 10; i++)
      rem = rem << 1 ^ (rem >>> 9) * 1335;
    const bits = (data << 10 | rem) ^ 21522;
    for (let i = 0; i <= 5; i++)
      this.setFunctionModule(8, i, getBit(bits, i));
    this.setFunctionModule(8, 7, getBit(bits, 6));
    this.setFunctionModule(8, 8, getBit(bits, 7));
    this.setFunctionModule(7, 8, getBit(bits, 8));
    for (let i = 9; i < 15; i++)
      this.setFunctionModule(14 - i, 8, getBit(bits, i));
    for (let i = 0; i < 8; i++)
      this.setFunctionModule(this.size - 1 - i, 8, getBit(bits, i));
    for (let i = 8; i < 15; i++)
      this.setFunctionModule(8, this.size - 15 + i, getBit(bits, i));
    this.setFunctionModule(8, this.size - 8, true);
  }
  // Draws two copies of the version bits (with its own error correction code),
  // based on this object's version field, iff 7 <= version <= 40.
  drawVersion() {
    if (this.version < 7)
      return;
    let rem = this.version;
    for (let i = 0; i < 12; i++)
      rem = rem << 1 ^ (rem >>> 11) * 7973;
    const bits = this.version << 12 | rem;
    for (let i = 0; i < 18; i++) {
      const color = getBit(bits, i);
      const a = this.size - 11 + i % 3;
      const b = Math.floor(i / 3);
      this.setFunctionModule(a, b, color);
      this.setFunctionModule(b, a, color);
    }
  }
  // Draws a 9*9 finder pattern including the border separator,
  // with the center module at (x, y). Modules can be out of bounds.
  drawFinderPattern(x, y) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && xx < this.size && yy >= 0 && yy < this.size)
          this.setFunctionModule(xx, yy, dist !== 2 && dist !== 4, QrCodeDataType.Position);
      }
    }
  }
  // Draws a 5*5 alignment pattern, with the center module
  // at (x, y). All modules must be in bounds.
  drawAlignmentPattern(x, y) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        this.setFunctionModule(
          x + dx,
          y + dy,
          Math.max(Math.abs(dx), Math.abs(dy)) !== 1,
          QrCodeDataType.Alignment
        );
      }
    }
  }
  // Sets the color of a module and marks it as a function module.
  // Only used by the constructor. Coordinates must be in bounds.
  setFunctionModule(x, y, isDark, type = QrCodeDataType.Function) {
    this.modules[y][x] = isDark;
    this.types[y][x] = type;
  }
  /* -- Private helper methods for constructor: Codewords and masking -- */
  // Returns a new byte string representing the given data with the appropriate error correction
  // codewords appended to it, based on this object's version and error correction level.
  addEccAndInterleave(data) {
    const ver = this.version;
    const ecl = this.ecc;
    if (data.length !== getNumDataCodewords(ver, ecl))
      throw new RangeError("Invalid argument");
    const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[ecl[0]][ver];
    const blockEccLen = ECC_CODEWORDS_PER_BLOCK[ecl[0]][ver];
    const rawCodewords = Math.floor(getNumRawDataModules(ver) / 8);
    const numShortBlocks = numBlocks - rawCodewords % numBlocks;
    const shortBlockLen = Math.floor(rawCodewords / numBlocks);
    const blocks = [];
    const rsDiv = reedSolomonComputeDivisor(blockEccLen);
    for (let i = 0, k = 0; i < numBlocks; i++) {
      const dat = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
      k += dat.length;
      const ecc = reedSolomonComputeRemainder(dat, rsDiv);
      if (i < numShortBlocks)
        dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    const result = [];
    for (let i = 0; i < blocks[0].length; i++) {
      blocks.forEach((block, j) => {
        if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks)
          result.push(block[i]);
      });
    }
    return result;
  }
  // Draws the given sequence of 8-bit codewords (data and error correction) onto the entire
  // data area of this QR Code. Function modules need to be marked off before this is called.
  drawCodewords(data) {
    if (data.length !== Math.floor(getNumRawDataModules(this.version) / 8))
      throw new RangeError("Invalid argument");
    let i = 0;
    for (let right = this.size - 1; right >= 1; right -= 2) {
      if (right === 6)
        right = 5;
      for (let vert = 0; vert < this.size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = (right + 1 & 2) === 0;
          const y = upward ? this.size - 1 - vert : vert;
          if (!this.types[y][x] && i < data.length * 8) {
            this.modules[y][x] = getBit(data[i >>> 3], 7 - (i & 7));
            i++;
          }
        }
      }
    }
  }
  // XORs the codeword modules in this QR Code with the given mask pattern.
  // The function modules must be marked and the codeword bits must be drawn
  // before masking. Due to the arithmetic of XOR, calling applyMask() with
  // the same mask value a second time will undo the mask. A final well-formed
  // QR Code needs exactly one (not zero, two, etc.) mask applied.
  applyMask(mask) {
    if (mask < 0 || mask > 7)
      throw new RangeError("Mask value out of range");
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        let invert;
        switch (mask) {
          case 0:
            invert = (x + y) % 2 === 0;
            break;
          case 1:
            invert = y % 2 === 0;
            break;
          case 2:
            invert = x % 3 === 0;
            break;
          case 3:
            invert = (x + y) % 3 === 0;
            break;
          case 4:
            invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
            break;
          case 5:
            invert = x * y % 2 + x * y % 3 === 0;
            break;
          case 6:
            invert = (x * y % 2 + x * y % 3) % 2 === 0;
            break;
          case 7:
            invert = ((x + y) % 2 + x * y % 3) % 2 === 0;
            break;
          default:
            throw new Error("Unreachable");
        }
        if (!this.types[y][x] && invert)
          this.modules[y][x] = !this.modules[y][x];
      }
    }
  }
  // Calculates and returns the penalty score based on state of this QR Code's current modules.
  // This is used by the automatic mask choice algorithm to find the mask pattern that yields the lowest score.
  getPenaltyScore() {
    let result = 0;
    for (let y = 0; y < this.size; y++) {
      let runColor = false;
      let runX = 0;
      const runHistory = [0, 0, 0, 0, 0, 0, 0];
      for (let x = 0; x < this.size; x++) {
        if (this.modules[y][x] === runColor) {
          runX++;
          if (runX === 5)
            result += PENALTY_N1;
          else if (runX > 5)
            result++;
        } else {
          this.finderPenaltyAddHistory(runX, runHistory);
          if (!runColor)
            result += this.finderPenaltyCountPatterns(runHistory) * PENALTY_N3;
          runColor = this.modules[y][x];
          runX = 1;
        }
      }
      result += this.finderPenaltyTerminateAndCount(runColor, runX, runHistory) * PENALTY_N3;
    }
    for (let x = 0; x < this.size; x++) {
      let runColor = false;
      let runY = 0;
      const runHistory = [0, 0, 0, 0, 0, 0, 0];
      for (let y = 0; y < this.size; y++) {
        if (this.modules[y][x] === runColor) {
          runY++;
          if (runY === 5)
            result += PENALTY_N1;
          else if (runY > 5)
            result++;
        } else {
          this.finderPenaltyAddHistory(runY, runHistory);
          if (!runColor)
            result += this.finderPenaltyCountPatterns(runHistory) * PENALTY_N3;
          runColor = this.modules[y][x];
          runY = 1;
        }
      }
      result += this.finderPenaltyTerminateAndCount(runColor, runY, runHistory) * PENALTY_N3;
    }
    for (let y = 0; y < this.size - 1; y++) {
      for (let x = 0; x < this.size - 1; x++) {
        const color = this.modules[y][x];
        if (color === this.modules[y][x + 1] && color === this.modules[y + 1][x] && color === this.modules[y + 1][x + 1]) {
          result += PENALTY_N2;
        }
      }
    }
    let dark = 0;
    for (const row of this.modules)
      dark = row.reduce((sum, color) => sum + (color ? 1 : 0), dark);
    const total = this.size * this.size;
    const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
    result += k * PENALTY_N4;
    return result;
  }
  /* -- Private helper functions -- */
  // Returns an ascending list of positions of alignment patterns for this version number.
  // Each position is in the range [0,177), and are used on both the x and y axes.
  // This could be implemented as lookup table of 40 variable-length lists of integers.
  getAlignmentPatternPositions() {
    if (this.version === 1) {
      return [];
    } else {
      const numAlign = Math.floor(this.version / 7) + 2;
      const step = this.version === 32 ? 26 : Math.ceil((this.version * 4 + 4) / (numAlign * 2 - 2)) * 2;
      const result = [6];
      for (let pos = this.size - 7; result.length < numAlign; pos -= step)
        result.splice(1, 0, pos);
      return result;
    }
  }
  // Can only be called immediately after a light run is added, and
  // returns either 0, 1, or 2. A helper function for getPenaltyScore().
  finderPenaltyCountPatterns(runHistory) {
    const n = runHistory[1];
    const core = n > 0 && runHistory[2] === n && runHistory[3] === n * 3 && runHistory[4] === n && runHistory[5] === n;
    return (core && runHistory[0] >= n * 4 && runHistory[6] >= n ? 1 : 0) + (core && runHistory[6] >= n * 4 && runHistory[0] >= n ? 1 : 0);
  }
  // Must be called at the end of a line (row or column) of modules. A helper function for getPenaltyScore().
  finderPenaltyTerminateAndCount(currentRunColor, currentRunLength, runHistory) {
    if (currentRunColor) {
      this.finderPenaltyAddHistory(currentRunLength, runHistory);
      currentRunLength = 0;
    }
    currentRunLength += this.size;
    this.finderPenaltyAddHistory(currentRunLength, runHistory);
    return this.finderPenaltyCountPatterns(runHistory);
  }
  // Pushes the given value to the front and drops the last value. A helper function for getPenaltyScore().
  finderPenaltyAddHistory(currentRunLength, runHistory) {
    if (runHistory[0] === 0)
      currentRunLength += this.size;
    runHistory.pop();
    runHistory.unshift(currentRunLength);
  }
};
function appendBits(val, len, bb) {
  if (len < 0 || len > 31 || val >>> len !== 0)
    throw new RangeError("Value out of range");
  for (let i = len - 1; i >= 0; i--)
    bb.push(val >>> i & 1);
}
__name(appendBits, "appendBits");
function getBit(x, i) {
  return (x >>> i & 1) !== 0;
}
__name(getBit, "getBit");
var QrSegment = class {
  static {
    __name(this, "QrSegment");
  }
  // Creates a new QR Code segment with the given attributes and data.
  // The character count (numChars) must agree with the mode and the bit buffer length,
  // but the constraint isn't checked. The given bit buffer is cloned and stored.
  constructor(mode, numChars, bitData) {
    this.mode = mode;
    this.numChars = numChars;
    this.bitData = bitData;
    if (numChars < 0)
      throw new RangeError("Invalid argument");
    this.bitData = bitData.slice();
  }
  /* -- Methods -- */
  // Returns a new copy of the data bits of this segment.
  getData() {
    return this.bitData.slice();
  }
};
var MODE_NUMERIC = [1, 10, 12, 14];
var MODE_ALPHANUMERIC = [2, 9, 11, 13];
var MODE_BYTE = [4, 8, 16, 16];
function numCharCountBits(mode, ver) {
  return mode[Math.floor((ver + 7) / 17) + 1];
}
__name(numCharCountBits, "numCharCountBits");
function makeBytes(data) {
  const bb = [];
  for (const b of data)
    appendBits(b, 8, bb);
  return new QrSegment(MODE_BYTE, data.length, bb);
}
__name(makeBytes, "makeBytes");
function makeNumeric(digits) {
  if (!isNumeric(digits))
    throw new RangeError("String contains non-numeric characters");
  const bb = [];
  for (let i = 0; i < digits.length; ) {
    const n = Math.min(digits.length - i, 3);
    appendBits(Number.parseInt(digits.substring(i, i + n), 10), n * 3 + 1, bb);
    i += n;
  }
  return new QrSegment(MODE_NUMERIC, digits.length, bb);
}
__name(makeNumeric, "makeNumeric");
function makeAlphanumeric(text) {
  if (!isAlphanumeric(text))
    throw new RangeError("String contains unencodable characters in alphanumeric mode");
  const bb = [];
  let i;
  for (i = 0; i + 2 <= text.length; i += 2) {
    let temp = ALPHANUMERIC_CHARSET.indexOf(text.charAt(i)) * 45;
    temp += ALPHANUMERIC_CHARSET.indexOf(text.charAt(i + 1));
    appendBits(temp, 11, bb);
  }
  if (i < text.length)
    appendBits(ALPHANUMERIC_CHARSET.indexOf(text.charAt(i)), 6, bb);
  return new QrSegment(MODE_ALPHANUMERIC, text.length, bb);
}
__name(makeAlphanumeric, "makeAlphanumeric");
function makeSegments(text) {
  if (text === "")
    return [];
  else if (isNumeric(text))
    return [makeNumeric(text)];
  else if (isAlphanumeric(text))
    return [makeAlphanumeric(text)];
  else
    return [makeBytes(toUtf8ByteArray(text))];
}
__name(makeSegments, "makeSegments");
function isNumeric(text) {
  return NUMERIC_REGEX.test(text);
}
__name(isNumeric, "isNumeric");
function isAlphanumeric(text) {
  return ALPHANUMERIC_REGEX.test(text);
}
__name(isAlphanumeric, "isAlphanumeric");
function getTotalBits(segs, version) {
  let result = 0;
  for (const seg of segs) {
    const ccbits = numCharCountBits(seg.mode, version);
    if (seg.numChars >= 1 << ccbits)
      return Number.POSITIVE_INFINITY;
    result += 4 + ccbits + seg.bitData.length;
  }
  return result;
}
__name(getTotalBits, "getTotalBits");
function toUtf8ByteArray(str3) {
  str3 = encodeURI(str3);
  const result = [];
  for (let i = 0; i < str3.length; i++) {
    if (str3.charAt(i) !== "%") {
      result.push(str3.charCodeAt(i));
    } else {
      result.push(Number.parseInt(str3.substring(i + 1, i + 3), 16));
      i += 2;
    }
  }
  return result;
}
__name(toUtf8ByteArray, "toUtf8ByteArray");
function getNumRawDataModules(ver) {
  if (ver < MIN_VERSION || ver > MAX_VERSION)
    throw new RangeError("Version number out of range");
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7)
      result -= 36;
  }
  return result;
}
__name(getNumRawDataModules, "getNumRawDataModules");
function getNumDataCodewords(ver, ecl) {
  return Math.floor(getNumRawDataModules(ver) / 8) - ECC_CODEWORDS_PER_BLOCK[ecl[0]][ver] * NUM_ERROR_CORRECTION_BLOCKS[ecl[0]][ver];
}
__name(getNumDataCodewords, "getNumDataCodewords");
function reedSolomonComputeDivisor(degree) {
  if (degree < 1 || degree > 255)
    throw new RangeError("Degree out of range");
  const result = [];
  for (let i = 0; i < degree - 1; i++)
    result.push(0);
  result.push(1);
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = reedSolomonMultiply(result[j], root);
      if (j + 1 < result.length)
        result[j] ^= result[j + 1];
    }
    root = reedSolomonMultiply(root, 2);
  }
  return result;
}
__name(reedSolomonComputeDivisor, "reedSolomonComputeDivisor");
function reedSolomonComputeRemainder(data, divisor) {
  const result = divisor.map((_) => 0);
  for (const b of data) {
    const factor = b ^ result.shift();
    result.push(0);
    divisor.forEach((coef, i) => result[i] ^= reedSolomonMultiply(coef, factor));
  }
  return result;
}
__name(reedSolomonComputeRemainder, "reedSolomonComputeRemainder");
function reedSolomonMultiply(x, y) {
  if (x >>> 8 !== 0 || y >>> 8 !== 0)
    throw new RangeError("Byte out of range");
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = z << 1 ^ (z >>> 7) * 285;
    z ^= (y >>> i & 1) * x;
  }
  return z;
}
__name(reedSolomonMultiply, "reedSolomonMultiply");
function encodeSegments(segs, ecl, minVersion = 1, maxVersion = 40, mask = -1, boostEcl = true) {
  if (!(MIN_VERSION <= minVersion && minVersion <= maxVersion && maxVersion <= MAX_VERSION) || mask < -1 || mask > 7) {
    throw new RangeError("Invalid value");
  }
  let version;
  let dataUsedBits;
  for (version = minVersion; ; version++) {
    const dataCapacityBits2 = getNumDataCodewords(version, ecl) * 8;
    const usedBits = getTotalBits(segs, version);
    if (usedBits <= dataCapacityBits2) {
      dataUsedBits = usedBits;
      break;
    }
    if (version >= maxVersion)
      throw new RangeError("Data too long");
  }
  for (const newEcl of [MEDIUM, QUARTILE, HIGH]) {
    if (boostEcl && dataUsedBits <= getNumDataCodewords(version, newEcl) * 8)
      ecl = newEcl;
  }
  const bb = [];
  for (const seg of segs) {
    appendBits(seg.mode[0], 4, bb);
    appendBits(seg.numChars, numCharCountBits(seg.mode, version), bb);
    for (const b of seg.getData())
      bb.push(b);
  }
  const dataCapacityBits = getNumDataCodewords(version, ecl) * 8;
  appendBits(0, Math.min(4, dataCapacityBits - bb.length), bb);
  appendBits(0, (8 - bb.length % 8) % 8, bb);
  for (let padByte = 236; bb.length < dataCapacityBits; padByte ^= 236 ^ 17)
    appendBits(padByte, 8, bb);
  const dataCodewords = Array.from({ length: Math.ceil(bb.length / 8) }, () => 0);
  bb.forEach((b, i) => dataCodewords[i >>> 3] |= b << 7 - (i & 7));
  return new QrCode(version, ecl, dataCodewords, mask);
}
__name(encodeSegments, "encodeSegments");
function encode(data, options) {
  const {
    ecc = "L",
    boostEcc = false,
    minVersion = 1,
    maxVersion = 40,
    maskPattern = -1,
    border = 1
  } = options || {};
  const segment = typeof data === "string" ? makeSegments(data) : Array.isArray(data) ? [makeBytes(data)] : void 0;
  if (!segment)
    throw new Error(`uqr only supports encoding string and binary data, but got: ${typeof data}`);
  const qr2 = encodeSegments(
    segment,
    EccMap[ecc],
    minVersion,
    maxVersion,
    maskPattern,
    boostEcc
  );
  const result = addBorder({
    version: qr2.version,
    maskPattern: qr2.mask,
    size: qr2.size,
    data: qr2.modules,
    types: qr2.types
  }, border);
  if (options?.invert)
    result.data = result.data.map((row) => row.map((mod) => !mod));
  options?.onEncoded?.(result);
  return result;
}
__name(encode, "encode");
function addBorder(input, border = 1) {
  if (!border)
    return input;
  const { size } = input;
  const newSize = size + border * 2;
  input.size = newSize;
  input.data.forEach((row) => {
    for (let i = 0; i < border; i++) {
      row.unshift(false);
      row.push(false);
    }
  });
  for (let i = 0; i < border; i++) {
    input.data.unshift(Array.from({ length: newSize }, (_) => false));
    input.data.push(Array.from({ length: newSize }, (_) => false));
  }
  const b = QrCodeDataType.Border;
  input.types.forEach((row) => {
    for (let i = 0; i < border; i++) {
      row.unshift(b);
      row.push(b);
    }
  });
  for (let i = 0; i < border; i++) {
    input.types.unshift(Array.from({ length: newSize }, (_) => b));
    input.types.push(Array.from({ length: newSize }, (_) => b));
  }
  return input;
}
__name(addBorder, "addBorder");
function escapeAttr(value) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
__name(escapeAttr, "escapeAttr");
function renderSVG(data, options = {}) {
  const result = encode(data, options);
  const {
    pixelSize = 10,
    whiteColor = "white",
    blackColor = "black"
  } = options;
  const height = result.size * pixelSize;
  const width = result.size * pixelSize;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">`;
  const paths = [];
  for (let row = 0; row < result.size; row++) {
    for (let col = 0; col < result.size; col++) {
      const x = col * pixelSize;
      const y = row * pixelSize;
      if (result.data[row][col])
        paths.push(`M${x},${y}h${pixelSize}v${pixelSize}h-${pixelSize}z`);
    }
  }
  svg += `<rect fill="${escapeAttr(whiteColor)}" width="${width}" height="${height}"/>`;
  svg += `<path fill="${escapeAttr(blackColor)}" d="${paths.join("")}"/>`;
  svg += "</svg>";
  return svg;
}
__name(renderSVG, "renderSVG");

// logic.mjs
var HttpError = class extends Error {
  static {
    __name(this, "HttpError");
  }
  constructor(status, message) {
    super(message);
    this.status = status;
  }
};
var STATUSES = {
  received: { label: "Ricevuto", step: 0, hint: "Abbiamo preso in carico il tuo dispositivo." },
  diagnosing: { label: "In diagnosi", step: 1, hint: "Stiamo controllando il guasto." },
  quote_pending: { label: "Preventivo da approvare", step: 2, hint: "Ti abbiamo inviato il preventivo: attendiamo la tua conferma." },
  approved: { label: "Preventivo approvato", step: 3, hint: "Preventivo approvato: si procede con la riparazione." },
  waiting_parts: { label: "In attesa ricambi", step: 3, hint: "Stiamo aspettando il ricambio necessario." },
  repairing: { label: "In riparazione", step: 3, hint: "Il tecnico sta lavorando sul tuo dispositivo." },
  ready: { label: "Pronto per il ritiro", step: 4, hint: "Puoi passare a ritirare il tuo dispositivo." },
  delivered: { label: "Consegnato", step: 5, hint: "Dispositivo consegnato. Grazie per averci scelto!" },
  cancelled: { label: "Annullato / non riparabile", step: -1, hint: "La riparazione non \xE8 stata eseguita." }
};
var STEP_LABELS = ["Ricevuto", "Diagnosi", "Preventivo", "Lavori", "Pronto", "Ritirato"];
var NEXT_STATUS = {
  received: "diagnosing",
  diagnosing: "quote_pending",
  quote_pending: "approved",
  approved: "repairing",
  waiting_parts: "repairing",
  repairing: "ready",
  ready: "delivered"
};
var progressPct = /* @__PURE__ */ __name((status) => {
  const s = STATUSES[status];
  if (!s || s.step < 0) return 0;
  return Math.round(s.step / 5 * 100);
}, "progressPct");
var localDate = /* @__PURE__ */ __name((d2 = /* @__PURE__ */ new Date()) => nowLocal(d2).slice(0, 10), "localDate");
var num = /* @__PURE__ */ __name((v, def = null) => {
  if (v === "" || v == null) return def;
  const n = Number(String(v).replace(",", "."));
  if (!Number.isFinite(n)) throw new HttpError(400, `Valore numerico non valido: ${v}`);
  return n;
}, "num");
var money = /* @__PURE__ */ __name((v) => v == null ? null : Math.round(Number(v) * 100) / 100, "money");
var str = /* @__PURE__ */ __name((v) => v == null ? null : String(v).trim() || null, "str");
var need = /* @__PURE__ */ __name((v, what) => {
  const s = str(v);
  if (!s) throw new HttpError(400, `${what} obbligatorio`);
  return s;
}, "need");
var newToken = /* @__PURE__ */ __name(() => {
  const b = globalThis.crypto.getRandomValues(new Uint8Array(9));
  return btoa(String.fromCharCode(...b)).replace(/[+]/g, "-").replace(/[/]/g, "_").replace(/=+$/, "");
}, "newToken");
async function nextCode(table, prefix) {
  const year = nowLocal().slice(0, 4);
  const like = `${prefix}-${year}-%`;
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE code LIKE ?`).get(like);
  return `${prefix}-${year}-${String(row.n + 1).padStart(4, "0")}`;
}
__name(nextCode, "nextCode");
async function logEvent(repairId, status, note, isPublic = 1) {
  await db.prepare("INSERT INTO repair_events (repair_id, status, note, is_public, created_at) VALUES (?,?,?,?,datetime('now','localtime'))").run(
    repairId,
    status,
    note || null,
    isPublic ? 1 : 0
  );
  await db.prepare("UPDATE repairs SET updated_at = datetime('now','localtime') WHERE id = ?").run(repairId);
}
__name(logEvent, "logEvent");
async function moveStock(productId, delta, reason, ref) {
  const p = await db.prepare("SELECT qty FROM products WHERE id = ?").get(productId);
  if (!p) throw new HttpError(404, "Prodotto non trovato");
  await db.prepare("UPDATE products SET qty = qty + ? WHERE id = ?").run(delta, productId);
  await db.prepare("INSERT INTO stock_moves (product_id, delta, reason, ref, created_at) VALUES (?,?,?,?,datetime('now','localtime'))").run(productId, delta, reason, ref || null);
}
__name(moveStock, "moveStock");
async function addPayment(kind, refId, label, amount, method) {
  if (!amount || amount <= 0) return;
  await db.prepare("INSERT INTO payments (kind, ref_id, label, amount, method, created_at) VALUES (?,?,?,?,?,datetime('now','localtime'))").run(
    kind,
    refId,
    label,
    money(amount),
    method || "contanti"
  );
}
__name(addPayment, "addPayment");
var phoneKey = /* @__PURE__ */ __name((p) => {
  const d2 = String(p || "").replace(/\D/g, "");
  return d2.length >= 7 ? d2.slice(-9) : d2;
}, "phoneKey");
async function upsertCustomer({ id, name, phone, email, notes }) {
  if (id) {
    const c = await db.prepare("SELECT * FROM customers WHERE id = ?").get(id);
    if (!c) throw new HttpError(404, "Cliente non trovato");
    return c.id;
  }
  const n = need(name, "Nome cliente");
  const ph = str(phone);
  if (ph) {
    const key = phoneKey(ph);
    if (key) {
      const same = (await db.prepare("SELECT id, phone FROM customers WHERE phone IS NOT NULL").all()).find((c) => phoneKey(c.phone) === key);
      if (same) return same.id;
    }
  }
  const r = await db.prepare("INSERT INTO customers (name, phone, email, notes, created_at) VALUES (?,?,?,?,datetime('now','localtime'))").run(n, ph, str(email), str(notes));
  return Number(r.lastInsertRowid);
}
__name(upsertCustomer, "upsertCustomer");
async function createRepair(b) {
  return tx(async () => {
    const customerId = await upsertCustomer(b.customer || {});
    const settings = await getSettings();
    const quote = num(b.quote);
    const deposit = num(b.deposit, 0);
    if (quote != null && quote < 0 || deposit < 0) throw new HttpError(400, "Gli importi non possono essere negativi");
    const code = await nextCode("repairs", "R");
    const token = newToken();
    const r = await db.prepare(
      `INSERT INTO repairs (code, token, customer_id, device_type, brand_model, serial, problem, accessories,
        condition_notes, passcode, quote, deposit, eta_date, warranty_days, quote_decision, urgent, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now','localtime'),datetime('now','localtime'))`
    ).run(
      code,
      token,
      customerId,
      str(b.device_type) || "smartphone",
      need(b.brand_model, "Dispositivo"),
      str(b.serial),
      need(b.problem, "Problema segnalato"),
      str(b.accessories),
      str(b.condition_notes),
      str(b.passcode),
      quote,
      money(deposit),
      str(b.eta_date),
      num(b.warranty_days, Number(settings.default_warranty_days) || 90),
      // se il preventivo è già concordato al banco lo consideriamo approvato dal cliente
      b.quote_agreed && quote != null ? "accepted" : null,
      b.urgent ? 1 : 0
    );
    const id = Number(r.lastInsertRowid);
    await logEvent(id, "received", "Dispositivo ricevuto in laboratorio.");
    if (deposit > 0) await addPayment("repair", id, `Acconto ${code}`, deposit, b.deposit_method);
    if (b.quote_agreed && quote != null) {
      await db.prepare("UPDATE repairs SET status='approved', quote_decided_at=datetime('now','localtime') WHERE id=?").run(id);
      await logEvent(id, "approved", "Preventivo concordato al banco.");
    }
    return await getRepair(id);
  });
}
__name(createRepair, "createRepair");
var REPAIR_SELECT = `SELECT r.*, c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email
  FROM repairs r JOIN customers c ON c.id = r.customer_id`;
async function getRepair(id) {
  const r = await db.prepare(`${REPAIR_SELECT} WHERE r.id = ?`).get(id);
  if (!r) throw new HttpError(404, "Riparazione non trovata");
  return await decorateRepair(r, true);
}
__name(getRepair, "getRepair");
async function decorateRepair(r, full = false) {
  const st = STATUSES[r.status];
  const out = {
    ...r,
    status_label: st.label,
    progress: progressPct(r.status),
    next_status: NEXT_STATUS[r.status] || null,
    next_label: NEXT_STATUS[r.status] ? STATUSES[NEXT_STATUS[r.status]].label : null,
    late: !!(r.eta_date && !["ready", "delivered", "cancelled"].includes(r.status) && r.eta_date < localDate())
  };
  if (full) {
    out.events = await db.prepare("SELECT * FROM repair_events WHERE repair_id = ? ORDER BY id DESC").all(r.id);
    out.parts = await db.prepare("SELECT * FROM repair_parts WHERE repair_id = ? ORDER BY id").all(r.id);
    out.paid = money((await db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE kind='repair' AND ref_id=?").get(r.id)).s);
    const warrantyUntil = r.delivered_at ? new Date(new Date(r.delivered_at.replace(" ", "T")).getTime() + r.warranty_days * 864e5) : null;
    out.warranty_until = warrantyUntil ? localDate(warrantyUntil) : null;
  }
  return out;
}
__name(decorateRepair, "decorateRepair");
async function listRepairs({ status, q, customer_id, open } = {}) {
  const where = [];
  const args = [];
  if (status) {
    where.push("r.status = ?");
    args.push(status);
  }
  if (open) where.push("r.status NOT IN ('delivered','cancelled')");
  if (customer_id) {
    where.push("r.customer_id = ?");
    args.push(Number(customer_id));
  }
  if (q) {
    where.push("(r.code LIKE ? OR r.brand_model LIKE ? OR r.serial LIKE ? OR c.name LIKE ? OR c.phone LIKE ? OR r.problem LIKE ?)");
    const like = `%${q}%`;
    args.push(like, like, like, like, like, like);
  }
  const sql = `${REPAIR_SELECT} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY r.urgent DESC, r.updated_at DESC, r.id DESC LIMIT 500`;
  return Promise.all((await db.prepare(sql).all(...args)).map((r) => decorateRepair(r)));
}
__name(listRepairs, "listRepairs");
var EDITABLE = ["device_type", "brand_model", "serial", "problem", "accessories", "condition_notes", "passcode", "quote", "eta_date", "warranty_days", "tech_notes", "customer_note", "final_price"];
async function updateRepair(id, b) {
  return tx(async () => {
    const r = await db.prepare("SELECT * FROM repairs WHERE id = ?").get(id);
    if (!r) throw new HttpError(404, "Riparazione non trovata");
    const sets = [];
    const args = [];
    for (const k of EDITABLE) {
      if (!(k in b)) continue;
      let v = b[k];
      if (["quote", "final_price"].includes(k)) {
        v = num(v);
        if (v != null && v < 0) throw new HttpError(400, "Gli importi non possono essere negativi");
      } else if (k === "warranty_days") v = num(v, 90);
      else v = str(v);
      if (["brand_model", "problem"].includes(k) && !v) throw new HttpError(400, `${k} obbligatorio`);
      sets.push(`${k} = ?`);
      args.push(v);
    }
    if ("urgent" in b) {
      sets.push("urgent = ?");
      args.push(b.urgent ? 1 : 0);
    }
    if (!sets.length) return await getRepair(id);
    if ("quote" in b && num(b.quote) !== r.quote && ["approved", "waiting_parts", "repairing"].includes(r.status) && r.quote != null) {
      sets.push("quote_decision = NULL", "status = 'quote_pending'");
      await logEvent(id, "quote_pending", `Preventivo aggiornato a ${money(num(b.quote)).toFixed(2)} \u20AC: serve una nuova approvazione.`);
    } else if ("quote" in b && num(b.quote) !== r.quote) {
      sets.push("quote_decision = NULL");
    }
    if ("eta_date" in b && str(b.eta_date) !== r.eta_date) await logEvent(id, null, str(b.eta_date) ? `Nuova data stimata: ${str(b.eta_date)}.` : "Data stimata rimossa.");
    sets.push("updated_at = datetime('now','localtime')");
    await db.prepare(`UPDATE repairs SET ${sets.join(", ")} WHERE id = ?`).run(...args, id);
    if (b.customer && (b.customer.name || b.customer.phone || b.customer.email)) {
      await db.prepare("UPDATE customers SET name = COALESCE(?, name), phone = COALESCE(?, phone), email = COALESCE(?, email) WHERE id = ?").run(
        str(b.customer.name),
        str(b.customer.phone),
        str(b.customer.email),
        r.customer_id
      );
    }
    return await getRepair(id);
  });
}
__name(updateRepair, "updateRepair");
async function setStatus(id, status, note, isPublic = true) {
  return tx(async () => {
    const r = await db.prepare("SELECT * FROM repairs WHERE id = ?").get(id);
    if (!r) throw new HttpError(404, "Riparazione non trovata");
    if (!STATUSES[status]) throw new HttpError(400, "Stato non valido");
    if (r.status === "delivered") throw new HttpError(409, "La riparazione \xE8 gi\xE0 stata consegnata.");
    if (r.status === status) throw new HttpError(400, "La riparazione \xE8 gi\xE0 in questo stato.");
    if (status === "delivered") throw new HttpError(400, 'Per consegnare usa "Consegna e incassa".');
    if (status === "quote_pending" && r.quote == null) throw new HttpError(400, "Inserisci prima il preventivo.");
    await db.prepare("UPDATE repairs SET status = ?, quote_decision = CASE WHEN ?='quote_pending' THEN NULL ELSE quote_decision END WHERE id = ?").run(status, status, id);
    if (status === "approved" && !r.quote_decision) {
      await db.prepare("UPDATE repairs SET quote_decision='accepted', quote_decided_at=datetime('now','localtime') WHERE id=?").run(id);
    }
    await logEvent(id, status, note || STATUSES[status].hint, isPublic);
    return await getRepair(id);
  });
}
__name(setStatus, "setStatus");
async function deliverRepair(id, { final_price, method, note } = {}) {
  return tx(async () => {
    const r = await db.prepare("SELECT * FROM repairs WHERE id = ?").get(id);
    if (!r) throw new HttpError(404, "Riparazione non trovata");
    if (r.status === "delivered") throw new HttpError(400, "Gi\xE0 consegnata.");
    const final = money(num(final_price, r.final_price ?? r.quote ?? 0));
    const paid = (await db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE kind='repair' AND ref_id=?").get(id)).s;
    const due = Math.max(0, money(final - paid));
    await addPayment("repair", id, `Saldo ${r.code}`, due, method);
    await db.prepare("UPDATE repairs SET status='delivered', final_price=?, delivered_at=datetime('now','localtime') WHERE id=?").run(final, id);
    await logEvent(id, "delivered", note || STATUSES.delivered.hint);
    return { ...await getRepair(id), collected: due };
  });
}
__name(deliverRepair, "deliverRepair");
async function addPart(repairId, { product_id, name, qty, unit_price }) {
  return tx(async () => {
    const r = await db.prepare("SELECT code FROM repairs WHERE id = ?").get(repairId);
    if (!r) throw new HttpError(404, "Riparazione non trovata");
    const q = Math.max(1, Math.round(num(qty, 1)));
    let pName = str(name), price = num(unit_price, 0), cost = 0, pid = null;
    if (product_id) {
      const p = await db.prepare("SELECT * FROM products WHERE id = ?").get(product_id);
      if (!p) throw new HttpError(404, "Prodotto non trovato");
      pid = p.id;
      pName = pName || p.name;
      cost = p.cost;
      if (unit_price === void 0 || unit_price === "") price = p.price;
      await moveStock(p.id, -q, "riparazione", r.code);
    }
    if (!pName) throw new HttpError(400, "Nome ricambio obbligatorio");
    await db.prepare("INSERT INTO repair_parts (repair_id, product_id, name, qty, unit_price, unit_cost) VALUES (?,?,?,?,?,?)").run(repairId, pid, pName, q, money(price), money(cost));
    await logEvent(repairId, null, `Ricambio usato: ${pName}${q > 1 ? ` \xD7${q}` : ""}.`, 0);
    return await getRepair(repairId);
  });
}
__name(addPart, "addPart");
async function removePart(repairId, partId) {
  return tx(async () => {
    const part = await db.prepare("SELECT * FROM repair_parts WHERE id = ? AND repair_id = ?").get(partId, repairId);
    if (!part) throw new HttpError(404, "Ricambio non trovato");
    if (part.product_id) {
      const r = await db.prepare("SELECT code FROM repairs WHERE id = ?").get(repairId);
      await moveStock(part.product_id, part.qty, "rimosso da riparazione", r.code);
    }
    await db.prepare("DELETE FROM repair_parts WHERE id = ?").run(partId);
    return await getRepair(repairId);
  });
}
__name(removePart, "removePart");
async function addNote(id, note, isPublic) {
  const text = need(note, "Nota");
  const r = await db.prepare("SELECT status FROM repairs WHERE id = ?").get(id);
  if (!r) throw new HttpError(404, "Riparazione non trovata");
  await logEvent(id, null, text, isPublic);
  return await getRepair(id);
}
__name(addNote, "addNote");
async function createSale(b) {
  return tx(async () => {
    const items = Array.isArray(b.items) ? b.items : [];
    if (!items.length) throw new HttpError(400, "Aggiungi almeno un articolo");
    const code = await nextCode("sales", "V");
    const sale = await db.prepare("INSERT INTO sales (code, customer_id, total, discount, method, notes, created_at) VALUES (?,?,?,?,?,?,datetime('now','localtime'))").run(
      code,
      b.customer_id || null,
      0,
      money(num(b.discount, 0)),
      str(b.method) || "contanti",
      str(b.notes)
    );
    const saleId = Number(sale.lastInsertRowid);
    let total = 0;
    for (const it of items) {
      const q = Math.max(1, Math.round(num(it.qty, 1)));
      let name = str(it.name), price = num(it.unit_price), cost = 0, pid = null;
      if (it.product_id) {
        const p = await db.prepare("SELECT * FROM products WHERE id = ?").get(it.product_id);
        if (!p) throw new HttpError(404, "Prodotto non trovato");
        pid = p.id;
        name = name || p.name;
        cost = p.cost;
        if (price == null) price = p.price;
        await moveStock(p.id, -q, "vendita", code);
      }
      if (!name) throw new HttpError(400, "Nome articolo obbligatorio");
      if (price == null || price < 0) throw new HttpError(400, `Prezzo mancante per ${name}`);
      await db.prepare("INSERT INTO sale_items (sale_id, product_id, name, qty, unit_price, unit_cost) VALUES (?,?,?,?,?,?)").run(saleId, pid, name, q, money(price), money(cost));
      total += q * price;
    }
    total = money(total - num(b.discount, 0));
    if (total < 0) throw new HttpError(400, "Lo sconto supera il totale");
    await db.prepare("UPDATE sales SET total = ? WHERE id = ?").run(total, saleId);
    await addPayment("sale", saleId, `Vendita ${code}`, total, b.method);
    return await getSale(saleId);
  });
}
__name(createSale, "createSale");
async function getSale(id) {
  const s = await db.prepare("SELECT s.*, c.name AS customer_name FROM sales s LEFT JOIN customers c ON c.id = s.customer_id WHERE s.id = ?").get(id);
  if (!s) throw new HttpError(404, "Vendita non trovata");
  return { ...s, items: await db.prepare("SELECT * FROM sale_items WHERE sale_id = ?").all(id) };
}
__name(getSale, "getSale");
var maskPhone = /* @__PURE__ */ __name((p) => p ? p.replace(/\s/g, "").replace(/.(?=.{3})/g, "\u2022") : null, "maskPhone");
var maskEmail = /* @__PURE__ */ __name((e) => {
  if (!e || !e.includes("@")) return null;
  const [u, d2] = e.split("@");
  return `${u.slice(0, 2)}${"\u2022".repeat(Math.max(1, u.length - 2))}@${d2}`;
}, "maskEmail");
async function publicView(token) {
  const r = await db.prepare(`${REPAIR_SELECT} WHERE r.token = ?`).get(token);
  if (!r) throw new HttpError(404, "Riparazione non trovata");
  const s = await getSettings();
  const events = await db.prepare("SELECT status, note, created_at FROM repair_events WHERE repair_id = ? AND is_public = 1 ORDER BY id DESC").all(r.id);
  const paid = money((await db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE kind='repair' AND ref_id=?").get(r.id)).s);
  const total = r.final_price ?? r.quote;
  const st = STATUSES[r.status];
  return {
    code: r.code,
    status: r.status,
    status_label: st.label,
    status_hint: st.hint,
    step: st.step,
    steps: STEP_LABELS,
    progress: progressPct(r.status),
    cancelled: r.status === "cancelled",
    device: {
      type: r.device_type,
      model: r.brand_model,
      serial_tail: r.serial ? `\u2022\u2022\u2022\u2022${r.serial.slice(-4)}` : null,
      problem: r.problem,
      accessories: r.accessories,
      condition: r.condition_notes
    },
    customer: { name: r.customer_name, phone: maskPhone(r.customer_phone), email: maskEmail(r.customer_email) },
    quote: r.quote,
    final_price: r.final_price,
    deposit: r.deposit,
    paid,
    balance: total == null ? null : Math.max(0, money(total - paid)),
    eta_date: r.eta_date,
    quote_decision: r.quote_decision,
    awaiting_decision: r.status === "quote_pending" && r.quote != null,
    customer_note: r.customer_note,
    received_at: r.created_at,
    delivered_at: r.delivered_at,
    warranty_days: r.warranty_days,
    events,
    shop: { name: s.shop_name, address: s.shop_address, phone: s.shop_phone },
    updated_at: r.updated_at
  };
}
__name(publicView, "publicView");
async function customerDecision(token, accept) {
  return tx(async () => {
    const r = await db.prepare("SELECT * FROM repairs WHERE token = ?").get(token);
    if (!r) throw new HttpError(404, "Riparazione non trovata");
    if (r.status !== "quote_pending") throw new HttpError(409, "Nessun preventivo in attesa di risposta.");
    if (accept) {
      await db.prepare("UPDATE repairs SET status='approved', quote_decision='accepted', quote_decided_at=datetime('now','localtime') WHERE id=?").run(r.id);
      await logEvent(r.id, "approved", "Preventivo approvato dal cliente online.");
    } else {
      await db.prepare("UPDATE repairs SET quote_decision='declined', quote_decided_at=datetime('now','localtime') WHERE id=?").run(r.id);
      await logEvent(r.id, "quote_pending", "Il cliente ha rifiutato il preventivo: contattalo.");
    }
    return await publicView(token);
  });
}
__name(customerDecision, "customerDecision");
async function dashboard() {
  const counts = Object.fromEntries((await db.prepare("SELECT status, COUNT(*) AS n FROM repairs GROUP BY status").all()).map((r) => [r.status, r.n]));
  const today = localDate();
  const open = await listRepairs({ open: true });
  return {
    counts,
    open_total: open.length,
    ready: open.filter((r) => r.status === "ready"),
    late: open.filter((r) => r.late),
    to_approve: open.filter((r) => r.status === "quote_pending"),
    declined: open.filter((r) => r.quote_decision === "declined"),
    waiting_parts: open.filter((r) => r.status === "waiting_parts"),
    in_progress: open.filter((r) => ["received", "diagnosing", "approved", "repairing"].includes(r.status)),
    low_stock: await lowStock(),
    cash_today: money((await db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE date(created_at)=?").get(today)).s),
    today
  };
}
__name(dashboard, "dashboard");
async function lowStock() {
  return await db.prepare(`SELECT p.*, s.name AS supplier_name, s.phone AS supplier_phone, s.email AS supplier_email
    FROM products p LEFT JOIN suppliers s ON s.id = p.supplier_id
    WHERE p.active = 1 AND p.min_qty > 0 AND p.qty <= p.min_qty ORDER BY s.name, p.name`).all();
}
__name(lowStock, "lowStock");
async function report(from, to) {
  const f = from || localDate();
  const t = to || f;
  const byMethod = await db.prepare("SELECT method, ROUND(SUM(amount),2) AS total, COUNT(*) AS n FROM payments WHERE date(created_at) BETWEEN ? AND ? GROUP BY method").all(f, t);
  const byKind = await db.prepare("SELECT kind, ROUND(SUM(amount),2) AS total, COUNT(*) AS n FROM payments WHERE date(created_at) BETWEEN ? AND ? GROUP BY kind").all(f, t);
  const rows = await db.prepare("SELECT * FROM payments WHERE date(created_at) BETWEEN ? AND ? ORDER BY id DESC").all(f, t);
  const cost = (await db.prepare(`SELECT COALESCE(SUM(si.qty*si.unit_cost),0) AS c FROM sale_items si JOIN sales s ON s.id=si.sale_id WHERE date(s.created_at) BETWEEN ? AND ?`).get(f, t)).c + (await db.prepare(`SELECT COALESCE(SUM(rp.qty*rp.unit_cost),0) AS c FROM repair_parts rp JOIN repairs r ON r.id=rp.repair_id WHERE r.delivered_at IS NOT NULL AND date(r.delivered_at) BETWEEN ? AND ?`).get(f, t)).c;
  const total = money(rows.reduce((a, r) => a + r.amount, 0));
  return { from: f, to: t, total, parts_cost: money(cost), by_method: byMethod, by_kind: byKind, rows };
}
__name(report, "report");
async function reportByDay(from, to) {
  return await db.prepare("SELECT date(created_at) AS day, ROUND(SUM(amount),2) AS total FROM payments WHERE date(created_at) BETWEEN ? AND ? GROUP BY day ORDER BY day").all(from, to);
}
__name(reportByDay, "reportByDay");
async function stockSummary() {
  const s = await db.prepare(`SELECT COUNT(*) AS items, COALESCE(SUM(qty),0) AS units,
    COALESCE(SUM(MAX(qty,0)*cost),0) AS value_cost, COALESCE(SUM(MAX(qty,0)*price),0) AS value_price
    FROM products WHERE active = 1`).get();
  return { ...s, value_cost: money(s.value_cost), value_price: money(s.value_price), low: (await lowStock()).length };
}
__name(stockSummary, "stockSummary");
var lookupFails = { n: 0, t: Date.now() };
async function lookup(code, phone4) {
  if (Date.now() - lookupFails.t > 6e5) {
    lookupFails.n = 0;
    lookupFails.t = Date.now();
  }
  if (lookupFails.n >= 30) throw new HttpError(429, "Troppi tentativi: riprova tra qualche minuto o chiamaci.");
  const fail = /* @__PURE__ */ __name(() => {
    lookupFails.n++;
    return new HttpError(404, "Non troviamo questa riparazione. Controlla il numero sulla ricevuta e le ultime 4 cifre del telefono, oppure chiamaci.");
  }, "fail");
  const raw2 = String(code || "").trim().toUpperCase();
  const last4 = String(phone4 || "").replace(/\D/g, "").slice(-4);
  if (!raw2 || last4.length !== 4) throw fail();
  const digits = raw2.replace(/[^0-9-]/g, "");
  let full = raw2;
  if (/^\d{4}-\d{1,4}$/.test(digits)) full = `R-${digits.split("-")[0]}-${digits.split("-")[1].padStart(4, "0")}`;
  else if (/^\d{1,4}$/.test(digits)) full = `R-${nowLocal().slice(0, 4)}-${digits.padStart(4, "0")}`;
  const r = await db.prepare(`${REPAIR_SELECT} WHERE r.code = ?`).get(full);
  if (!r || !r.customer_phone || String(r.customer_phone).replace(/\D/g, "").slice(-4) !== last4) throw fail();
  return { token: r.token };
}
__name(lookup, "lookup");

// barcode.mjs
var PATTERNS = "212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232 2331112".split(" ");
var START_B = 104;
var STOP = 106;
function code128bModules(text) {
  const chars = [...String(text)].map((c) => {
    const n = c.charCodeAt(0);
    return n >= 32 && n <= 126 ? n - 32 : 31;
  });
  let sum = START_B;
  chars.forEach((v, i) => {
    sum += v * (i + 1);
  });
  const symbols = [START_B, ...chars, sum % 103, STOP];
  let bits = "";
  for (const s of symbols) {
    [...PATTERNS[s]].forEach((w, i) => {
      bits += (i % 2 === 0 ? "1" : "0").repeat(Number(w));
    });
  }
  return bits;
}
__name(code128bModules, "code128bModules");
function barcodeSvg(text, { height = 46, module = 2, quiet = 10 } = {}) {
  const bits = code128bModules(text);
  const width = (bits.length + quiet * 2) * module;
  let rects = "";
  for (let i = 0; i < bits.length; ) {
    if (bits[i] !== "1") {
      i++;
      continue;
    }
    let j = i;
    while (bits[j] === "1") j++;
    rects += `<rect x="${(quiet + i) * module}" y="0" width="${(j - i) * module}" height="${height}"/>`;
    i = j;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" preserveAspectRatio="none" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><g fill="#000">${rects}</g></svg>`;
}
__name(barcodeSvg, "barcodeSvg");

// print.mjs
var esc = /* @__PURE__ */ __name((s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]), "esc");
var eur = /* @__PURE__ */ __name((n) => n == null ? "\u2014" : Number(n).toLocaleString("it-IT", { style: "currency", currency: "EUR" }), "eur");
var dt = /* @__PURE__ */ __name((s) => s ? new Date(s.replace(" ", "T")).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" }) : "\u2014", "dt");
var d = /* @__PURE__ */ __name((s) => s ? (/* @__PURE__ */ new Date(s + "T00:00:00")).toLocaleDateString("it-IT") : "\u2014", "d");
var qr = /* @__PURE__ */ __name((text, size = 130) => `<img src="/api/qr?text=${encodeURIComponent(text)}" width="${size}" height="${size}" alt="QR" />`, "qr");
var barcode = /* @__PURE__ */ __name((text, w = 150, h2 = 34) => `<img src="/api/barcode?text=${encodeURIComponent(text)}" style="width:${w}px;height:${h2}px;display:block" alt="codice a barre ${esc(text)}" />`, "barcode");
var TYPES = { smartphone: "Smartphone", tablet: "Tablet", portatile: "Portatile", pc: "PC fisso", console: "Console", altro: "Altro" };
var BASE_CSS = `
  *{box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;padding:18px;font-size:12px;line-height:1.35}
  h1{font-size:18px;margin:0}
  h2{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#B91C1C;margin:12px 0 4px;border-bottom:1px solid #ddd;padding-bottom:2px}
  table{width:100%;border-collapse:collapse} td,th{padding:2px 4px;text-align:left;vertical-align:top} th{font-size:10.5px;color:#555;font-weight:600;white-space:nowrap}
  .row{display:flex;gap:14px;justify-content:space-between;align-items:flex-start}
  .muted{color:#555} .big{font-size:20px;font-weight:700} .center{text-align:center}
  .box{border:1px solid #bbb;border-radius:6px;padding:7px 9px}
  .sign{margin-top:22px;display:flex;gap:30px} .sign div{flex:1;border-top:1px solid #333;padding-top:3px;font-size:10.5px;color:#555}
  .terms{font-size:9px;color:#444;line-height:1.35;margin-top:8px}
  .pill{display:inline-block;border:1px solid #111;border-radius:99px;padding:1px 9px;font-size:10px;font-weight:700;letter-spacing:.04em}
  .pill.urg{background:#B91C1C;color:#fff;border-color:#B91C1C}
  .ck{display:grid;grid-template-columns:repeat(3,1fr);gap:2px 10px;font-size:11px}
  .ck span:before{content:"";display:inline-block;width:9px;height:9px;border:1.2px solid #111;margin-right:5px;vertical-align:-1px}
  .lines{height:15px;border-bottom:1px solid #999}
  .pass{font-family:"Courier New",monospace;font-size:16px;font-weight:700;border:2px dashed #111;border-radius:6px;padding:5px 10px;min-height:32px}
  .page{page-break-after:always} .page:last-child{page-break-after:auto}
  .noprint{margin-bottom:12px} .noprint button{padding:8px 14px;font-weight:700;cursor:pointer}
  @media print{ .noprint{display:none} body{padding:0;font-size:11px} h2{margin:9px 0 3px} .lines{height:14px} @page{size:A4;margin:12mm} }
`;
function page(title, body, extraCss = "", req = {}) {
  const auto = req.noprint ? "" : `<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),400))<\/script>`;
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${BASE_CSS}${extraCss}</style></head><body>
  <div class="noprint"><button onclick="window.print()">Stampa</button></div>${body}${auto}</body></html>`;
}
__name(page, "page");
var header = /* @__PURE__ */ __name((s, kind, r) => `
  <div class="row">
    <div><h1>${esc(s.shop_name)}</h1><div class="muted">${esc(s.shop_address)}<br>Tel. ${esc(s.shop_phone)}</div></div>
    <div style="text-align:right"><div class="muted">${kind}</div><div class="big">${esc(r.code)}</div>
      <div class="muted">Ricevuto il ${dt(r.created_at)}</div>${r.urgent ? '<div><span class="pill urg">URGENTE</span></div>' : ""}
      <div style="margin-top:4px;display:inline-block">${barcode(r.code, 150, 30)}</div></div>
  </div>`, "header");
var customerBlock = /* @__PURE__ */ __name((r, withEmail = true) => `
  <table><tr><td><b style="font-size:14px">${esc(r.customer_name)}</b></td></tr>
  <tr><td>Tel. ${esc(r.customer_phone) || "\u2014"}${withEmail && r.customer_email ? " \xB7 " + esc(r.customer_email) : ""}</td></tr></table>`, "customerBlock");
var deviceBlock = /* @__PURE__ */ __name((r, withPass = false) => `
  <table>
    <tr><th>Tipo</th><td>${esc(TYPES[r.device_type] || r.device_type)}</td><th>Seriale / IMEI</th><td>${esc(r.serial) || "\u2014"}</td></tr>
    <tr><th>Modello</th><td colspan="3"><b style="font-size:13px">${esc(r.brand_model)}</b></td></tr>
    <tr><th>Accessori lasciati</th><td colspan="3">${esc(r.accessories) || "nessuno"}</td></tr>
    <tr><th>Stato estetico</th><td colspan="3">${esc(r.condition_notes) || "\u2014"}</td></tr>
  </table>${withPass ? "" : ""}`, "deviceBlock");
var moneyBlock = /* @__PURE__ */ __name((r) => `
  <table>
    <tr><th>Preventivo</th><td><b>${r.quote != null ? eur(r.quote) : "da definire"}</b></td><th>Acconto versato</th><td>${eur(r.deposit)}</td>
        <th>Saldo previsto</th><td>${r.quote != null ? eur(Math.max(0, r.quote - (r.deposit || 0))) : "\u2014"}</td></tr>
    <tr><th>Consegna stimata</th><td>${d(r.eta_date)}</td><th>Garanzia riparazione</th><td colspan="3">${r.warranty_days} giorni dalla consegna</td></tr>
  </table>`, "moneyBlock");
function customerCard(r, trackUrl, s) {
  return `<div class="page">
  ${header(s, "Scheda cliente \xB7 ricevuta di ingresso", r)}
  <div class="row" style="margin-top:8px">
    <div style="flex:1">
      <h2>Cliente</h2>${customerBlock(r)}
      <h2>Dispositivo consegnato</h2>${deviceBlock(r)}
      <h2>Problema segnalato</h2><div class="box">${esc(r.problem)}</div>
    </div>
    <div class="box center" style="width:178px;margin-top:8px">
      ${qr(trackUrl, 150)}
      <div style="font-size:11px;margin-top:4px"><b>Segui la tua riparazione</b><br>inquadra il QR con il telefono</div>
      <div style="font-size:9px;word-break:break-all;margin-top:4px" class="muted">${esc(trackUrl)}</div>
      <div style="font-size:9.5px;margin-top:5px" class="muted">Vedrai lo stato in tempo reale, il preventivo e potrai approvarlo con un tap.</div>
    </div>
  </div>
  <h2>Preventivo e tempi</h2>${moneyBlock(r)}
  <h2>Come funziona</h2>
  <div style="font-size:10.5px">1) Ti avvisiamo quando il preventivo \xE8 pronto, quando serve la tua conferma e quando il dispositivo \xE8 pronto. 2) Per il ritiro porta questo foglio (o d\xEC il codice <b>${esc(r.code)}</b>) e un documento. 3) Per informazioni: ${esc(s.shop_phone)}.</div>
  <div class="terms"><b>Condizioni:</b> ${esc(s.terms)}</div>
  <div class="sign"><div>Firma del cliente (accetta le condizioni)</div><div>Firma del negozio</div></div>
  </div>`;
}
__name(customerCard, "customerCard");
var CHECK_ENTRY = ["Si accende", "Display / touch", "Fotocamere", "Audio e microfono", "Altoparlante", "Pulsanti", "Ricarica / porta", "Wi-Fi / Bluetooth", "SIM / rete", "Face ID / impronta", "Segni di liquido", "Gi\xE0 aperto da terzi", "Sensori", "Batteria (stato)", "Vetro posteriore"];
var CHECK_DONE = ["Si accende e si avvia", "Display / touch", "Fotocamere", "Audio e microfono", "Altoparlante", "Pulsanti", "Ricarica / porta", "Wi-Fi / Bluetooth", "SIM / rete", "Face ID / impronta", "Sensori", "Batteria / autonomia", "Pulizia / estetica", "Viti e cover chiuse", "Aggiornamenti / reset"];
function labCard(r, trackUrl, s) {
  const parts = r.parts.length ? r.parts.map((p) => `<tr><td>${esc(p.name)}</td><td>${p.qty}</td><td>${eur(p.unit_cost)}</td><td>${eur(p.unit_price)}</td></tr>`).join("") : "";
  const blank = /* @__PURE__ */ __name((n) => Array.from({ length: n }, () => "<tr><td>&nbsp;</td><td></td><td></td><td></td></tr>").join(""), "blank");
  return `<div class="page">
  ${header(s, "Scheda laboratorio \xB7 uso interno", r)}
  <div class="row" style="margin-top:6px;align-items:stretch">
    <div style="flex:1.2"><h2>Cliente</h2>${customerBlock(r)}</div>
    <div style="flex:1"><h2>PIN / schema di sblocco</h2><div class="pass">${esc(r.passcode) || ""}</div></div>
    <div style="width:92px;text-align:center;margin-top:8px">${qr(trackUrl, 82)}<div style="font-size:8px" class="muted">link cliente</div></div>
  </div>
  <h2>Dispositivo</h2>${deviceBlock(r)}
  <h2>Problema segnalato dal cliente</h2><div class="box">${esc(r.problem)}</div>
  <h2>Economico e tempi</h2>${moneyBlock(r)}

  <h2>Controllo all'ingresso (barra ci\xF2 che funziona, cerchia ci\xF2 che non funziona)</h2>
  <div class="ck">${CHECK_ENTRY.map((c) => `<span>${c}</span>`).join("")}</div>
  <h2>Al ritiro in laboratorio</h2>
  <div class="ck" style="grid-template-columns:repeat(2,1fr)">
    <span>Backup dati eseguito / proposto al cliente</span><span>Cliente autorizza reset o formattazione</span>
    <span>Blocco account disattivato (iCloud / Google)</span><span>SIM e scheda SD rimosse e restituite</span>
    <span>Accessori contati e annotati</span><span>Foto del dispositivo scattate</span>
  </div>

  <h2>Diagnosi</h2>
  ${r.tech_notes ? `<div class="box" style="white-space:pre-wrap">${esc(r.tech_notes)}</div>` : '<div class="lines"></div><div class="lines"></div><div class="lines"></div>'}
  <h2>Lavori eseguiti</h2>
  <div class="lines"></div><div class="lines"></div><div class="lines"></div>
  <h2>Ricambi e materiali</h2>
  <table class="box"><tr><th>Ricambio</th><th>Q.t\xE0</th><th>Costo</th><th>Prezzo</th></tr>${parts}${blank(r.parts.length ? 1 : 3)}</table>
  <div class="row" style="margin-top:6px"><div>Tempo impiegato: ______ h ______ min</div><div>Tecnico: ____________________</div><div>Data fine lavori: ___ / ___ / ______</div></div>

  <h2>Collaudo finale (tutto ok prima di avvisare il cliente)</h2>
  <div class="ck">${CHECK_DONE.map((c) => `<span>${c}</span>`).join("")}</div>
  <div class="row" style="margin-top:8px;font-size:11px"><div>Cliente avvisato il ___ / ___ alle ____ con: \u2610 WhatsApp \u2610 telefonata</div><div>Consegnato il ___ / ___ / ______</div></div>
  </div>`;
}
__name(labCard, "labCard");
var printCustomer = /* @__PURE__ */ __name((r, url, s, req) => page(`Scheda cliente ${r.code}`, customerCard(r, url, s), "", req), "printCustomer");
var printLab = /* @__PURE__ */ __name((r, url, s, req) => page(`Scheda laboratorio ${r.code}`, labCard(r, url, s), "", req), "printLab");
var printBoth = /* @__PURE__ */ __name((r, url, s, req) => page(`Schede ${r.code}`, customerCard(r, url, s) + labCard(r, url, s), "", req), "printBoth");
function printLabel(r, trackUrl, req) {
  const body = `<div class="row"><div><div class="big">${esc(r.code)}</div><div><b>${esc(r.brand_model)}</b></div><div>${esc(r.customer_name)}</div>
    <div class="muted">${dt(r.created_at)}</div></div>${qr(trackUrl, 78)}</div>
    <div style="margin-top:2px">${barcode(r.code, 200, 22)}</div>`;
  return page(`Etichetta ${r.code}`, body, "@page{size:62mm 30mm;margin:2mm} body{font-size:10px;padding:0} .big{font-size:14px}", req);
}
__name(printLabel, "printLabel");
function printSale(sale, s, req) {
  const rows = sale.items.map((i) => `<tr><td>${esc(i.name)}</td><td>${i.qty}</td><td style="text-align:right">${eur(i.unit_price)}</td><td style="text-align:right">${eur(i.qty * i.unit_price)}</td></tr>`).join("");
  const body = `
  <div class="row"><div><h1>${esc(s.shop_name)}</h1><div class="muted">${esc(s.shop_address)}<br>Tel. ${esc(s.shop_phone)}</div></div>
  <div style="text-align:right"><div class="muted">Ricevuta di vendita</div><div class="big">${esc(sale.code)}</div><div class="muted">${dt(sale.created_at)}</div></div></div>
  <table style="margin-top:14px"><tr><th>Articolo</th><th>Q.t\xE0</th><th style="text-align:right">Prezzo</th><th style="text-align:right">Totale</th></tr>${rows}</table>
  ${sale.discount ? `<p style="text-align:right">Sconto: -${eur(sale.discount)}</p>` : ""}
  <p style="text-align:right" class="big">Totale ${eur(sale.total)}</p><p class="muted">Pagamento: ${esc(sale.method)}</p>
  <p class="terms">Documento non fiscale. Per la garanzia legale conservare questa ricevuta.</p>`;
  return page(`Vendita ${sale.code}`, body, "", req);
}
__name(printSale, "printSale");

// app.mjs
var str2 = /* @__PURE__ */ __name((v) => v == null ? null : String(v).trim() || null, "str");
var num2 = /* @__PURE__ */ __name((v, d2 = 0) => v === "" || v == null ? d2 : Number(String(v).replace(",", ".")), "num");
var NOW = "datetime('now','localtime')";
var h = /* @__PURE__ */ __name((fn) => async (c) => {
  try {
    const m = c.req.method;
    const body = m === "GET" || m === "DELETE" ? {} : await c.req.json().catch(() => ({}));
    return c.json(await fn({ params: c.req.param(), query: c.req.query(), body: body || {}, user: c.get("user") }));
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error(e);
    return c.json({ ok: false, error: status === 500 ? "Errore interno" : e.message }, status);
  }
}, "h");
var page2 = /* @__PURE__ */ __name((fn) => async (c) => {
  try {
    return await fn(c);
  } catch (e) {
    return c.text(e.message || "Errore", e.status || 500);
  }
}, "page");
var qrSvg = /* @__PURE__ */ __name((t) => renderSVG(String(t || ""), { border: 1 }), "qrSvg");
function createPublicApp() {
  const app2 = new Hono3();
  app2.get("/api/track/:token", h((req) => publicView(req.params.token)));
  app2.post("/api/track/:token/decision", h((req) => customerDecision(req.params.token, !!req.body?.accept)));
  app2.post("/api/lookup", h((req) => lookup(req.body?.code, req.body?.phone4)));
  return app2;
}
__name(createPublicApp, "createPublicApp");
function createAdminApp({ trackBaseFallback, backup, auth } = {}) {
  const app2 = new Hono3();
  if (auth) app2.use("*", auth);
  const trackBase = /* @__PURE__ */ __name(async () => {
    const s = await getSettings();
    return String(s.public_base_url || await trackBaseFallback?.() || "").replace(/\/$/, "");
  }, "trackBase");
  const trackUrl = /* @__PURE__ */ __name(async (token) => `${await trackBase()}/t/${token}`, "trackUrl");
  const adminOnly = /* @__PURE__ */ __name((req) => {
    if (req.user && req.user.role !== "admin") throw new HttpError(403, "Solo l\u2019amministratore pu\xF2 farlo.");
  }, "adminOnly");
  app2.get("/api/me", h((req) => ({ user: req.user || { email: "locale", name: "Locale", role: "admin" } })));
  app2.get("/api/meta", h(async () => ({ statuses: STATUSES, step_labels: STEP_LABELS, settings: await getSettings(), track_base: await trackBase() })));
  app2.get("/api/dashboard", h(() => dashboard()));
  app2.get("/api/settings", h(() => getSettings()));
  app2.put("/api/settings", h(async (req) => {
    adminOnly(req);
    const allowed = ["shop_name", "shop_address", "shop_phone", "public_base_url", "default_warranty_days", "terms"];
    for (const k of allowed) {
      if (k in req.body) await db.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(k, String(req.body[k] ?? ""));
    }
    return getSettings();
  }));
  app2.get("/api/users", h(async (req) => {
    adminOnly(req);
    return db.prepare("SELECT * FROM users ORDER BY protected DESC, name, email").all();
  }));
  app2.post("/api/users", h(async (req) => {
    adminOnly(req);
    const email = str2(req.body.email)?.toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, "Email non valida");
    if (await db.prepare("SELECT id FROM users WHERE email = ?").get(email)) throw new HttpError(409, "Utente gi\xE0 presente");
    const role = req.body.role === "admin" ? "admin" : "staff";
    const r = await db.prepare(`INSERT INTO users (email, name, role, created_at) VALUES (?,?,?,${NOW})`).run(email, str2(req.body.name), role);
    return db.prepare("SELECT * FROM users WHERE id = ?").get(r.lastInsertRowid);
  }));
  app2.put("/api/users/:id", h(async (req) => {
    adminOnly(req);
    const u = await db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
    if (!u) throw new HttpError(404, "Utente non trovato");
    if (u.protected) throw new HttpError(409, "Il proprietario \xE8 protetto: non si modifica.");
    const active = req.body.active === false || req.body.active === 0 ? 0 : 1;
    await db.prepare("UPDATE users SET name=?, role=?, active=? WHERE id=?").run(str2(req.body.name) ?? u.name, req.body.role === "admin" ? "admin" : "staff", active, u.id);
    return db.prepare("SELECT * FROM users WHERE id = ?").get(u.id);
  }));
  app2.delete("/api/users/:id", h(async (req) => {
    adminOnly(req);
    const u = await db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
    if (!u) throw new HttpError(404, "Utente non trovato");
    if (u.protected) throw new HttpError(409, "Il proprietario \xE8 protetto: non si elimina.");
    await db.prepare("DELETE FROM users WHERE id = ?").run(u.id);
    return { ok: true };
  }));
  app2.get("/api/qr", (c) => {
    const t = c.req.query("text");
    if (!t) return c.body(null, 400);
    return c.body(qrSvg(t), 200, { "content-type": "image/svg+xml" });
  });
  app2.get("/api/barcode", (c) => {
    const t = String(c.req.query("text") || "").slice(0, 60);
    if (!t) return c.body(null, 400);
    return c.body(barcodeSvg(t), 200, { "content-type": "image/svg+xml" });
  });
  app2.get("/api/customers", h(async (req) => {
    const q = str2(req.query.q);
    const base = `SELECT c.*, (SELECT COUNT(*) FROM repairs r WHERE r.customer_id=c.id) AS repairs_count,
      (SELECT COUNT(*) FROM repairs r WHERE r.customer_id=c.id AND r.status NOT IN ('delivered','cancelled')) AS open_repairs FROM customers c`;
    if (!q) return db.prepare(`${base} ORDER BY c.created_at DESC LIMIT 300`).all();
    const like = `%${q}%`;
    return db.prepare(`${base} WHERE c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? ORDER BY c.name LIMIT 100`).all(like, like, like);
  }));
  app2.get("/api/customers/:id", h(async (req) => {
    const c = await db.prepare("SELECT * FROM customers WHERE id = ?").get(req.params.id);
    if (!c) throw new HttpError(404, "Cliente non trovato");
    return { ...c, repairs: await listRepairs({ customer_id: c.id }), sales: await db.prepare("SELECT * FROM sales WHERE customer_id = ? ORDER BY id DESC").all(c.id) };
  }));
  app2.post("/api/customers", h(async (req) => {
    const id = await upsertCustomer({ name: req.body.name, phone: req.body.phone, email: req.body.email, notes: req.body.notes });
    return db.prepare("SELECT * FROM customers WHERE id = ?").get(id);
  }));
  app2.put("/api/customers/:id", h(async (req) => {
    const b = req.body;
    if (!str2(b.name)) throw new HttpError(400, "Nome obbligatorio");
    const r = await db.prepare("UPDATE customers SET name=?, phone=?, email=?, notes=? WHERE id=?").run(str2(b.name), str2(b.phone), str2(b.email), str2(b.notes), req.params.id);
    if (!r.changes) throw new HttpError(404, "Cliente non trovato");
    return db.prepare("SELECT * FROM customers WHERE id = ?").get(req.params.id);
  }));
  app2.delete("/api/customers/:id", h(async (req) => {
    const n = (await db.prepare("SELECT COUNT(*) AS n FROM repairs WHERE customer_id = ?").get(req.params.id)).n;
    if (n) throw new HttpError(409, "Il cliente ha delle riparazioni: non si pu\xF2 eliminare.");
    await db.prepare("DELETE FROM customers WHERE id = ?").run(req.params.id);
    return { ok: true };
  }));
  app2.get("/api/suppliers", h(() => db.prepare(`SELECT s.*, (SELECT COUNT(*) FROM products p WHERE p.supplier_id=s.id AND p.active=1) AS products_count FROM suppliers s ORDER BY s.name`).all()));
  app2.post("/api/suppliers", h(async (req) => {
    const b = req.body;
    if (!str2(b.name)) throw new HttpError(400, "Nome obbligatorio");
    const r = await db.prepare(`INSERT INTO suppliers (name, phone, email, website, notes, created_at) VALUES (?,?,?,?,?,${NOW})`).run(str2(b.name), str2(b.phone), str2(b.email), str2(b.website), str2(b.notes));
    return db.prepare("SELECT * FROM suppliers WHERE id = ?").get(r.lastInsertRowid);
  }));
  app2.put("/api/suppliers/:id", h(async (req) => {
    const b = req.body;
    if (!str2(b.name)) throw new HttpError(400, "Nome obbligatorio");
    const r = await db.prepare("UPDATE suppliers SET name=?, phone=?, email=?, website=?, notes=? WHERE id=?").run(str2(b.name), str2(b.phone), str2(b.email), str2(b.website), str2(b.notes), req.params.id);
    if (!r.changes) throw new HttpError(404, "Fornitore non trovato");
    return db.prepare("SELECT * FROM suppliers WHERE id = ?").get(req.params.id);
  }));
  app2.delete("/api/suppliers/:id", h(async (req) => {
    await db.prepare("DELETE FROM suppliers WHERE id = ?").run(req.params.id);
    return { ok: true };
  }));
  const checkProduct = /* @__PURE__ */ __name((b) => {
    for (const k of ["cost", "price", "min_qty"]) {
      const n = num2(b[k]);
      if (!Number.isFinite(n) || n < 0) throw new HttpError(400, `Valore non valido: ${k === "cost" ? "costo" : k === "price" ? "prezzo" : "scorta minima"}`);
    }
    if (b.qty !== void 0 && !Number.isFinite(num2(b.qty))) throw new HttpError(400, "Quantit\xE0 non valida");
  }, "checkProduct");
  app2.get("/api/products", h(async (req) => {
    const q = str2(req.query.q);
    const where = ["p.active = 1"];
    const args = [];
    if (q) {
      where.push("(p.name LIKE ? OR p.sku LIKE ? OR p.category LIKE ?)");
      args.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (req.query.low) where.push("p.min_qty > 0 AND p.qty <= p.min_qty");
    return db.prepare(`SELECT p.*, s.name AS supplier_name FROM products p LEFT JOIN suppliers s ON s.id=p.supplier_id WHERE ${where.join(" AND ")} ORDER BY p.name LIMIT 500`).all(...args);
  }));
  app2.get("/api/reorder", h(() => lowStock()));
  app2.post("/api/products", h(async (req) => {
    const b = req.body;
    if (!str2(b.name)) throw new HttpError(400, "Nome obbligatorio");
    checkProduct(b);
    const qty = Math.round(num2(b.qty));
    const id = await tx(async () => {
      const r = await db.prepare(`INSERT INTO products (sku, name, category, qty, min_qty, cost, price, supplier_id, location, notes, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,${NOW})`).run(str2(b.sku), str2(b.name), str2(b.category), 0, Math.round(num2(b.min_qty)), num2(b.cost), num2(b.price), b.supplier_id || null, str2(b.location), str2(b.notes));
      const pid = Number(r.lastInsertRowid);
      if (qty) await moveStock(pid, qty, "carico iniziale", null);
      return pid;
    });
    return db.prepare("SELECT * FROM products WHERE id = ?").get(id);
  }));
  app2.put("/api/products/:id", h(async (req) => {
    const b = req.body;
    if (!str2(b.name)) throw new HttpError(400, "Nome obbligatorio");
    checkProduct(b);
    const r = await db.prepare("UPDATE products SET sku=?, name=?, category=?, min_qty=?, cost=?, price=?, supplier_id=?, location=?, notes=? WHERE id=?").run(str2(b.sku), str2(b.name), str2(b.category), Math.round(num2(b.min_qty)), num2(b.cost), num2(b.price), b.supplier_id || null, str2(b.location), str2(b.notes), req.params.id);
    if (!r.changes) throw new HttpError(404, "Prodotto non trovato");
    return db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  }));
  app2.delete("/api/products/:id", h(async (req) => {
    await db.prepare("UPDATE products SET active = 0 WHERE id = ?").run(req.params.id);
    return { ok: true };
  }));
  app2.post("/api/products/:id/move", h(async (req) => {
    const delta = Math.round(num2(req.body.delta));
    if (!delta) throw new HttpError(400, "Quantit\xE0 non valida");
    await tx(() => moveStock(Number(req.params.id), delta, str2(req.body.reason) || (delta > 0 ? "carico" : "scarico"), str2(req.body.ref)));
    return db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  }));
  app2.get("/api/products/:id/moves", h((req) => db.prepare("SELECT * FROM stock_moves WHERE product_id = ? ORDER BY id DESC LIMIT 100").all(req.params.id)));
  app2.get("/api/repairs", h((req) => listRepairs({ status: str2(req.query.status), q: str2(req.query.q), open: req.query.open === "1", customer_id: req.query.customer_id })));
  app2.post("/api/repairs", h(async (req) => {
    const r = await createRepair(req.body);
    return { ...r, track_url: await trackUrl(r.token) };
  }));
  app2.get("/api/repairs/:id", h(async (req) => {
    const r = await getRepair(req.params.id);
    return { ...r, track_url: await trackUrl(r.token) };
  }));
  app2.patch("/api/repairs/:id", h((req) => updateRepair(req.params.id, req.body)));
  app2.post("/api/repairs/:id/status", h((req) => setStatus(req.params.id, req.body.status, str2(req.body.note), req.body.public !== false)));
  app2.post("/api/repairs/:id/advance", h(async (req) => {
    const r = await getRepair(req.params.id);
    if (!r.next_status) throw new HttpError(400, "Nessun passaggio successivo.");
    return r.next_status === "delivered" ? deliverRepair(r.id, req.body || {}) : setStatus(r.id, r.next_status);
  }));
  app2.post("/api/repairs/:id/deliver", h((req) => deliverRepair(req.params.id, req.body || {})));
  app2.post("/api/repairs/:id/note", h((req) => addNote(req.params.id, req.body.note, req.body.public !== false)));
  app2.post("/api/repairs/:id/parts", h((req) => addPart(req.params.id, req.body)));
  app2.delete("/api/repairs/:id/parts/:partId", h((req) => removePart(req.params.id, req.params.partId)));
  app2.post("/api/repairs/:id/deposit", h(async (req) => {
    const amount = num2(req.body.amount);
    if (!(amount > 0)) throw new HttpError(400, "Importo non valido");
    await tx(async () => {
      const r = await db.prepare("SELECT code FROM repairs WHERE id = ?").get(req.params.id);
      if (!r) throw new HttpError(404, "Riparazione non trovata");
      await db.prepare(`INSERT INTO payments (kind, ref_id, label, amount, method, created_at) VALUES (?,?,?,?,?,${NOW})`).run("repair", req.params.id, `Acconto ${r.code}`, money(amount), str2(req.body.method) || "contanti");
      await db.prepare("UPDATE repairs SET deposit = deposit + ? WHERE id = ?").run(money(amount), req.params.id);
      await logEvent(Number(req.params.id), null, `Acconto ricevuto: ${amount.toFixed(2)} \u20AC.`, 1);
    });
    return getRepair(req.params.id);
  }));
  app2.get("/api/sales", h(() => db.prepare("SELECT s.*, c.name AS customer_name FROM sales s LEFT JOIN customers c ON c.id=s.customer_id ORDER BY s.id DESC LIMIT 200").all()));
  app2.post("/api/sales", h((req) => createSale(req.body)));
  app2.get("/api/sales/:id", h((req) => getSale(req.params.id)));
  app2.get("/api/report", h(async (req) => {
    const r = await report(str2(req.query.from), str2(req.query.to));
    return { ...r, by_day: await reportByDay(r.from, r.to) };
  }));
  app2.get("/api/stock/summary", h(() => stockSummary()));
  app2.get("/api/backup", async (c) => {
    try {
      if (backup) return await backup(c);
      return c.body(JSON.stringify(await dumpAll()), 200, { "content-type": "application/json", "content-disposition": `attachment; filename="officina-backup-${localDate()}.json"` });
    } catch (e) {
      console.error(e);
      return c.json({ ok: false, error: "Backup non riuscito" }, 500);
    }
  });
  const printRoute = /* @__PURE__ */ __name((render) => page2(async (c) => {
    const r = await getRepair(c.req.param("id"));
    return c.html(render(r, await trackUrl(r.token), await getSettings(), { noprint: c.req.query("noprint") === "1" }));
  }), "printRoute");
  app2.get("/print/customer/:id", printRoute(printCustomer));
  app2.get("/print/repair/:id", printRoute(printCustomer));
  app2.get("/print/lab/:id", printRoute(printLab));
  app2.get("/print/both/:id", printRoute(printBoth));
  app2.get("/print/label/:id", printRoute((r, url, s, req) => printLabel(r, url, req)));
  app2.get("/print/sale/:id", page2(async (c) => c.html(printSale(await getSale(c.req.param("id")), await getSettings(), { noprint: c.req.query("noprint") === "1" }))));
  return app2;
}
__name(createAdminApp, "createAdminApp");
var TABLES = ["settings", "users", "customers", "suppliers", "products", "stock_moves", "repairs", "repair_events", "repair_parts", "sales", "sale_items", "payments"];
async function dumpAll() {
  const dump = { created_at: nowLocal(), tables: {} };
  for (const t of TABLES) dump.tables[t] = await db.prepare(`SELECT * FROM ${t}`).all();
  return dump;
}
__name(dumpAll, "dumpAll");

// access.mjs
var b64 = /* @__PURE__ */ __name((s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), (c) => c.charCodeAt(0)), "b64");
var json = /* @__PURE__ */ __name((s) => JSON.parse(new TextDecoder().decode(b64(s))), "json");
var keyCache = { at: 0, keys: [] };
async function getKeys(team) {
  if (Date.now() - keyCache.at < 36e5 && keyCache.keys.length) return keyCache.keys;
  const res = await fetch(`https://${team}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error("Certificati Access non raggiungibili");
  keyCache = { at: Date.now(), keys: (await res.json()).keys };
  return keyCache.keys;
}
__name(getKeys, "getKeys");
async function verifyAccessJwt(token, { team, aud }) {
  try {
    const [h2, p, s] = String(token || "").split(".");
    if (!h2 || !p || !s) return null;
    const header2 = json(h2);
    const payload = json(p);
    const jwk = (await getKeys(team)).find((k) => k.kid === header2.kid);
    if (!jwk || header2.alg !== "RS256") return null;
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64(s), new TextEncoder().encode(`${h2}.${p}`));
    if (!ok) return null;
    const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!auds.includes(aud)) return null;
    if (payload.iss !== `https://${team}`) return null;
    if (!payload.exp || payload.exp * 1e3 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
__name(verifyAccessJwt, "verifyAccessJwt");
var accessAuth = /* @__PURE__ */ __name(async (c, next) => {
  const { ACCESS_TEAM_DOMAIN: team, ACCESS_AUD: aud } = c.env;
  if (!team || !aud) return c.json({ ok: false, error: "Accesso non ancora configurato." }, 503);
  const payload = await verifyAccessJwt(c.req.header("Cf-Access-Jwt-Assertion"), { team, aud });
  if (!payload?.email) return c.json({ ok: false, error: "Accesso non autorizzato." }, 401);
  const user = await db.prepare("SELECT * FROM users WHERE email = ? AND active = 1").get(String(payload.email).toLowerCase());
  if (!user) return c.json({ ok: false, error: "Questo indirizzo email non \xE8 abilitato. Chiedi a Christian." }, 403);
  c.set("user", user);
  await next();
}, "accessAuth");

// worker.mjs
var adminApp = createAdminApp({ auth: accessAuth, trackBaseFallback: /* @__PURE__ */ __name(() => globalThis.__PUBLIC_BASE__, "trackBaseFallback") });
var publicApp = createPublicApp();
var serveAsset = /* @__PURE__ */ __name(async (env, request, path) => {
  const url = new URL(request.url);
  url.pathname = path;
  return env.ASSETS.fetch(new Request(url, request));
}, "serveAsset");
var ready = false;
async function init(env) {
  useD1(env.DB);
  globalThis.__PUBLIC_BASE__ = env.PUBLIC_BASE_URL || "";
  if (ready) return;
  await ensureDefaults();
  await ensureOwner(env.OWNER_EMAIL);
  ready = true;
}
__name(init, "init");
var app = new Hono3();
app.use("*", async (c, next) => {
  await init(c.env);
  await next();
});
app.use("*", async (c, next) => {
  if (new URL(c.req.url).hostname !== c.env.PUBLIC_HOST) return next();
  const path = new URL(c.req.url).pathname;
  if (path.startsWith("/api/")) return publicApp.fetch(c.req.raw, c.env, c.executionCtx);
  if (path.startsWith("/t/")) return serveAsset(c.env, c.req.raw, "/track.html");
  if (path === "/track.js") return serveAsset(c.env, c.req.raw, "/track.js");
  return c.text("Non trovato", 404);
});
app.get("/t/:token", (c) => serveAsset(c.env, c.req.raw, "/track.html"));
app.route("/", publicApp);
app.route("/", adminApp);
app.get("*", (c) => c.env.ASSETS.fetch(c.req.raw));
var worker_default = {
  fetch: app.fetch,
  // Backup giornaliero: copia JSON nel bucket R2 (se collegato)
  async scheduled(event, env) {
    await init(env);
    if (!env.BACKUPS) return;
    const dump = await dumpAll();
    await env.BACKUPS.put(`officina-${dump.created_at.slice(0, 10)}.json`, JSON.stringify(dump));
  }
};

// ../node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-0Q4baY/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-0Q4baY/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init2) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init2.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init2) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init2.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
