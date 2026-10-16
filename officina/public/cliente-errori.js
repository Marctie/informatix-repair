// Errori per il CLIENTE (pagine pubbliche: preventivo, tracking). Script semplice (non modulo), senza dipendenze e senza dati riservati.
// Messaggi in italiano semplice e rassicurante, mai codici o dettagli tecnici. Espone window.ClientErr.
(function (root) {
  var CALL = 'oppure chiama il negozio';
  /** Da stato HTTP / rete a { kind, title, text, retry, reload }. status 0 = rete assente, -1 = tempo scaduto. */
  function classify(status, serverText) {
    var s = Number(status) || 0;
    if (s === 0) return { kind: 'network', title: 'Connessione assente', text: 'Non riusciamo a collegarci. Quello che hai scritto e la tua firma sono ancora qui: controlla internet e premi Riprova.', retry: true };
    if (s === -1) return { kind: 'timeout', title: 'Ci vuole più del previsto', text: 'La risposta sta tardando. Controlla la connessione e premi Riprova: se hai già inviato, ti basta aggiornare la pagina per vederlo.', retry: true };
    if (s === 404) return { kind: 'notfound', title: 'Link non valido', text: 'Controlla di aver aperto il link completo che ti ha mandato il negozio, ' + CALL + '.', retry: false };
    if (s === 410) return { kind: 'expired', title: 'Link scaduto', text: 'Questo link non è più valido. Chiama il negozio e te ne daremo uno nuovo.', retry: false };
    if (s === 409) return { kind: 'decided', title: 'Già registrato', text: serverText || 'Questa richiesta è già stata registrata, quindi non serve fare altro. Se hai dubbi, chiama il negozio.', retry: false, reload: true };
    if (s === 429) return { kind: 'rate', title: 'Un attimo di pazienza', text: 'Sono arrivate troppe richieste di seguito. Aspetta qualche secondo e riprova.', retry: true };
    if (s >= 500) return { kind: 'server', title: 'Ci scusiamo, c’è un problema da parte nostra', text: 'Non è colpa tua e nulla è andato perso. Riprova tra poco, ' + CALL + '.', retry: true };
    if (s >= 400) return { kind: 'input', title: 'Non siamo riusciti a completare', text: serverText || 'Controlla i dati inseriti e riprova, ' + CALL + '.', retry: false };
    return { kind: 'server', title: 'Qualcosa non ha funzionato', text: 'Riprova tra poco, ' + CALL + '.', retry: true };
  }

  /** Chiamata al server: ritorna { ok, status, data } oppure { ok:false, status, error: classify(...) }. Mai eccezioni. */
  function call(url, opts, timeoutMs) {
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timedOut = false;
    var t = setTimeout(function () { timedOut = true; if (ctl) ctl.abort(); }, timeoutMs || 25000);
    var o = opts || {}; if (ctl) o.signal = ctl.signal;
    return fetch(url, o).then(function (res) {
      return res.text().then(function (raw) {
        var data = null; try { data = raw ? JSON.parse(raw) : null; } catch (e) { data = null; }
        if (res.ok && data !== null) return { ok: true, status: res.status, data: data };
        // risposta "ok" ma non JSON (es. pagina di un intermediario): la trattiamo come problema del server
        var st = res.ok ? 502 : res.status;
        var text = data && typeof data.error === 'string' && st < 500 ? data.error : '';
        return { ok: false, status: st, error: classify(st, text) };
      });
    }, function () {
      return { ok: false, status: timedOut ? -1 : 0, error: classify(timedOut ? -1 : 0) };
    }).then(function (r) { clearTimeout(t); return r; }, function () { clearTimeout(t); return { ok: false, status: 0, error: classify(0) }; });
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /** HTML del riquadro d'errore (con pulsante Riprova se ha senso). */
  function box(err, withRetry) {
    return '<div class="cerr" role="alert" style="background:#FEF2F2;border:1px solid #FECACA;border-radius:12px;padding:12px 14px;color:#7F1D1D;font-size:14px;line-height:1.45;text-align:left">' +
      '<b>' + esc(err.title) + '</b><div style="margin-top:2px">' + esc(err.text) + '</div>' +
      (withRetry && err.retry ? '<button type="button" class="cerr-retry" style="margin-top:8px;border:0;background:#B91C1C;color:#fff;border-radius:10px;padding:8px 14px;font:inherit;font-weight:600;cursor:pointer">Riprova</button>' : '') +
      (err.reload ? '<button type="button" class="cerr-reload" style="margin-top:8px;margin-left:6px;border:1px solid #B91C1C;background:#fff;color:#B91C1C;border-radius:10px;padding:8px 14px;font:inherit;font-weight:600;cursor:pointer">Aggiorna la pagina</button>' : '') + '</div>';
  }

  /** Mostra l'errore dentro `host` (un elemento) e collega i pulsanti. */
  function show(host, err, retryFn) {
    if (!host) return;
    host.innerHTML = box(err, !!retryFn);
    var r = host.querySelector('.cerr-retry'); if (r && retryFn) r.onclick = function () { host.innerHTML = ''; retryFn(); };
    var l = host.querySelector('.cerr-reload'); if (l) l.onclick = function () { location.reload(); };
  }

  root.ClientErr = { classify: classify, call: call, box: box, show: show };
})(typeof window !== 'undefined' ? window : globalThis);
