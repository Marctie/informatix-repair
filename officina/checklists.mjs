// Tipi di dispositivo e checklist di controllo (ingresso, pratiche al ritiro, collaudo di uscita).
// Le voci predefinite sono qui; Christian puo' cambiarle per tipo (tabella checklist_templates).
// Un controllo compilato si salva nella riparazione (repairs.checklist_in/pre/out) come
// {items:[{l:'Si accende', s:'ok'|'ko'|'na'|null}], by, at}: le etichette restano anche se l'elenco cambia dopo.
import { db, tx, nowLocal } from './dbref.mjs';
import { HttpError, logEvent } from './logic.mjs';

export const PHASES = { in: 'Controllo all’ingresso', pre: 'Al ritiro in laboratorio', out: 'Collaudo finale' };
export const STATES = ['ok', 'ko', 'na'];

// Etichette e suggerimenti che dipendono dal tipo di dispositivo.
export const DEVICE_TYPES = {
  smartphone: { label: 'Smartphone', serial: 'IMEI / seriale', passcode: 'PIN / schema di sblocco', accessories: ['Caricatore', 'Cover', 'SIM', 'Scheda SD', 'Cavo'] },
  tablet: { label: 'Tablet', serial: 'IMEI / seriale', passcode: 'PIN / schema di sblocco', accessories: ['Caricatore', 'Cover', 'Pennino', 'Tastiera', 'SIM'] },
  portatile: { label: 'Portatile', serial: 'Numero di serie', passcode: 'Password / PIN di accesso', accessories: ['Alimentatore', 'Borsa', 'Mouse', 'Batteria'] },
  pc: { label: 'PC fisso', serial: 'Numero di serie', passcode: 'Password / PIN di accesso', accessories: ['Cavo di alimentazione', 'Tastiera', 'Mouse', 'Monitor'] },
  console: { label: 'Console', serial: 'Numero di serie', passcode: 'PIN / account', accessories: ['Controller', 'Cavo HDMI', 'Alimentatore', 'Gioco inserito'] },
  altro: { label: 'Altro', serial: 'Numero di serie', passcode: 'Codice di sblocco', accessories: ['Caricatore', 'Cavo', 'Borsa'] },
};
export const typeInfo = (t) => DEVICE_TYPES[t] || DEVICE_TYPES.altro;

const RISK = ['Segni di liquido', 'Già aperto da terzi'];
const PRE_BASE = ['Backup dati eseguito / proposto al cliente', 'Cliente autorizza reset o formattazione', 'Accessori contati e annotati', 'Foto del dispositivo scattate'];
const PHONE_DEFAULT = {
  in: ['Si accende', 'Display / touch', 'Fotocamere', 'Audio e microfono', 'Altoparlante', 'Pulsanti', 'Ricarica / porta', 'Wi-Fi / Bluetooth', 'SIM / rete', 'Face ID / impronta', 'Sensori', 'Batteria (stato)', 'Vetro posteriore', ...RISK],
  pre: [...PRE_BASE, 'Blocco account disattivato (iCloud / Google)', 'SIM e scheda SD rimosse e restituite'],
  out: ['Si accende e si avvia', 'Display / touch', 'Fotocamere', 'Audio e microfono', 'Altoparlante', 'Pulsanti', 'Ricarica / porta', 'Wi-Fi / Bluetooth', 'SIM / rete', 'Face ID / impronta', 'Sensori', 'Batteria / autonomia', 'Pulizia / estetica', 'Viti e cover chiuse', 'Aggiornamenti / reset'],
};
export const DEFAULT_CHECKLISTS = {
  smartphone: PHONE_DEFAULT,
  tablet: { ...PHONE_DEFAULT, in: PHONE_DEFAULT.in.map((x) => (x === 'SIM / rete' ? 'SIM / rete (se presente)' : x)), out: PHONE_DEFAULT.out.map((x) => (x === 'SIM / rete' ? 'SIM / rete (se presente)' : x)) },
  portatile: {
    in: ['Si accende', 'Display e retroilluminazione', 'Tastiera', 'Trackpad', 'Cerniere e scocca', 'Webcam e microfono', 'Audio', 'Porte USB / video', 'Wi-Fi / Bluetooth', 'Batteria e ricarica', 'Ventola e temperature', 'Disco / SSD riconosciuto', 'Il sistema si avvia', ...RISK],
    pre: [...PRE_BASE, 'Password di accesso ricevuta (se serve)', 'Alimentatore consegnato / annotato'],
    out: ['Si accende e si avvia', 'Display e retroilluminazione', 'Tastiera', 'Trackpad', 'Cerniere e scocca chiuse', 'Webcam e microfono', 'Audio', 'Porte USB / video', 'Wi-Fi / Bluetooth', 'Batteria e ricarica', 'Ventola e temperature', 'Disco / SSD', 'Pulizia / estetica', 'Aggiornamenti e driver'],
  },
  pc: {
    in: ['Si accende', 'POST / video', 'Alimentatore', 'Ventole e temperature', 'Disco / SSD', 'RAM', 'Porte USB', 'Rete (cavo / Wi-Fi)', 'Audio', 'Il sistema si avvia', 'Polvere o liquido', 'Già aperto da terzi'],
    pre: [...PRE_BASE, 'Password di accesso ricevuta (se serve)', 'Cavi e periferiche annotati'],
    out: ['Si accende e si avvia', 'POST / video', 'Alimentatore', 'Ventole e temperature', 'Disco / SSD (stato)', 'RAM (test)', 'Porte USB', 'Rete (cavo / Wi-Fi)', 'Audio', 'Pulizia interna / estetica', 'Pannelli chiusi', 'Aggiornamenti e driver'],
  },
  console: {
    in: ['Si accende', 'Uscita video / HDMI', 'Lettore dischi', 'Controller (collegamento e tasti)', 'Porte USB', 'Rete (Wi-Fi / cavo)', 'Audio', 'Ventola e temperature', 'Disco / memoria', 'Alimentatore', ...RISK],
    pre: [...PRE_BASE, 'Dischi e memorie esterne rimossi', 'Account / PIN annotato (se serve)'],
    out: ['Si accende e si avvia', 'Uscita video / HDMI', 'Lettore dischi', 'Controller (collegamento e tasti)', 'Porte USB', 'Rete (Wi-Fi / cavo)', 'Audio', 'Ventola e temperature', 'Pulizia / estetica', 'Viti e scocca chiuse', 'Aggiornamento del sistema'],
  },
  altro: {
    in: ['Si accende', 'Funzionamento generale', 'Display / indicatori', 'Pulsanti e comandi', 'Collegamenti e porte', 'Alimentazione / ricarica', ...RISK],
    pre: [...PRE_BASE],
    out: ['Si accende e funziona', 'Display / indicatori', 'Pulsanti e comandi', 'Collegamenti e porte', 'Alimentazione / ricarica', 'Pulizia / estetica', 'Viti e cover chiuse'],
  },
};

