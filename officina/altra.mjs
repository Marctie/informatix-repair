// "Altra attività" (alias "pagamento appeso"): incassi che appartengono a un'altra azienda di Christian e che verranno
// fatturati da quella. Chi ha il ruolo Cassa li inserisce con la spunta "Pagamento appeso" e poi non li rivede più
// (liste, cassa, report, schede); gli amministratori (Christian e Marco) li vedono qui e in Analisi e possono correggerli.
// Nessun incasso e' nascosto ai controlli: ogni inserimento, modifica ed eliminazione finisce nel Registro, e il contante
// entra comunque nel totale atteso della chiusura cassa (senza dettaglio per la Cassa).
import { db } from './dbref.mjs';
import { HttpError } from './errori.mjs';
import { writeAudit } from './audit.mjs';
import { assertMethod } from './logic.mjs';

const money = (n) => Math.round((Number(n) || 0) * 100) / 100;
const dayOk = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || '')) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`));
const pad = (x) => String(x).padStart(2, '0');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const nowTime = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };

/** Riepilogo dell'altra attività nel periodo (per Analisi e per la vista dedicata). Solo amministratori. */
export async function altraSummary(from, to) {
  const f = dayOk(from) ? from : `${today().slice(0, 8)}01`;
  const t = dayOk(to) ? to : today();
  const W = "entity = 'altra' AND date(created_at) BETWEEN ? AND ?";
  const total = money((await db.prepare(`SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE ${W}`).get(f, t)).s);
  const by_method = await db.prepare(`SELECT method, ROUND(SUM(amount),2) AS total, COUNT(*) AS n FROM payments WHERE ${W} GROUP BY method ORDER BY total DESC`).all(f, t);
  const by_day = await db.prepare(`SELECT date(created_at) AS day, ROUND(SUM(amount),2) AS total FROM payments WHERE ${W} GROUP BY day ORDER BY day`).all(f, t);
  const rows = await db.prepare(`SELECT p.*,
      CASE p.kind WHEN 'sale' THEN (SELECT code FROM sales WHERE id = p.ref_id) WHEN 'repair' THEN (SELECT code FROM repairs WHERE id = p.ref_id) END AS ref_code,
      CASE p.kind WHEN 'sale' THEN (SELECT c.name FROM sales s JOIN customers c ON c.id = s.customer_id WHERE s.id = p.ref_id)
                  WHEN 'repair' THEN (SELECT c.name FROM repairs r JOIN customers c ON c.id = r.customer_id WHERE r.id = p.ref_id) END AS customer_name
    FROM payments p WHERE p.entity = 'altra' AND date(p.created_at) BETWEEN ? AND ? ORDER BY p.id DESC LIMIT 500`).all(f, t);
  return { from: f, to: t, total, n: rows.length, by_method, by_day, rows };
}

async function loadPayment(id, wantEntity) {
  const p = await db.prepare('SELECT * FROM payments WHERE id = ?').get(id);
  if (!p || (wantEntity && p.entity !== wantEntity)) throw new HttpError(404, 'Pagamento non trovato tra quelli dell’altra attività.', { code: 'PAGAMENTO_NON_TROVATO', hint: 'Aggiorna la pagina: potrebbe essere già stato spostato o eliminato.' });
  return p;
}

export function registerAltraRoutes(app, h, adminOnly) {
  app.get('/api/altra', h(async (req) => { adminOnly(req); return altraSummary(req.query.from, req.query.to); }));

  // Nuovo incasso diretto dell'altra attività (non legato a una vendita o riparazione)
  app.post('/api/altra/payments', h(async (req) => {
    adminOnly(req);
    const b = req.body || {};
    const amount = money(String(b.amount ?? '').replace(',', '.'));
    if (!(amount > 0)) throw new HttpError(400, 'L’importo non è valido: deve essere maggiore di zero.', { code: 'IMPORTO_NON_VALIDO', hint: 'Scrivi l’importo ricevuto (es. 50 o 49,90).' });
    const method = assertMethod(b.method || 'contanti');
    const day = b.date && dayOk(b.date) ? b.date : today();
    if (day > today()) throw new HttpError(400, 'La data non può essere nel futuro.', { code: 'DATA_FUTURA', hint: 'Scegli oggi o un giorno passato.' });
    const label = String(b.label || 'Incasso altra attività').slice(0, 120);
    const r = await db.prepare("INSERT INTO payments (kind, ref_id, label, amount, method, entity, created_at) VALUES ('altra', 0, ?, ?, ?, 'altra', ?)")
      .run(label, amount, method, `${day} ${nowTime()}`);
    await writeAudit({ user: req.user, action: 'crea', type: 'pagamento', id: Number(r.lastInsertRowid), label: `${label} (${amount.toFixed(2)} €)`, detail: 'altra attività' });
    return { ok: true, id: Number(r.lastInsertRowid) };
  }));

  app.put('/api/altra/payments/:id{[0-9]+}', h(async (req) => {
    adminOnly(req);
    const p = await loadPayment(req.params.id, 'altra');
    const b = req.body || {};
    const amount = 'amount' in b ? money(String(b.amount).replace(',', '.')) : p.amount;
    if (!(amount > 0)) throw new HttpError(400, 'L’importo non è valido: deve essere maggiore di zero.', { code: 'IMPORTO_NON_VALIDO', hint: 'Scrivi un importo maggiore di zero, oppure elimina il pagamento.' });
    const method = 'method' in b ? assertMethod(b.method) : p.method;
    const label = 'label' in b ? String(b.label || p.label).slice(0, 120) : p.label;
    let at = p.created_at;
    if (b.date) {
      if (!dayOk(b.date) || b.date > today()) throw new HttpError(400, 'La data non è valida (non può essere nel futuro).', { code: 'DATA_NON_VALIDA', hint: 'Usa il formato AAAA-MM-GG, oggi o prima.' });
      at = `${b.date} ${String(p.created_at).slice(11) || '12:00:00'}`;
    }
    await db.prepare('UPDATE payments SET amount = ?, method = ?, label = ?, created_at = ? WHERE id = ?').run(amount, method, label, at, p.id);
    await writeAudit({ user: req.user, action: 'modifica', type: 'pagamento', id: p.id, label: `${p.label} (${p.amount.toFixed(2)} € → ${amount.toFixed(2)} €)`, detail: 'altra attività' });
    return { ok: true };
  }));

  app.delete('/api/altra/payments/:id{[0-9]+}', h(async (req) => {
    adminOnly(req);
    const p = await loadPayment(req.params.id, 'altra');
    await db.prepare('DELETE FROM payments WHERE id = ?').run(p.id);
    await writeAudit({ user: req.user, action: 'elimina', type: 'pagamento', id: p.id, label: `${p.label} (${p.amount.toFixed(2)} €)`, detail: 'altra attività' });
    return { ok: true };
  }));

  // Sposta un pagamento (e la vendita collegata) tra Informatix Repair e l'altra attività: rimedio a una spunta sbagliata.
  app.post('/api/altra/payments/:id{[0-9]+}/move', h(async (req) => {
    adminOnly(req);
    const to = req.body?.to === 'altra' ? 'altra' : 'main';
    const p = await loadPayment(req.params.id);
    if (p.entity === to) return { ok: true, unchanged: true };
    await db.prepare('UPDATE payments SET entity = ? WHERE id = ?').run(to, p.id);
    if (p.kind === 'sale') {
      const left = await db.prepare("SELECT COUNT(*) AS n FROM payments WHERE kind = 'sale' AND ref_id = ? AND entity = 'altra'").get(p.ref_id);
      await db.prepare('UPDATE sales SET entity = ? WHERE id = ?').run(left.n > 0 ? 'altra' : 'main', p.ref_id);
    }
    await writeAudit({ user: req.user, action: 'modifica', type: 'pagamento', id: p.id, label: `${p.label} (${p.amount.toFixed(2)} €)`, detail: to === 'altra' ? 'spostato su altra attività' : 'riportato su Informatix Repair' });
    return { ok: true };
  }));
}
