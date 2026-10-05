// PRESI – La Previa. Juego en un solo dispositivo que se pasa entre la mesa.
(function () {
  const $app = document.getElementById("app");
  const $barra = document.getElementById("barra");
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const azar = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const barajar = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  let timerId = null;
  const limpiarTimer = () => { if (timerId) { clearInterval(timerId); timerId = null; } };

  // ---------- Estado ----------
  const config = { jugadores: [{ nombre: "", nivel: "fan" }, { nombre: "", nivel: "fan" }], hayMenores: true, rondas: 10 };
  let g = null; // partida en curso

  function mazo(lista, edadOk) {
    return barajar(lista.filter((c) => edadOk || c.edad === "todos"));
  }
  function sacar(clave) {
    if (!g.mazos[clave].length) g.mazos[clave] = mazo(CARTAS[clave], g.adultos);
    return g.mazos[clave].pop();
  }

  function nuevaPartida() {
    const adultos = !config.hayMenores; // regla: si hay algún menor, se usa siempre el mazo apto
    g = {
      adultos,
      rondas: config.rondas,
      ronda: 0,
      turno: -1,
      ultimoTipo: null,
      jugadores: config.jugadores.map((j, i) => ({ nombre: j.nombre.trim() || "Jugador " + (i + 1), nivel: j.nivel, pts: 0, comodin: j.nivel === "sillon" })),
      mazos: { votos: [], retos: [], trivia: [], sillon: [], penitencias: [] }
    };
    siguienteRonda();
  }

  // ---------- Barra superior ----------
  function pintarBarra() {
    if (!g) { $barra.hidden = true; return; }
    $barra.hidden = false;
    const actual = g.turno >= 0 ? g.turno : -1;
    $barra.innerHTML = `<div class="barra-top"><span>Ronda ${Math.min(g.ronda, g.rondas)}/${g.rondas}</span><span>${g.adultos ? "🔴 Veteranos" : "🟢 Pibes"}</span></div>
      <div class="chips">${g.jugadores.map((j, i) => `<span class="chip ${i === actual ? "activo" : ""}">${esc(j.nombre)} · ${j.pts}</span>`).join("")}</div>`;
  }
  function pantalla(html) { limpiarTimer(); pintarBarra(); $app.innerHTML = html; window.scrollTo(0, 0); }

  // ---------- Pantalla inicial ----------
  function verSetup() {
    g = null;
    pantalla(`
      <h1>PRE<span>SI</span></h1>
      <p class="sub">La Previa · el calentamiento antes de la temporada</p>
      <div class="card">
        <h2>Jugadores</h2>
        <p class="suave">⚽ Fanático: sabe de fútbol · 🛋️ Sillón: juega igual, con pistas y un comodín.</p>
        <div class="grid" id="lista"></div>
        <div style="height:10px"></div>
        <button class="sec" id="mas">+ Agregar jugador</button>
      </div>
      <div class="card">
        <h2>¿Hay alguien menor de 18 en la mesa?</h2>
        <p class="suave">Si hay un solo menor se usa el mazo apto para todos.</p>
        <div class="seg" id="edad"><button data-v="1">Sí, hay menores</button><button data-v="0">No, todos +18</button></div>
      </div>
      <div class="card">
        <h2>Rondas</h2>
        <div class="seg" id="rondas"><button data-v="6">Rápida (6)</button><button data-v="10">Normal (10)</button><button data-v="15">Larga (15)</button></div>
      </div>
      <button id="jugar">¡A jugar!</button>`);
    pintarLista();
    marcar("#edad", config.hayMenores ? "1" : "0");
    marcar("#rondas", String(config.rondas));
    document.getElementById("mas").onclick = () => { if (config.jugadores.length < 8) { guardarNombres(); config.jugadores.push({ nombre: "", nivel: "fan" }); pintarLista(); } };
    document.getElementById("edad").onclick = (e) => { if (e.target.dataset.v) { config.hayMenores = e.target.dataset.v === "1"; marcar("#edad", e.target.dataset.v); } };
    document.getElementById("rondas").onclick = (e) => { if (e.target.dataset.v) { config.rondas = +e.target.dataset.v; marcar("#rondas", e.target.dataset.v); } };
    document.getElementById("jugar").onclick = () => { guardarNombres(); nuevaPartida(); };
  }
  function marcar(sel, v) { document.querySelectorAll(sel + " button").forEach((b) => b.classList.toggle("on", b.dataset.v === v)); }
  function guardarNombres() { document.querySelectorAll("#lista input").forEach((inp, i) => { config.jugadores[i].nombre = inp.value; }); }
  function pintarLista() {
    const $l = document.getElementById("lista");
    $l.innerHTML = config.jugadores.map((j, i) => `<div class="jugador-fila">
      <input type="text" maxlength="14" placeholder="Jugador ${i + 1}" value="${esc(j.nombre)}">
      <button class="sec nivel" data-i="${i}">${j.nivel === "fan" ? "⚽ Fanático" : "🛋️ Sillón"}</button>
      ${config.jugadores.length > 2 ? `<button class="sec x" data-x="${i}">✕</button>` : ""}</div>`).join("");
    $l.onclick = (e) => {
      const b = e.target.closest("button"); if (!b) return;
      guardarNombres();
      if (b.dataset.i !== undefined) { const j = config.jugadores[+b.dataset.i]; j.nivel = j.nivel === "fan" ? "sillon" : "fan"; }
      if (b.dataset.x !== undefined) config.jugadores.splice(+b.dataset.x, 1);
      pintarLista();
    };
  }

  // ---------- Rondas ----------
  function siguienteRonda() {
    if (g.ronda >= g.rondas) return verFinal();
    g.ronda++;
    g.turno = (g.turno + 1) % g.jugadores.length;
    const tipos = ["votos", "trivia", "retos", "duelo"].filter((t) => t !== g.ultimoTipo);
    let tipo = azar(tipos);
    g.ultimoTipo = tipo;
    if (tipo === "votos") return rondaVoto();
    if (tipo === "trivia") return rondaTrivia();
    if (tipo === "retos") return rondaReto();
    return rondaDuelo();
  }
  const botonSiguiente = (txt) => `<button id="sig">${txt || "Siguiente ronda ➜"}</button>`;
  function conSiguiente() { document.getElementById("sig").onclick = siguienteRonda; }

  // --- Votación ---
  function rondaVoto() {
    const c = sacar("votos");
    const honor = c.modo === "honor";
    pantalla(`
      <div class="card grande">
        <span class="etiqueta ${honor ? "oro" : "rojo"}">${honor ? "Votación · premio" : "Votación · castigo"}</span>
        <p class="texto-grande">${esc(c.texto)}</p>
        <p class="suave">A la cuenta de tres, todos señalan a la vez. Después tocá al más señalado.</p>
      </div>
      <div class="grid" id="quien">${g.jugadores.map((j, i) => `<button class="sec" data-i="${i}">${esc(j.nombre)}</button>`).join("")}</div>`);
    document.getElementById("quien").onclick = (e) => {
      const b = e.target.closest("button"); if (!b) return;
      const j = g.jugadores[+b.dataset.i];
      if (honor) { j.pts += 2; pantalla(`<div class="big-emoji">🏆</div><div class="card grande"><p class="texto-grande">${esc(j.nombre)} se lleva +2 Hinchas</p><p class="suave">La mesa lo eligió.</p></div>${botonSiguiente()}`); conSiguiente(); }
      else penitencia(j, "La mesa te eligió");
    };
  }

  // --- Trivia ---
  function rondaTrivia() {
    const j = g.jugadores[g.turno];
    const c = j.nivel === "fan" ? sacar("trivia") : sacar("sillon");
    let idx = c.o.map((_, i) => i);
    pantalla(`
      <div class="card grande">
        <span class="etiqueta">${j.nivel === "fan" ? "⚽ Trivia" : "🛋️ Pregunta con pista"}</span>
        <p class="suave">Le toca a <b>${esc(j.nombre)}</b></p>
        <p class="texto-grande">${esc(c.p)}</p>
      </div>
      <div class="grid" id="ops"></div>
      ${j.comodin ? `<button class="sec" id="com">🧓 Comodín del Tío: sacar una opción incorrecta</button>` : ""}`);
    const $ops = document.getElementById("ops");
    const pintar = () => { $ops.innerHTML = idx.map((i) => `<button class="opcion" data-i="${i}">${esc(c.o[i])}</button>`).join(""); };
    pintar();
    const com = document.getElementById("com");
    if (com) com.onclick = () => {
      const malas = idx.filter((i) => i !== c.c);
      idx = [c.c, azar(malas)].sort((a, b) => a - b); // deja la correcta y una incorrecta
      j.comodin = false; com.remove(); pintar();
    };
    $ops.onclick = (e) => {
      const b = e.target.closest("button"); if (!b) return;
      const ok = +b.dataset.i === c.c;
      $ops.querySelectorAll("button").forEach((x) => { x.disabled = true; if (+x.dataset.i === c.c) x.classList.add("bien"); });
      if (!ok) b.classList.add("error");
      if (com) com.remove();
      if (ok) { j.pts += 2; $app.insertAdjacentHTML("beforeend", `<div class="card grande"><p class="texto-grande">✅ ¡Correcto! +2 Hinchas</p></div>${botonSiguiente()}`); conSiguiente(); pintarBarra(); }
      else { $app.insertAdjacentHTML("beforeend", `<div class="card grande"><p class="texto-grande">❌ Uy… era "${esc(c.o[c.c])}"</p></div><button id="pen" class="mal">Cumplir penitencia</button>`); document.getElementById("pen").onclick = () => penitencia(j, "Fallaste la pregunta"); }
    };
  }

  // --- Reto ---
  function rondaReto() {
    const j = g.jugadores[g.turno];
    const c = sacar("retos");
    pantalla(`
      <div class="card grande">
        <span class="etiqueta oro">Reto · ${esc(c.titulo)}</span>
        <p class="suave">Le toca a <b>${esc(j.nombre)}</b></p>
        <p class="texto-grande">${esc(c.texto)}</p>
        <p class="suave">Tiempo: ${c.seg} segundos</p>
      </div>
      <button id="go">▶ Empezar</button>`);
    document.getElementById("go").onclick = () => {
      let t = c.seg;
      pantalla(`<div class="card grande"><span class="etiqueta oro">${esc(c.titulo)}</span><p class="texto-grande">${esc(j.nombre)}</p><div class="timer" id="t">${t}</div><p class="suave">${esc(c.texto)}</p></div><button class="sec" id="fin">Ya terminé</button>`);
      const $t = document.getElementById("t");
      const terminar = () => { limpiarTimer(); juzgar(); };
      timerId = setInterval(() => { t--; $t.textContent = Math.max(t, 0); if (t <= 0) { $t.classList.add("fin"); terminar(); } }, 1000);
      document.getElementById("fin").onclick = terminar;
    };
    function juzgar() {
      pantalla(`<div class="card grande"><p class="texto-grande">La mesa decide: ¿${esc(j.nombre)} la rompió?</p></div>
        <div class="fila"><button class="ok" id="si">👏 Sí (+2)</button><button class="mal" id="no">👎 No</button></div>`);
      document.getElementById("si").onclick = () => { j.pts += 2; pantalla(`<div class="big-emoji">🔥</div><div class="card grande"><p class="texto-grande">${esc(j.nombre)}: +2 Hinchas</p></div>${botonSiguiente()}`); conSiguiente(); };
      document.getElementById("no").onclick = () => penitencia(j, "No convenciste a la mesa");
    }
  }

  // --- Duelo de DT (elección secreta pasando el dispositivo) ---
  function rondaDuelo() {
    const orden = barajar(g.jugadores.map((_, i) => i));
    const a = g.jugadores[orden[0]], b = g.jugadores[orden[1]];
    pantalla(`
      <div class="card grande">
        <span class="etiqueta">Duelo de DT</span>
        <p class="texto-grande">${esc(a.nombre)} 🆚 ${esc(b.nombre)}</p>
        <p class="suave">Cada uno elige su táctica en secreto. Garra le gana al Toque, Toque al Pelotazo, Pelotazo a la Garra.</p>
      </div>${botonSiguiente("Empezar duelo ➜")}`);
    document.getElementById("sig").onclick = () => elegir(a, null);
    function elegir(quien, primera) {
      const esPrimero = primera === null;
      pantalla(`
        <div class="card grande"><span class="etiqueta rojo">Secreto</span><p class="texto-grande">${esc(quien.nombre)}, elegí tu táctica</p>
        <p class="suave">${esPrimero ? "El rival no puede mirar 👀" : "Ya eligió el rival"}</p></div>
        <div class="grid" id="tac">${TACTICAS.map((t) => `<button class="sec tactica" data-id="${t.id}">${t.emoji} ${t.nombre}</button>`).join("")}</div>`);
      document.getElementById("tac").onclick = (e) => {
        const bt = e.target.closest("button"); if (!bt) return;
        if (esPrimero) {
          pantalla(`<div class="pantalla-oculta card"><div class="big-emoji">🙈</div><p class="texto-grande">Elección guardada</p><p class="suave">Pasale el dispositivo a ${esc(b.nombre)}</p></div><button id="ya">Ya se lo pasé</button>`);
          document.getElementById("ya").onclick = () => elegir(b, bt.dataset.id);
        } else resolver(primera, bt.dataset.id);
      };
    }
    function resolver(ta, tb) {
      const A = TACTICAS.find((t) => t.id === ta), B = TACTICAS.find((t) => t.id === tb);
      let msg, ganador = null;
      if (ta === tb) msg = "Empate: se anularon. +1 para cada uno.";
      else if (A.gana === tb) { ganador = a; msg = `${A.txt}. ¡Gana ${a.nombre}! +2`; }
      else { ganador = b; msg = `${B.txt}. ¡Gana ${b.nombre}! +2`; }
      if (ganador) ganador.pts += 2; else { a.pts++; b.pts++; }
      pantalla(`<div class="card grande"><p class="texto-grande">${esc(a.nombre)} eligió ${A.emoji} ${A.nombre}</p><p class="texto-grande">${esc(b.nombre)} eligió ${B.emoji} ${B.nombre}</p></div>
        <div class="card grande"><p class="texto-grande">${esc(msg)}</p></div>${botonSiguiente()}`);
      conSiguiente();
    }
  }

  // --- Penitencia ---
  function penitencia(j, motivo) {
    const c = sacar("penitencias");
    pantalla(`<div class="big-emoji">😈</div>
      <div class="card grande"><span class="etiqueta rojo">Penitencia</span><p class="suave">${esc(motivo)}</p><p class="texto-grande">${esc(j.nombre)}:</p><p class="texto-grande">${esc(c.texto)}</p></div>
      ${botonSiguiente("Cumplida ✔ Siguiente ➜")}`);
    conSiguiente();
  }

  // ---------- Final ----------
  function verFinal() {
    g.turno = -1;
    const orden = g.jugadores.slice().sort((x, y) => y.pts - x.pts);
    const min = orden[orden.length - 1].pts;
    const ultimos = orden.filter((j) => j.pts === min && orden.length > 1 && min !== orden[0].pts);
    const campeones = orden.filter((j) => j.pts === orden[0].pts);
    pantalla(`
      <div class="podio">🏆</div>
      <div class="card grande"><span class="etiqueta oro">Campeón de la Previa</span>
        <p class="texto-grande">${campeones.map((j) => esc(j.nombre)).join(" y ")}</p>
        <p class="suave">Arranca la Temporada con ventaja (+1 Contactos).</p></div>
      <div class="card"><table class="tabla">${orden.map((j, i) => `<tr><td>${orden.findIndex((x) => x.pts === j.pts) + 1}°</td><td>${esc(j.nombre)}</td><td>${j.pts}</td></tr>`).join("")}</table></div>
      ${ultimos.length ? `<button class="mal" id="pen">😈 Penitencia final para ${ultimos.map((j) => esc(j.nombre)).join(" y ")}</button>` : ""}
      <button id="otra">Jugar otra</button><button class="sec" id="menu">Cambiar jugadores</button>`);
    if (ultimos.length) document.getElementById("pen").onclick = () => {
      const c = sacar("penitencias");
      pantalla(`<div class="big-emoji">😈</div><div class="card grande"><span class="etiqueta rojo">Penitencia final</span><p class="texto-grande">${ultimos.map((j) => esc(j.nombre)).join(" y ")}:</p><p class="texto-grande">${esc(c.texto)}</p><p class="suave">La mesa puede cambiarla por otra de la lista si no se banca esta.</p></div><button id="v">Volver</button>`);
      document.getElementById("v").onclick = verFinal;
    };
    document.getElementById("otra").onclick = nuevaPartida;
    document.getElementById("menu").onclick = verSetup;
  }

  verSetup();
})();