const cleanList = (v) => {
  if (!Array.isArray(v)) throw new HttpError(400, 'Elenco di voci non valido');
  const out = [...new Set(v.map((x) => String(x ?? '').trim().slice(0, 80)).filter(Boolean))];
  if (out.length > 40) throw new HttpError(400, 'Al massimo 40 voci per elenco');
  return out;
};
const checkType = (t) => {
  if (!DEVICE_TYPES[t]) throw new HttpError(400, 'Tipo di dispositivo non valido');
  return t;
};

/** Elenchi in uso per ogni tipo: predefiniti, con le personalizzazioni sopra. */
export async function getChecklists() {
  const rows = await db.prepare('SELECT * FROM checklist_templates').all();
  const out = {};
  for (const t of Object.keys(DEVICE_TYPES)) {
    out[t] = { custom: false };
    for (const p of Object.keys(PHASES)) out[t][p] = [...DEFAULT_CHECKLISTS[t][p]];
  }
  for (const r of rows) {
    if (!out[r.device_type] || !PHASES[r.phase]) continue;
    try { out[r.device_type][r.phase] = JSON.parse(r.items); out[r.device_type].custom = true; } catch { /* riga rovinata: si usa il predefinito */ }
  }
  return out;
}
export async function listFor(type) { return (await getChecklists())[checkType(type)]; }

export async function saveTemplate(type, body) {
  checkType(type);
  const lists = {};
  for (const p of Object.keys(PHASES)) if (p in body) lists[p] = cleanList(body[p]);
  if (!Object.keys(lists).length) throw new HttpError(400, 'Nessun elenco da salvare');
  await tx(async () => {
    for (const [p, items] of Object.entries(lists)) {
      await db.prepare('INSERT INTO checklist_templates (device_type, phase, items) VALUES (?,?,?) ON CONFLICT(device_type, phase) DO UPDATE SET items = excluded.items').run(type, p, JSON.stringify(items));
    }
  });
  return listFor(type);
}
export async function resetTemplate(type) {
  checkType(type);
  await db.prepare('DELETE FROM checklist_templates WHERE device_type = ?').run(type);
  return listFor(type);
}

// ---------- Controlli compilati sulla riparazione ----------
export const parseCheck = (raw) => {
  if (!raw) return null;
  try { const o = JSON.parse(raw); return Array.isArray(o?.items) ? o : null; } catch { return null; }
};

export async function saveRepairCheck(repairId, phase, items, user) {
  if (!PHASES[phase]) throw new HttpError(400, 'Fase non valida');
  if (!Array.isArray(items)) throw new HttpError(400, 'Controlli non validi');
  const r = await db.prepare('SELECT id FROM repairs WHERE id = ?').get(repairId);
  if (!r) throw new HttpError(404, 'Riparazione non trovata');
  const clean = items.slice(0, 60).map((i) => ({ l: String(i?.l ?? '').trim().slice(0, 80), s: STATES.includes(i?.s) ? i.s : null })).filter((i) => i.l);
  const by = user?.name || user?.email || 'locale';
  const rec = { items: clean, by, at: nowLocal() };
  await tx(async () => {
    await db.prepare(`UPDATE repairs SET checklist_${phase} = ? WHERE id = ?`).run(JSON.stringify(rec), repairId);
    const ko = clean.filter((i) => i.s === 'ko').length;
    const done = clean.filter((i) => i.s).length;
    await logEvent(repairId, null, `${PHASES[phase]} compilato da ${by}: ${done}/${clean.length} voci${ko ? `, ${ko} da segnalare` : ''}.`, 0);
  });
  return rec;
}
