/* Buscador de compatibilidad — el nucleo del producto.
 *
 * Baymard mide que el 44 % de las tiendas falla en busquedas de compatibilidad
 * y el 54 % en abreviaturas, y que el 69 % no tolera erratas. Nuestro trafico
 * es exactamente ese tipo de consulta ("cesta 51mm delongui dedica"), asi que
 * aqui es donde se gana o se pierde el negocio.
 *
 * La version anterior fallaba en dos casos reales y frecuentes:
 *   - "delonghi" no encontraba "De'Longhi"  (una palabra contra dos)
 *   - "51mm" no encontraba "51 mm"          (tokens distintos)
 */
(function () {
  const q = document.getElementById("q");
  const sug = document.getElementById("sug");
  const btn = document.getElementById("btn-buscar");
  if (!q || !sug) return;

  let datos = [];
  fetch("/assets/modelos.json")
    .then(r => r.json())
    .then(d => { datos = d.map(x => Object.assign({}, x, {
      _n: norm(x.m),          // "de longhi dedica ec685"
      _c: norm(x.m).replace(/ /g, "")  // "delonghidedicaec685"
    })); })
    .catch(() => {});

  // Marcas cuya medida conocemos por el catalogo de fabricante aunque
  // todavia no vendamos sus piezas. Evita el callejon sin salida.
  let marcas = [];
  fetch("/assets/marcas.json")
    .then(r => r.json())
    .then(d => { marcas = d.map(x => Object.assign({}, x, { _n: norm(x.m) })); })
    .catch(() => {});

  function marcaConocida(consulta) {
    const p = trocear(consulta).filter(w => w.length > 2);
    if (!p.length) return null;
    for (const m of marcas) {
      for (const w of p) {
        if (m._n.includes(w) || cerca(w, m._n.split(" ")[0], w.length >= 7 ? 2 : 1)) {
          return m;
        }
      }
    }
    return null;
  }

  // Erratas y grafias que la gente escribe de verdad
  const ALIAS = {
    delongui: "delonghi", delongi: "delonghi", dlonghi: "delonghi",
    delonghy: "delonghi", longhi: "delonghi",
    gagia: "gaggia", gaggya: "gaggia", gagguia: "gaggia",
    rancillio: "rancilio", ranchilio: "rancilio",
    cecotek: "cecotec", zecotec: "cecotec", cecotech: "cecotec",
    sage: "sage", breville: "breville",
    lelith: "lelit", ascasso: "ascaso", krupps: "krups", krup: "krups",
    seaco: "saeco", saecco: "saeco", filips: "philips", phillips: "philips",
    // Palabras que no discriminan nada y ensucian la puntuacion.
    // "la" es importante: sin quitarla, "la cimbali" devolvia "La Marzocco".
    espresso: "", cafetera: "", maquina: "", portafiltro: "", cesta: "",
    para: "", mi: "", de: "", la: "", el: "", los: "", las: "", una: "", un: ""
  };

  function norm(s) {
    return String(s).toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ").trim();
  }

  /* "51mm" -> ["51","mm"] ; separa numero y letras pegadas */
  function trocear(t) {
    return norm(t)
      .replace(/(\d)\s*(mm|milimetros|milimetro)\b/g, "$1 mm")
      .replace(/([a-z])(\d)/g, "$1 $2")
      .replace(/(\d)([a-z])/g, "$1 $2")
      .split(" ")
      .map(w => (w in ALIAS ? ALIAS[w] : w))
      .filter(Boolean);
  }

  /* Distancia de edicion acotada: barata y suficiente para una errata */
  function cerca(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return false;
    let f = new Array(b.length + 1);
    for (let j = 0; j <= b.length; j++) f[j] = j;
    for (let i = 1; i <= a.length; i++) {
      let ant = f[0]; f[0] = i; let mejor = f[0];
      for (let j = 1; j <= b.length; j++) {
        const tmp = f[j];
        f[j] = Math.min(f[j] + 1, f[j - 1] + 1,
                        ant + (a[i - 1] === b[j - 1] ? 0 : 1));
        ant = tmp;
        if (f[j] < mejor) mejor = f[j];
      }
      if (mejor > max) return false;
    }
    return f[b.length] <= max;
  }

  function toleraErrata(palabra, heno) {
    if (palabra.length < 4) return false;
    const max = palabra.length >= 7 ? 2 : 1;
    return heno.split(" ").some(w => cerca(palabra, w, max));
  }

  function buscar(t) {
    const bruto = norm(t);
    if (bruto.length < 2) return [];
    const compacto = bruto.replace(/ /g, "");
    const palabras = trocear(t);
    const medida = (palabras.find(w => /^(49|51|53|54|57|58)$/.test(w)) || null);

    return datos
      .map(x => {
        let p = 0;
        // coincidencia por palabras, tolerando erratas
        palabras.forEach(w => {
          if (w === "mm") return;
          if (x._n.includes(w)) p += w.length * 2;
          else if (x._c.includes(w)) p += w.length * 2;   // "delonghi" vs "de longhi"
          else if (toleraErrata(w, x._n)) p += w.length;  // "delongui"
        });
        // la consulta entera, pegada, dentro del modelo pegado
        if (x._c.includes(compacto)) p += compacto.length * 2;
        if (x._n.startsWith(bruto)) p += 14;
        // la medida es una senal fuerte: filtra o premia
        if (medida) {
          if (x.d === Number(medida)) p += 10;
          else if (x.d) p -= 6;
        }
        return { x: x, p: p };
      })
      .filter(r => r.p > 0)
      .sort((a, b) => b.p - a.p || b.x.n - a.x.n)
      .slice(0, 8)
      .map(r => r.x);
  }

  let sel = -1;

  function pintar(res, consulta) {
    sel = -1;
    if (!res.length) {
      const med = (trocear(consulta || "").find(w => /^(49|51|53|54|57|58)$/.test(w)));
      const marca = marcaConocida(consulta || "");
      let html;
      if (marca) {
        // Sabemos la medida aunque no tengamos sus piezas: eso ya es util.
        html = '<li class="vacio"><strong>' + marca.m + ' usa ' + marca.d + '</strong>. ' +
               'Todavía no tenemos su catálogo, pero ya sabes qué medida buscar. ' +
               '<a href="/medidas/">Ver la tabla completa</a> o ' +
               '<a href="/contacto/">pídenos que lo añadamos</a>.</li>';
      } else if (med) {
        html = '<li class="vacio">No encontramos ese modelo. ' +
               '<a href="/medidas/">Mira qué marcas usan ' + med + ' mm</a> ' +
               'o escríbenos y lo añadimos.</li>';
      } else {
        html = '<li class="vacio">No encontramos ese modelo. ' +
               '<a href="/contacto/">Escríbenos</a> y lo añadimos.</li>';
      }
      sug.innerHTML = html;
      sug.hidden = false;
      return;
    }
    sug.innerHTML = res.map((x, i) =>
      '<li role="option" id="sug-' + i + '" aria-selected="false">' +
      '<a href="' + x.u + '"><span>' + x.m + '</span>' +
      '<span class="n">' + (x.d ? x.d + ' mm · ' : '') + x.n + ' piezas</span></a></li>'
    ).join("");
    sug.hidden = false;
  }

  function marcar(i) {
    const items = sug.querySelectorAll("li[role=option]");
    if (!items.length) return;
    sel = (i + items.length) % items.length;
    items.forEach((el, k) => {
      const on = k === sel;
      el.setAttribute("aria-selected", on ? "true" : "false");
      el.classList.toggle("sug--on", on);
    });
    q.setAttribute("aria-activedescendant", "sug-" + sel);
    items[sel].scrollIntoView({ block: "nearest" });
  }

  function ir() {
    const items = sug.querySelectorAll("li[role=option] a");
    const a = sel >= 0 ? items[sel] : items[0];
    if (a) location.href = a.getAttribute("href");
  }

  let t;
  q.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(() => {
      const v = q.value.trim();
      if (v.length < 2) { sug.hidden = true; return; }
      pintar(buscar(v), v);
    }, 110);
  });

  q.addEventListener("keydown", ev => {
    if (ev.key === "Escape") { sug.hidden = true; sel = -1; return; }
    if (ev.key === "ArrowDown") { ev.preventDefault(); marcar(sel + 1); return; }
    if (ev.key === "ArrowUp") { ev.preventDefault(); marcar(sel - 1); return; }
    if (ev.key === "Enter") { ev.preventDefault(); ir(); }
  });

  btn && btn.addEventListener("click", () => {
    const v = q.value.trim();
    if (sug.hidden) pintar(buscar(v), v);
    else ir();
  });

  document.addEventListener("click", ev => {
    if (!sug.contains(ev.target) && ev.target !== q) sug.hidden = true;
  });
})();
