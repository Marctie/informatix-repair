// Icone a linea coerenti (stile unico) al posto delle emoji colorate.
// Le emoji scritte nei testi della pagina vengono sostituite automaticamente da icone SVG (anche per il contenuto
// creato dopo, grazie a un MutationObserver): niente da cambiare nei template.
const P = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.4 2.4-2.6-.6-.6-2.6z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17 14c2.8 0 4.5 1.9 4.5 4.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  package: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 11.5a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.8L20 7H6"/>',
  truck: '<path d="M2 6h11v10H2zM13 9h4l4 4v3h-8z"/><circle cx="6.5" cy="18" r="1.8"/><circle cx="17.5" cy="18" r="1.8"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h13v4"/><path d="M3 7v11a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2z"/><circle cx="16.5" cy="14.5" r="1.2"/>',
  sliders: '<path d="M4 6h8M18 6h2M4 12h2M12 12h8M4 18h10M20 18h0"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  book: '<path d="M2 4h7a3 3 0 0 1 3 3v14a2 2 0 0 0-2-2H2zM22 4h-7a3 3 0 0 0-3 3v14a2 2 0 0 1 2-2h8z"/>',
  camera: '<path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
  printer: '<path d="M7 9V3h10v6M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2"/><path d="M7 14h10v7H7z"/>',
  tag: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.3"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  pencil: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  phone: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
  message: '<path d="M21 12a8.5 8.5 0 0 1-12.4 7.5L3 21l1.6-5.2A8.5 8.5 0 1 1 21 12z"/>',
  flame: '<path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 2.5 1.5 2.5C10 9 11 6 12 3z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  hand: '<path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11V5.5a1.5 1.5 0 0 1 3 0V14c0 4-2.5 7-6 7-2.5 0-4-1.2-5.2-3.2L3.5 14a1.5 1.5 0 0 1 2.5-1.6L8 14.5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M16 7l3 3M14 9l2 2"/>',
  scroll: '<path d="M8 3h11v15a3 3 0 0 1-3 3H6a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3z"/><path d="M12 8h4M12 12h4"/>',
  trend: '<path d="m3 7 6 6 4-4 8 8"/><path d="M21 11v6h-6"/>',
  download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  note: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  barcode: '<path d="M4 5v14M8 5v14M12 5v14M16 5v14M20 5v14"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  party: '<path d="m4 20 4-12 8 8z"/><path d="M14 4v2M19 7h-2M20 14h-2"/>',
  inbox: '<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5 5h14l2 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z"/>',
  bell: '<path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15z"/><path d="M10 21a2 2 0 0 0 4 0"/>',
  smartphone: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/>',
  ticket: '<path d="M3 8a2 2 0 0 0 0 4v0a2 2 0 0 1 0 4v1a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-1a2 2 0 0 1 0-4v0a2 2 0 0 0 0-4V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1z"/><path d="M14 6v12" stroke-dasharray="2 2.5"/>',
  idcard: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 16c.5-1.7 1.8-2.5 3-2.5s2.5.8 3 2.5M14.5 10h4M14.5 13.5h3"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v8h14v-8M12 8v12M12 8c-1-3-5-3.5-5-1.2C7 8.5 9 8 12 8zm0 0c1-3 5-3.5 5-1.2 0 1.7-2 1.2-5 1.2z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  split: '<path d="M12 4v16M5 12h14"/><circle cx="12" cy="12" r="9"/>',
};

// carattere/emoji -> icona
const MAP = {
  '🏠': 'home', '🛠️': 'wrench', '🛠': 'wrench', '👤': 'user', '📦': 'package', '🛒': 'cart', '🚚': 'truck', '💶': 'wallet',
  '⚙️': 'sliders', '⚙': 'sliders', '📖': 'book', '📷': 'camera', '🖨️': 'printer', '🖨': 'printer', '🔧': 'wrench', '🏷️': 'tag', '🏷': 'tag',
  '👁️': 'eye', '👁': 'eye', '📋': 'copy', '✏️': 'pencil', '✏': 'pencil', '📞': 'phone', '💬': 'message', '🔥': 'flame', '⏰': 'clock',
  '✋': 'hand', '📉': 'trend', '💾': 'download', '🔒': 'lock', '✉️': 'mail', '✉': 'mail', '📝': 'note', '🔫': 'barcode',
  '✔': 'check', '✓': 'check', '＋': 'plus', '☰': 'menu', '✕': 'x', '⚠': 'alert', '⚠️': 'alert', '🎉': 'party',
  '👥': 'users', '📊': 'chart', '🧭': 'compass', '📮': 'inbox', '🧾': 'receipt', '🔑': 'key', '📜': 'scroll', '🔔': 'bell',
  '📱': 'smartphone', '🎟️': 'ticket', '🎟': 'ticket', '🪪': 'idcard', '🔐': 'lock', '🎁': 'gift', '🌐': 'globe', '➗': 'split',
};
const RE = new RegExp(Object.keys(MAP).sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');

export const ico = (name, cls = '') =>
  `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;

const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'OPTION', 'SELECT', 'TITLE', 'SVG', 'CODE']);

function decorateNode(root) {
  if (!root || SKIP.has(root.nodeName?.toUpperCase())) return;
  if (root.nodeType === 3) {
    const t = root.nodeValue;
    RE.lastIndex = 0;
    if (!RE.test(t)) return;
    RE.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let last = 0;
    let m;
    while ((m = RE.exec(t))) {
      if (m.index > last) frag.append(t.slice(last, m.index));
      const span = document.createElement('span');
      span.className = 'ic-wrap';
      span.innerHTML = ico(MAP[m[0]]);
      frag.append(span);
      last = m.index + m[0].length;
    }
    if (last < t.length) frag.append(t.slice(last));
    root.replaceWith(frag);
    return;
  }
  if (root.nodeType !== 1) return;
  if (root.closest?.('svg')) return;
  [...root.childNodes].forEach(decorateNode);
}

export function decorate(root = document.body) { decorateNode(root); }

new MutationObserver((muts) => {
  for (const m of muts) {
    m.addedNodes.forEach((n) => decorateNode(n));
    if (m.type === 'characterData') decorateNode(m.target);
  }
}).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
decorate();
