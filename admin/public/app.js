const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

let ITEMS = [];
let TAB = 'active';
let editingSlug = null;
let existingPhotos = []; // [{n, url, keep:true}] per l'articolo in editing
let newFiles = []; // File[] appena selezionati

const euro = (n) => (n == null ? 'Su richiesta' : n.toLocaleString('it-IT') + ' €');

function toast(msg, ok = true) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  t.style.background = ok ? '#0B0F19' : '#B91C1C';
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.add('hidden'), 2600);
}

async function fetchItems() {
  const res = await fetch('/api/items');
  const data = await res.json();
  ITEMS = data.items;
  render();
}

function statusBadge(it) {
  if (it.status === 'active') return `<span class="badge bg-emerald-100 text-emerald-700">● In vetrina</span>`;
  if (it.status === 'sold') return `<span class="badge bg-amber-100 text-amber-700">Venduto · scompare in ${it.daysLeft}g</span>`;
  return `<span class="badge bg-gray-200 text-gray-600">Scaduto · rimosso dalla vetrina</span>`;
}

function render() {
  const list = ITEMS.filter((it) => TAB === 'all' || it.status === TAB);
  $('#count-label').textContent = `${list.length} articoli`;
  $('#empty').classList.toggle('hidden', list.length > 0);
  $('#grid').innerHTML = list
    .map((it) => {
      const title = [it.name, it.memory, it.color].filter(Boolean).join(' ');
      const thumb = it.photos > 0 ? `/images/usati/${it.slug}/1-t.jpg` : '';
      return `
      <div class="item-card">
        <div class="item-thumb">
          ${thumb ? `<img src="${thumb}" alt="">` : `<span class="no-photo">Nessuna foto</span>`}
          <div class="item-badge-pos">${statusBadge(it)}</div>
        </div>
        <div class="p-4 flex flex-col grow gap-1.5">
          <h3 class="font-semibold leading-snug">${title}</h3>
          <p class="text-xs text-gray-500">${it.conditionLabel}</p>
          <p class="item-price mt-0.5">${euro(it.price)}</p>
          <div class="mt-auto pt-3 flex flex-wrap gap-2 border-t border-line/70">
            <button class="btn-outline text-xs !py-1.5 !px-3" data-act="edit" data-slug="${it.slug}">Modifica</button>
            ${
              it.sold
                ? `<button class="btn-outline text-xs !py-1.5 !px-3" data-act="unsold" data-slug="${it.slug}">Rimetti in vetrina</button>`
                : `<button class="btn-outline text-xs !py-1.5 !px-3" data-act="sold" data-slug="${it.slug}">Segna venduto</button>`
            }
            <button class="btn-ghost text-xs !py-1.5 !px-2 !text-secondary ml-auto" data-act="delete" data-slug="${it.slug}">Elimina</button>
          </div>
        </div>
      </div>`;
    })
    .join('');
}

$('#grid').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const { act, slug } = btn.dataset;
  if (act === 'edit') return openForm(slug);
  if (act === 'sold') {
    await fetch(`/api/items/${slug}/sold`, { method: 'POST' });
    toast('Contrassegnato come venduto. Sparirà dalla vetrina in 7 giorni.');
    fetchItems();
  }
  if (act === 'unsold') {
    await fetch(`/api/items/${slug}/unsold`, { method: 'POST' });
    toast('Rimesso in vetrina.');
    fetchItems();
  }
  if (act === 'delete') {
    if (!confirm('Eliminare definitivamente questo articolo e le sue foto?')) return;
    await fetch(`/api/items/${slug}`, { method: 'DELETE' });
    toast('Articolo eliminato.');
    fetchItems();
  }
});

$$('.tab-btn').forEach((b) =>
  b.addEventListener('click', () => {
    TAB = b.dataset.tab;
    $$('.tab-btn').forEach((x) => x.classList.toggle('tab-active', x === b));
    render();
  })
);
$('[data-tab="active"]').classList.add('tab-active');

// ---------- Form ----------
function specRow(k = '', v = '') {
  const row = document.createElement('div');
  row.className = 'flex gap-2 spec-row';
  row.innerHTML = `<input class="spec-k" placeholder="es. Chip" value="${k}"><input class="spec-v" placeholder="es. A18 Pro" value="${v}"><button type="button" class="btn-ghost !px-2 text-secondary">×</button>`;
  row.querySelector('button').addEventListener('click', () => row.remove());
  return row;
}
$('#btn-add-spec').addEventListener('click', () => $('#specs-rows').appendChild(specRow()));

function resetForm() {
  editingSlug = null;
  existingPhotos = [];
  newFiles = [];
  $('#item-form').reset();
  $('#specs-rows').innerHTML = '';
  $('#photo-preview').innerHTML = '';
  $('#form-title').textContent = 'Nuovo articolo';
}

function openNew() {
  resetForm();
  $('#specs-rows').appendChild(specRow());
  $('#modal').classList.remove('hidden');
  $('#modal').classList.add('flex');
}

