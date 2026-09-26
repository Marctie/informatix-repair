import './main.js';

/* ---------- Stato del negozio (aperto / chiuso) ---------- */
// Giorni: 0 = domenica. Fasce in minuti dalla mezzanotte, ora di Roma.
const HOURS = {
  1: [[540, 810], [960, 1170]],
  2: [[540, 810], [960, 1170]],
  3: [[540, 810], [960, 1170]],
  4: [[540, 810], [960, 1170]],
  5: [[540, 810], [960, 1170]],
  6: [[540, 750]],
  0: [],
};
const DAYS = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const hm = (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;

function romeNow() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return { day, min: (Number(get('hour')) % 24) * 60 + Number(get('minute')) };
}

function shopStatus() {
  const { day, min } = romeNow();
  const open = (HOURS[day] || []).find(([a, b]) => min >= a && min < b);
  if (open) return { open: true, text: `Aperto ora, fino alle ${hm(open[1])}` };
  const later = (HOURS[day] || []).find(([a]) => min < a);
  if (later) return { open: false, text: `Chiuso, riapre oggi alle ${hm(later[0])}` };
  for (let i = 1; i <= 7; i++) {
    const d = (day + i) % 7;
    if (HOURS[d].length) return { open: false, text: `Chiuso, riapre ${i === 1 ? 'domani' : DAYS[d]} alle ${hm(HOURS[d][0][0])}` };
  }
  return { open: false, text: 'Chiuso' };
}

function initStatus() {
  const box = document.getElementById('shop-status');
  if (!box) return;
  const s = shopStatus();
  box.querySelector('[data-status-text]').textContent = s.text;
  const icon = box.querySelector('svg');
  if (icon) icon.classList.toggle('text-emerald-400', s.open);
  if (icon) icon.classList.toggle('text-secondary', !s.open);
}

/* ---------- Galleria delle card ---------- */
function initGalleries() {
  document.querySelectorAll('.usato').forEach((card) => {
    const main = card.querySelector('.usato-main');
    const thumbs = card.querySelectorAll('.usato-thumb');
    if (!main || !thumbs.length) return;
    const bg = main.previousElementSibling;
    thumbs.forEach((t) =>
      t.addEventListener('click', () => {
        main.src = t.dataset.full;
        main.alt = `${card.querySelector('[data-title]').dataset.title}, foto ${t.dataset.n}`;
        if (bg) bg.src = t.dataset.full;
        card.dataset.current = String(Number(t.dataset.n) - 1);
        thumbs.forEach((x) => {
          const on = x === t;
          x.setAttribute('aria-pressed', String(on));
          x.classList.toggle('border-secondary', on);
          x.classList.toggle('border-transparent', !on);
          x.classList.toggle('opacity-70', !on);
        });
      })
    );
  });
}

/* ---------- Lightbox ---------- */
function initLightbox() {
  const box = document.getElementById('lightbox');
  if (!box) return;
  const img = box.querySelector('.lb-img');
  const cap = box.querySelector('.lb-cap');
  let list = [];
  let i = 0;
  let title = '';
  let opener = null;

  const show = () => {
    img.src = list[i];
    img.alt = `${title}, foto ${i + 1} di ${list.length}`;
    cap.textContent = `${title} · ${i + 1} / ${list.length}`;
    box.querySelector('.lb-prev').hidden = box.querySelector('.lb-next').hidden = list.length < 2;
  };
  const open = (card, btn) => {
    const holder = card.querySelector('[data-photos]');
    list = JSON.parse(holder.dataset.photos);
    title = holder.dataset.title;
    i = Number(card.dataset.current || 0);
    opener = btn;
    show();
    box.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    box.querySelector('.lb-close').focus();
  };
  const close = () => {
    box.classList.add('hidden');
    document.body.style.overflow = '';
    opener?.focus();
  };
  const go = (d) => {
    i = (i + d + list.length) % list.length;
    show();
  };

  document.querySelectorAll('.usato-open').forEach((b) => b.addEventListener('click', () => open(b.closest('.usato'), b)));
  box.querySelector('.lb-close').addEventListener('click', close);
  box.querySelector('.lb-prev').addEventListener('click', () => go(-1));
  box.querySelector('.lb-next').addEventListener('click', () => go(1));
  box.addEventListener('click', (e) => e.target === box || e.target.tagName === 'FIGURE' ? close() : null);
  document.addEventListener('keydown', (e) => {
    if (box.classList.contains('hidden')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') go(-1);
    if (e.key === 'ArrowRight') go(1);
  });
  let x0 = null;
  box.addEventListener('touchstart', (e) => (x0 = e.touches[0].clientX), { passive: true });
  box.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
    x0 = null;
  });
}

/* ---------- Filtri ---------- */
function initFilters() {
  const buttons = document.querySelectorAll('[data-usati-filter]');
  const cards = document.querySelectorAll('.usato');
  const counter = document.getElementById('usati-count');
  const empty = document.getElementById('usati-empty');
  const match = (c, f) => f === 'all' || c.dataset.kind === f || c.dataset.cat === f || (f === '500' && c.dataset.price !== undefined && Number(c.dataset.price) <= 500);
  buttons.forEach((btn) =>
    btn.addEventListener('click', () => {
      const f = btn.dataset.usatiFilter;
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      let n = 0;
      cards.forEach((c) => {
        const ok = match(c, f);
        c.hidden = !ok;
        if (ok) n++;
      });
      if (counter) counter.textContent = String(n);
      empty?.classList.toggle('hidden', n > 0);
    })
  );
}

/* Se si arriva da un link con #slug, evidenzia la scheda */
function highlightFromHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  const el = id && document.getElementById(id);
  if (!el || !el.classList.contains('usato')) return;
  el.classList.add('ring-2', 'ring-secondary');
  setTimeout(() => el.classList.remove('ring-2', 'ring-secondary'), 2600);
}

document.addEventListener('DOMContentLoaded', () => {
  initStatus();
  initGalleries();
  initLightbox();
  initFilters();
  highlightFromHash();
});
