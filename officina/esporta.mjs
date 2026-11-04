// Esportazione per Excel (CSV con ; e BOM, come le chiusure di cassa): magazzino, clienti, riparazioni, vendite, usato a margine.
// Spunto da Fix-Book (export Excel). Solo amministratore: i file contengono costi e dati dei clienti.
import { db } from './dbref.mjs';
import { HttpError, localDate } from './logic.mjs';

const cell = (v) => { const s = String(v ?? ''); return /[";\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s; };
const it = (n) => (n == null || n === '' ? '' : String(Math.round(Number(n) * 100) / 100).replace('.', ','));
const dayOk = (d) => /^\d{4}-\d\d-\d\d$/.test(d || '');

export const EXPORTS = {
  magazzino: { label: 'Magazzino', head: ['Codice', 'Codice a barre', 'Nome', 'Categoria', 'Ubicazione', 'Quantità', 'Scorta minima', 'Costo', 'Prezzo', 'Prezzo amico', 'Prezzo rivenditore', 'Fornitore', 'Attivo'],
    rows: () => db.prepare('SELECT p.*, s.name AS sup FROM products p LEFT JOIN suppliers s ON s.id = p.supplier_id ORDER BY p.name').all(),
    map: (p) => [p.sku, p.barcode, p.name, p.category, p.location, p.qty, p.min_qty, it(p.cost), it(p.price), it(p.price_friend), it(p.price_reseller), p.sup, p.active ? 'sì' : 'no'] },
  clienti: { label: 'Clienti', head: ['Nome', 'Ragione sociale', 'Telefono', 'Email', 'P.IVA', 'Codice fiscale', 'Indirizzo', 'CAP', 'Città', 'Provincia', 'Creato il'],
    rows: () => db.prepare('SELECT * FROM customers ORDER BY name').all(),
    map: (c) => [c.name, c.company_name, c.phone, c.email, c.vat_number, c.fiscal_code, c.address, c.zip, c.city, c.province, c.created_at] },
  riparazioni: { label: 'Riparazioni', period: 'r.created_at', head: ['Codice', 'Data', 'Cliente', 'Dispositivo', 'Problema', 'Stato', 'Tecnico', 'Preventivo', 'Prezzo finale', 'Costo ricambi', 'Consegnata il'],
    rows: (f, t) => db.prepare(`SELECT r.*, c.name AS cn, (SELECT SUM(qty*unit_cost) FROM repair_parts p WHERE p.repair_id = r.id) AS pc FROM repairs r JOIN customers c ON c.id = r.customer_id WHERE date(r.created_at) BETWEEN ? AND ? ORDER BY r.id`).all(f, t),
    map: (r) => [r.code, r.created_at, r.cn, r.brand_model, r.problem, r.status, r.tech_email, it(r.quote), it(r.final_price), it(r.pc), r.delivered_at] },
  vendite: { label: 'Vendite', period: true, head: ['Codice', 'Data', 'Cliente', 'Articolo', 'Quantità', 'Prezzo', 'Costo', 'Totale vendita', 'Sconto', 'Permuta', 'Pagamento'],
    rows: (f, t) => db.prepare(`SELECT s.code, s.created_at, s.total, s.discount, s.tradein_value, s.method, c.name AS cn, i.name, i.qty, i.unit_price, i.unit_cost FROM sales s JOIN sale_items i ON i.sale_id = s.id LEFT JOIN customers c ON c.id = s.customer_id WHERE date(s.created_at) BETWEEN ? AND ? ORDER BY s.id, i.id`).all(f, t),
    map: (r) => [r.code, r.created_at, r.cn, r.name, r.qty, it(r.unit_price), it(r.unit_cost), it(r.total), it(r.discount), it(r.tradein_value), r.method] },
  usato: { label: 'Registro usato a margine', head: ['Codice', 'Acquistato il', 'Descrizione', 'Seriale', 'Provenienza', 'Cedente', 'Documento cedente', 'Costo', 'Venduto il', 'Prezzo di vendita', 'Margine'],
    rows: () => db.prepare('SELECT m.*, c.name AS cn FROM margin_items m LEFT JOIN customers c ON c.id = m.seller_customer_id ORDER BY m.id').all(),
    map: (m) => [m.code, m.acquired_at, m.description, m.serial, m.origin, m.cn || m.seller_name, m.seller_doc, it(m.cost), m.sold_at, it(m.sale_price), m.sold_at ? it((m.sale_price || 0) - m.cost) : ''] },
};

export async function buildCsv(what, from, to) {
  const e = EXPORTS[what];
  if (!e) throw new HttpError(404, `Esportazione «${what}» non disponibile.`, { code: 'EXPORT_NON_VALIDO', hint: `Scegli tra: ${Object.keys(EXPORTS).join(', ')}.` });
  const f = dayOk(from) ? from : '2000-01-01';
  const t = dayOk(to) ? to : localDate();
  const rows = await e.rows(f, t);
  const lines = [e.head.map(cell).join(';'), ...rows.map((r) => e.map(r).map(cell).join(';'))];
  return { csv: `﻿${lines.join('\r\n')}\r\n`, name: `${what}${e.period ? `_${f}_${t}` : ''}_${localDate()}.csv`, count: rows.length };
}

export function registerExportRoutes(app, adminOnly, errorReply) {
  app.get('/api/export', (c) => c.json({ items: Object.entries(EXPORTS).map(([k, e]) => ({ key: k, label: e.label, period: !!e.period })) }));
  app.get('/api/export/:file{[a-z]+\\.csv}', async (c) => {
    try {
      adminOnly({ user: c.get('user') });
      const r = await buildCsv(c.req.param('file').replace(/\.csv$/, ''), c.req.query('from'), c.req.query('to'));
      return c.body(r.csv, 200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${r.name}"`, 'cache-control': 'no-store', 'x-rows': String(r.count) });
    } catch (e) { return errorReply(c, e); }
  });
}
