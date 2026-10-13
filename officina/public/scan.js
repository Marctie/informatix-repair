// Lettura di codici a barre / QR con la fotocamera (telefono o tablet).
// Richiede un contesto sicuro: https oppure localhost. Con il gestionale solo sul PC in rete locale (http) il browser
// blocca la fotocamera: funzionerà quando il gestionale sarà online con https. Fino ad allora usare la pistola.
import { $, toast, openModal } from './util.js';

const FORMATS = ['code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'codabar', 'qr_code', 'data_matrix'];

/** Apre la fotocamera e restituisce il testo letto, oppure null se annullato o non disponibile. */
export async function scanWithCamera() {
  if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
    toast('La fotocamera funziona solo su connessione sicura (https): sarà disponibile quando il gestionale sarà online. Per ora usa la pistola.', false);
    return null;
  }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
  } catch {
    toast('Impossibile usare la fotocamera: controlla di aver dato il permesso al browser.', false);
    return null;
  }
  return new Promise((resolve) => {
    let done = false;
    let timer = null;
    let stopZxing = null;
    const m = openModal(
      `<div class="relative bg-black rounded-xl overflow-hidden"><video id="cam-video" playsinline muted class="w-full max-h-[60vh] object-cover"></video>
        <div class="absolute inset-x-6 top-1/2 -translate-y-1/2 h-24 border-2 border-white/80 rounded-lg pointer-events-none"></div></div>
       <p id="cam-status" class="text-sm text-gray-500 text-center mt-3">Inquadra il codice a barre o il QR…</p>`,
      { title: '📷 Scansiona codice', footer: '<button class="btn btn-outline" data-close>Annulla</button>' }
    );
    const finish = (value) => {
      if (done) return;
      done = true;
      clearInterval(timer);
      try { stopZxing?.(); } catch { /* già fermo */ }
      stream.getTracks().forEach((t) => t.stop());
      m.close();
      resolve(value);
    };
    m.el.addEventListener('click', (e) => { if (e.target.closest('[data-close]') || e.target === m.el) finish(null); });
    const video = $('#cam-video', m.el);
    video.srcObject = stream;
    video.play().catch(() => {});

    if ('BarcodeDetector' in window) {
      const detector = new window.BarcodeDetector({ formats: FORMATS });
      timer = setInterval(async () => {
        try {
          const found = await detector.detect(video);
          if (found.length) finish(found[0].rawValue);
        } catch { /* frame non pronto */ }
      }, 250);
    } else {
      // Browser senza BarcodeDetector (es. Safari su iPhone): libreria ZXing caricata al bisogno.
      $('#cam-status', m.el).textContent = 'Preparo il lettore…';
      import('https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm').then(async ({ BrowserMultiFormatReader }) => {
        if (done) return;
        $('#cam-status', m.el).textContent = 'Inquadra il codice a barre o il QR…';
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromStream(stream, video, (result) => { if (result) finish(result.getText()); });
        stopZxing = () => controls.stop();
      }).catch(() => {
        $('#cam-status', m.el).innerHTML = `<span class="text-secondary">Questo browser non sa leggere i codici a barre. Usa la pistola oppure scrivi il codice a mano.</span>`;
      });
    }
  });
}

export const cameraSupported = () => !!navigator.mediaDevices?.getUserMedia && window.isSecureContext;
