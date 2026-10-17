// Ruolo "cassa": non vede costi d'acquisto, margini e guadagni. Il filtro sta sul SERVER: le risposte API
// non contengono proprio quei campi (nascondere solo nell'interfaccia non basterebbe).

/** Campi che il ruolo cassa non deve mai ricevere. */
export const COST_KEYS = new Set(['cost', 'unit_cost', 'parts_cost', 'profit_estimate', 'margin', 'profit', 'value_cost', 'avg_cost', 'last_cost', 'cost_net', 'cost_vat']);
/** Avvisi che rivelano prezzi d'acquisto (variazioni dei prezzi dei fornitori). */
const COST_ALERTS = new Set(['price_up', 'price_down']);
/** Sezioni intere riservate a chi non è cassa (storico acquisti e prezzi, backup completo). */
const BLOCKED = [/^\/api\/purchases(\/|$)/, /^\/api\/backup$/];

export const isCassa = (user) => user?.role === 'cassa';

/** Copia dell'oggetto senza i campi di costo, a qualsiasi profondità. */
export function stripCosts(v) {
  if (Array.isArray(v)) return v.map(stripCosts);
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, x] of Object.entries(v)) if (!COST_KEYS.has(k)) out[k] = stripCosts(x);
    return out;
  }
  return v;
}

/** Middleware Hono da montare dopo l'autenticazione. */
export const cassaMiddleware = async (c, next) => {
  if (!isCassa(c.get('user')) || !c.req.path.startsWith('/api/')) return next();
  if (BLOCKED.some((re) => re.test(c.req.path))) return c.json({ ok: false, error: 'Questa sezione non è disponibile per il ruolo Cassa.', code: 'RUOLO_NON_AUTORIZZATO', hint: 'Per vedere costi e margini serve un utente amministratore o staff.' }, 403);
  await next();
  if (!(c.res.headers.get('content-type') || '').includes('json')) return;
  let data = await c.res.clone().json().catch(() => null);
  if (data == null) return;
  if (Array.isArray(data?.items) && data.count != null) { // /api/alerts
    data = { ...data, items: data.items.filter((x) => !COST_ALERTS.has(x.type)) };
    data.count = data.items.length;
    if ('high' in data) data.high = data.items.filter((x) => x.severity === 'high').length;
  }
  const headers = new Headers(c.res.headers);
  headers.delete('content-length');
  c.res = new Response(JSON.stringify(stripCosts(data)), { status: c.res.status, headers });
};
