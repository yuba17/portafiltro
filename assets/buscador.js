/* Buscador de compatibilidad. Carga el indice de modelos y filtra en cliente.
   Es el nucleo del producto: el cliente escribe su modelo y le decimos que le vale. */
(function () {
  const q = document.getElementById("q");
  const sug = document.getElementById("sug");
  const btn = document.getElementById("btn-buscar");
  if (!q || !sug) return;

  let datos = [];
  fetch("/assets/modelos.json")
    .then(r => r.json())
    .then(d => { datos = d; })
    .catch(() => {});

  const norm = s => s.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();

  function buscar(t) {
    const n = norm(t);
    if (n.length < 2) return [];
    const partes = n.split(" ").filter(Boolean);
    return datos
      .map(x => {
        const h = norm(x.m);
        let p = 0;
        partes.forEach(w => { if (h.includes(w)) p += w.length; });
        if (h.startsWith(n)) p += 12;
        return { x, p };
      })
      .filter(r => r.p > 0)
      .sort((a, b) => b.p - a.p || b.x.n - a.x.n)
      .slice(0, 8)
      .map(r => r.x);
  }

  function pintar(res) {
    if (!res.length) {
      sug.innerHTML = '<li class="vacio">No encontramos ese modelo. Escríbenos y lo añadimos.</li>';
      sug.hidden = false;
      return;
    }
    sug.innerHTML = res.map(x =>
      `<li role="option"><a href="${x.u}"><span>${x.m}</span><span class="n">${x.n} piezas</span></a></li>`
    ).join("");
    sug.hidden = false;
  }

  let t;
  q.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(() => {
      const v = q.value.trim();
      if (v.length < 2) { sug.hidden = true; return; }
      pintar(buscar(v));
    }, 120);
  });

  q.addEventListener("keydown", ev => {
    if (ev.key === "Escape") { sug.hidden = true; }
    if (ev.key === "Enter") {
      const a = sug.querySelector("a");
      if (a) location.href = a.getAttribute("href");
    }
  });

  btn && btn.addEventListener("click", () => {
    const a = sug.querySelector("a");
    if (a) location.href = a.getAttribute("href");
    else pintar(buscar(q.value.trim()));
  });

  document.addEventListener("click", ev => {
    if (!sug.contains(ev.target) && ev.target !== q) sug.hidden = true;
  });
})();
