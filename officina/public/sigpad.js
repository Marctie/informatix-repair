// Riquadro per la firma disegnata (dito, penna o mouse). Script semplice (non modulo): lo usano sia il gestionale sia la pagina pubblica.
//   const pad = SigPad.create(canvas, { onChange: (vuoto) => … });  pad.clear();  pad.isEmpty();  pad.toDataURL() -> PNG 600x200 trasparente
(function () {
  function create(canvas, opts) {
    var o = opts || {};
    var ctx = canvas.getContext('2d');
    var empty = true, drawing = false, last = null, ratio = 1;
    function fit() {
      // adatta la risoluzione alla dimensione sullo schermo; il disegno gia' fatto si ricopia
      var rect = canvas.getBoundingClientRect();
      if (!rect.width) return;
      var snapshot = empty ? null : canvas.toDataURL();
      ratio = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      ctx = canvas.getContext('2d');
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2.6 * ratio;
      if (snapshot) { var im = new Image(); im.onload = function () { ctx.drawImage(im, 0, 0, canvas.width, canvas.height); }; im.src = snapshot; }
    }
    function pos(e) {
      var r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) * ratio, y: (e.clientY - r.top) * ratio };
    }
    function down(e) {
      if (e.button != null && e.button > 0) return;
      e.preventDefault();
      drawing = true; last = pos(e);
      try { canvas.setPointerCapture(e.pointerId); } catch (x) { /* non supportato */ }
      ctx.beginPath(); ctx.arc(last.x, last.y, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fillStyle = '#111'; ctx.fill();
      if (empty) { empty = false; canvas.classList.add('signed'); if (o.onChange) o.onChange(false); }
    }
    function move(e) {
      if (!drawing) return;
      e.preventDefault();
      var p = pos(e);
      ctx.beginPath(); ctx.moveTo(last.x, last.y);
      var mx = (last.x + p.x) / 2, my = (last.y + p.y) / 2;
      ctx.quadraticCurveTo(last.x, last.y, mx, my); ctx.stroke();
      last = p;
    }
    function up() { drawing = false; last = null; }
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('pointerleave', up);
    window.addEventListener('resize', fit);
    fit();
    return {
      clear: function () { ctx.clearRect(0, 0, canvas.width, canvas.height); empty = true; canvas.classList.remove('signed'); if (o.onChange) o.onChange(true); },
      isEmpty: function () { return empty; },
      refit: fit,
      destroy: function () { window.removeEventListener('resize', fit); },
      // esporta in 600x200 (con lo stesso rapporto del riquadro): firma leggera e sempre della stessa misura
      toDataURL: function () {
        var out = document.createElement('canvas'); out.width = 600; out.height = 200;
        var c = out.getContext('2d');
        var s = Math.min(600 / canvas.width, 200 / canvas.height);
        var w = canvas.width * s, h = canvas.height * s;
        c.drawImage(canvas, (600 - w) / 2, (200 - h) / 2, w, h);
        return out.toDataURL('image/png');
      },
    };
  }
  window.SigPad = { create: create };
})();
