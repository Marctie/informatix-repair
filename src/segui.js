// Pagina "Segui la tua riparazione": numero ricevuta + ultime 4 cifre del telefono -> pagina di tracciamento.
import { t } from './i18n.js';

const TRACK = 'https://riparazioni.informatixrepair.com';
const form = document.getElementById('segui-form');
const err = document.getElementById('s-error');
const btn = document.getElementById('s-submit');
const show = (msg) => {
  err.textContent = msg;
  err.classList.toggle('hidden', !msg);
};

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  show('');
  const code = form.code.value.trim();
  const phone4 = form.phone4.value.replace(/\D/g, '');
  if (!code || phone4.length !== 4) return show(t('segui.err.fields'));
  btn.disabled = true;
  btn.classList.add('opacity-60');
  try {
    const res = await fetch(`${TRACK}/api/lookup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, phone4 }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.token) {
      location.href = `${TRACK}/t/${data.token}`;
      return;
    }
    show(res.status === 429 ? t('segui.err.many') : t('segui.err.notfound'));
  } catch {
    show(t('segui.err.network'));
  } finally {
    btn.disabled = false;
    btn.classList.remove('opacity-60');
  }
});