function openForm(slug) {
  const it = ITEMS.find((i) => i.slug === slug);
  if (!it) return;
  resetForm();
  editingSlug = slug;
  $('#form-title').textContent = 'Modifica articolo';
  $('#f-slug').value = slug;
  $('#f-name').value = it.name || '';
  $('#f-memory').value = it.memory || '';
  $('#f-color').value = it.color || '';
  $('#f-category').value = it.category || 'smartphone';
  $('#f-condition').value = it.condition || 'usato';
  $('#f-conditionLabel').value = it.conditionLabel || '';
  $('#f-price').value = it.price ?? '';
  $('#f-featured').checked = !!it.featured;
  $('#f-contact').checked = !!it.contact;
  $('#f-battery').value = it.battery || '';
  $('#f-cycles').value = it.cycles || '';
  $('#f-tagline').value = it.tagline || '';
  $('#f-description').value = it.description || '';
  (it.specs || []).forEach(([k, v]) => $('#specs-rows').appendChild(specRow(k, v)));
  if (!it.specs || !it.specs.length) $('#specs-rows').appendChild(specRow());

  existingPhotos = Array.from({ length: it.photos || 0 }, (_, i) => ({ n: i + 1, keep: true }));
  renderPhotoPreview(slug);

  $('#modal').classList.remove('hidden');
  $('#modal').classList.add('flex');
}

function renderPhotoPreview(slug) {
  const box = $('#photo-preview');
  box.innerHTML = '';
  existingPhotos
    .filter((p) => p.keep)
    .forEach((p) => {
      const d = document.createElement('div');
      d.className = 'photo-thumb';
      d.innerHTML = `<img src="/images/usati/${slug}/${p.n}-t.jpg"><button type="button" class="photo-thumb-x">×</button>`;
      d.querySelector('button').addEventListener('click', () => {
        p.keep = false;
        renderPhotoPreview(slug);
      });
      box.appendChild(d);
    });
  newFiles.forEach((f, i) => {
    const d = document.createElement('div');
    d.className = 'photo-thumb is-new';
    const img = document.createElement('img');
    img.src = URL.createObjectURL(f);
    d.appendChild(img);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'photo-thumb-x';
    btn.textContent = '×';
    btn.addEventListener('click', () => {
      newFiles.splice(i, 1);
      renderPhotoPreview(slug);
    });
    d.appendChild(btn);
    box.appendChild(d);
  });
  if (!box.children.length) box.innerHTML = '<p class="text-xs text-gray-400 py-1">Nessuna foto selezionata.</p>';
}

$('#photo-drop').addEventListener('click', () => $('#f-photos').click());
$('#photo-drop').addEventListener('dragover', (e) => {
  e.preventDefault();
  $('#photo-drop').classList.add('drag-active');
});
$('#photo-drop').addEventListener('dragleave', () => $('#photo-drop').classList.remove('drag-active'));
$('#photo-drop').addEventListener('drop', (e) => {
  e.preventDefault();
  $('#photo-drop').classList.remove('drag-active');
  addFiles(e.dataTransfer.files);
});
$('#f-photos').addEventListener('change', (e) => addFiles(e.target.files));
function addFiles(fileList) {
  newFiles.push(...[...fileList].filter((f) => f.type.startsWith('image/')));
  renderPhotoPreview(editingSlug || '');
}

$('#btn-new').addEventListener('click', openNew);
$('#btn-close').addEventListener('click', closeModal);
$('#btn-cancel').addEventListener('click', closeModal);
function closeModal() {
  $('#modal').classList.add('hidden');
  $('#modal').classList.remove('flex');
}

$('#item-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = $('#btn-submit');
  const originalLabel = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Salvataggio…';
  const specs = $$('.spec-row')
    .map((r) => [r.querySelector('.spec-k').value.trim(), r.querySelector('.spec-v').value.trim()])
    .filter(([k, v]) => k && v);

  const data = {
    name: $('#f-name').value.trim(),
    memory: $('#f-memory').value.trim(),
    color: $('#f-color').value.trim(),
    category: $('#f-category').value,
    condition: $('#f-condition').value,
    conditionLabel: $('#f-conditionLabel').value.trim(),
    price: $('#f-price').value,
    featured: $('#f-featured').checked,
    contact: $('#f-contact').checked,
    battery: $('#f-battery').value,
    cycles: $('#f-cycles').value,
    tagline: $('#f-tagline').value.trim(),
    description: $('#f-description').value.trim(),
    specs: JSON.stringify(specs),
  };

  const fd = new FormData();
  fd.append('data', JSON.stringify(data));
  newFiles.forEach((f) => fd.append('photos', f));

  try {
    let res;
    if (editingSlug) {
      fd.append('keepPhotos', JSON.stringify(existingPhotos.filter((p) => p.keep).map((p) => p.n)));
      res = await fetch(`/api/items/${editingSlug}`, { method: 'PUT', body: fd });
    } else {
      res = await fetch('/api/items', { method: 'POST', body: fd });
    }
    const out = await res.json();
    if (!out.ok) throw new Error(out.error || 'Errore');
    toast(editingSlug ? 'Articolo aggiornato e pubblicato.' : 'Articolo creato e pubblicato.');
    closeModal();
    fetchItems();
  } catch (err) {
    toast('Errore: ' + err.message, false);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalLabel;
  }
});

fetchItems();
