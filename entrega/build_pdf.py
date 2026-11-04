import pathlib, subprocess, html as H, re
root = pathlib.Path(__file__).resolve().parent.parent
ent = root/"entrega"
prompt = (root/"prompt/system-prompt.md").read_text()

def esc(s): return H.escape(s)
def code(s): return "<code>"+esc(s)+"</code>"

# ---- system prompt como en las pre entregas: secciones en mayúsculas, sin "#" ni backticks
pp = []
for l in prompt.replace("`", '"').split("\n"):
    pp.append(l[2:] if l.startswith("# ") else l)
prompt_txt = esc("\n".join(pp).strip())
prompt_txt = re.sub(r"^([A-ZÁÉÍÓÚÑ ()/Y]+)$", r"<b>\1</b>", prompt_txt, flags=re.M)

def box(x,y,w,h,l1,l2,cls):
    w_ = " wt" if cls=="nD" else ""
    t = f'<text x="{x+w/2}" y="{y+h/2-(2 if l2 else -3)}" class="bt{w_}">{l1}</text>'
    if l2: t += f'<text x="{x+w/2}" y="{y+h/2+11}" class="bs{w_}">{l2}</text>'
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="7" class="{cls}"/>'+t
def arrow(x1,y1,x2,y2,dash=False):
    return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" class="ar{" dash" if dash else ""}" marker-end="url(#h)"/>'
DEFS = '<defs><marker id="h" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#555"/></marker></defs>'

svgA = f'''<svg viewBox="0 0 700 170" xmlns="http://www.w3.org/2000/svg">{DEFS}
<rect x="2" y="2" width="696" height="166" rx="10" class="gP"/>
<text x="14" y="20" class="gl">INGESTA · se ejecuta una vez</text>
{box(18,50,116,50,"Manual Trigger","clic en Execute","nG")}
{box(168,50,130,50,"Code","texto del manual","nG")}
{box(332,50,150,50,"Data Loader + Splitter","chunks 500 / solape 80","nB")}
{box(516,50,168,50,"Supabase Vector Store","insert · tabla documents","nO")}
{box(516,112,168,44,"Embeddings Ollama","nomic-embed-text (768)","nB")}
{arrow(134,75,168,75)}{arrow(298,75,332,75)}{arrow(482,75,516,75)}{arrow(600,112,600,100)}
</svg>'''

svgB = f'''<svg viewBox="0 0 700 285" xmlns="http://www.w3.org/2000/svg">{DEFS}
<rect x="3" y="3" width="140" height="279" rx="10" class="gP"/>
<rect x="153" y="3" width="402" height="279" rx="10" class="gQ"/>
<rect x="565" y="3" width="132" height="279" rx="10" class="gG"/>
<text x="73" y="21" class="gl" text-anchor="middle">ORIGEN</text>
<text x="354" y="21" class="gl" text-anchor="middle">TRANSFORMACIÓN</text>
<text x="631" y="21" class="gl" text-anchor="middle">DESTINO</text>
{box(13,82,120,52,"Webhook","POST /butaca-consulta","nG")}
{box(173,82,130,52,"AI Agent","responder consulta","nO")}
{box(405,82,140,52,"Code","detectar derivación","nG")}
{box(575,82,112,52,"Respond","to Webhook","nD")}
{box(160,168,86,44,"Ollama","llama3.1:8b","nB")}
{box(256,168,92,44,"Memoria","Session ID = número","nB")}
{box(358,168,106,44,"manual_butaca","Supabase · top 4","nO")}
{box(358,226,106,40,"Embeddings","nomic-embed-text","nB")}
{arrow(133,108,173,108)}{arrow(303,108,405,108)}{arrow(545,108,575,108)}
{arrow(203,168,225,134)}{arrow(302,168,240,134)}{arrow(390,168,265,134,True)}{arrow(411,226,411,212)}
<text x="354" y="153" class="bs" text-anchor="middle" fill="#666"> </text>
</svg>'''

def fig(name, cap, w):
    return f'<figure style="width:{w}%"><img src="capturas/{name}"><figcaption>{cap}</figcaption></figure>'

CSS = '''
@page { size: A4; }
*{box-sizing:border-box}
body{font-family:"Segoe UI",Inter,"Liberation Sans",Arial,sans-serif;font-size:10.3pt;line-height:1.5;color:#222;margin:0}
code{font-family:Consolas,"DejaVu Sans Mono",monospace;font-size:8.8pt;background:#f0f3f6;border-radius:3px;padding:0 3px}
h1{font-size:25pt;line-height:1.15;margin:0 0 4px;color:#1f4e79}
.sub{color:#2e75b6;font-size:12.5pt;line-height:1.3;margin:0 0 6px}
.by{color:#666;font-size:9pt;margin:0 0 4px;padding-bottom:9px;border-bottom:2px solid #1f4e79}
h2{font-size:14pt;color:#1f4e79;margin:20px 0 8px;padding-bottom:3px;border-bottom:1px solid #d8dde3;break-after:avoid}
h3{font-size:10.8pt;color:#1f4e79;margin:12px 0 4px;break-after:avoid}
p{margin:0 0 7px} ul{margin:4px 0 8px;padding-left:20px} li{margin-bottom:4px}
.cards{display:flex;gap:10px;margin:8px 0 10px;break-inside:avoid}
.card{flex:1;background:#f3f8fd;border:1px solid #cfe0f1;border-radius:7px;padding:8px 11px;font-size:9pt;line-height:1.4}
.card b.t{display:block;color:#1f4e79;font-size:9.6pt;margin-bottom:3px}
.card ul{padding-left:16px;margin:2px 0}
table{border-collapse:collapse;width:100%;font-size:9pt;margin:6px 0 10px;break-inside:auto}
tr{break-inside:avoid}
th{background:#154c79;color:#fff;text-align:left;padding:6px 9px;font-weight:600}
td{border:1px solid #d6dce2;padding:5px 9px;vertical-align:top}
pre{background:#f6f8fa;border:1px solid #e1e4e8;border-radius:6px;padding:10px 13px;font-family:Consolas,"DejaVu Sans Mono",monospace;font-size:7.9pt;line-height:1.42;white-space:pre-wrap;margin:6px 0 8px}
figure{margin:8px auto 12px;text-align:center;break-inside:avoid}
figure img{max-width:100%;border:1px solid #cfd6dd;border-radius:6px}
figcaption{color:#666;font-size:8.6pt;margin-top:4px}
svg{width:100%;height:auto;display:block;margin:4px 0 2px}
svg text{font-family:"Segoe UI",Inter,Arial,sans-serif}
.bt{font-size:11.5px;font-weight:700;text-anchor:middle;fill:#1b1b1b}.bs{font-size:9.3px;text-anchor:middle;fill:#555}
.gl{font-size:10.5px;font-weight:700;fill:#1f4e79;letter-spacing:.6px}
.gP{fill:#eef4fb;stroke:#cfe0f1}.gQ{fill:#fbfaff;stroke:#d9d2ee}.gG{fill:#eef8f1;stroke:#cfe6d6}
.nG{fill:#fff;stroke:#3a8a4f;stroke-width:1.6}.nB{fill:#fff;stroke:#3b6fd4;stroke-width:1.6}
.nO{fill:#fff;stroke:#8a4fc0;stroke-width:1.8}.nD{fill:#2e7d4f;stroke:#2e7d4f}
.wt{fill:#fff !important}
.ar{stroke:#555;stroke-width:1.4;fill:none}.ar.dash{stroke-dasharray:4 3}
.note{color:#666;font-size:9pt}
'''

doc = f'''<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Pre entrega 4</title><style>{CSS}</style></head><body>
<h1>Pre entrega 4</h1>
<div class="sub">AI Agent con RAG: primer filtro de consultas de la butaca comercial</div>
<div class="by">Nicolás Milano · 04/11/2026</div>

<h2>1. Caso de uso</h2>
<p>Continúa las pre entregas anteriores. A la butaca comercial de la financiera los clientes le escriben por WhatsApp con consultas que se repiten: ¿puedo sacar un crédito?, ¿cobraron mi cuota?, ¿me informan mi estado de cuenta?, ¿ya me liquidaron el préstamo? El agente es el <b>primer filtro</b>: responde con el manual de la butaca lo que figura en él (requisitos, montos, plazo, circuito, estados y horarios) y deriva a un analista las consultas que dependen del sistema, las que implican una decisión de crédito y los reclamos.</p>
<ul>
<li><b>Trigger:</b> Webhook {code("POST /butaca-consulta")} que recibe {code('{"numero": "...", "mensaje": "..."}')} y simula la integración de WhatsApp.</li>
<li><b>Mensajes que recibe:</b> cortos e informales, de lunes a viernes de 8 a 18 h. Pueden traer un DNI o a un cliente molesto por un débito.</li>
<li><b>Modelo y datos:</b> Ollama local ({code("llama3.1:8b")} y {code("nomic-embed-text")}) y Supabase como Vector Store, con un manual de la butaca como documento base.</li>
<li><b>Memoria:</b> Session ID = número del remitente.</li></ul>

<h2>2. Decisión de infraestructura: modelo local (Ollama)</h2>
<p><b>Elección:</b> modelo local con Ollama. Chat: {code("llama3.1:8b")}. Embeddings: {code("nomic-embed-text")} (768 dimensiones). Vector Store: Supabase.</p>
<p>El 8B cuantizado ocupa unos 5 GB y corre en un equipo con 16 GB de RAM, que es el que se usó para este prototipo. Soporta español y herramientas, que el AI Agent necesita para usar el retriever. Para un manual corto y preguntas acotadas alcanza; un modelo mayor sería sobredimensionado. Si el equipo tuviera menos de 16 GB de RAM, la alternativa es {code("llama3.2:3b")}, con menor calidad de redacción.</p>
<ul>
<li><b>Privacidad.</b> La butaca maneja información financiera de clientes: DNI, situación en el BCRA, estado de cuenta. Los mensajes de WhatsApp van a incluir DNI y datos de deudas, que son datos personales protegidos por la Ley 25.326, y la política de la butaca solo permite informar lo que corresponde al DNI consultado. Con Ollama esos mensajes no salen de la infraestructura de la empresa; con una API en la nube cada consulta viajaría a un tercero.</li>
<li><b>Costos operativos.</b> En la nube se paga por token, y el agente reenvía en cada mensaje el system prompt, el historial y los fragmentos recuperados, por lo que cada consulta consume bastantes tokens y el costo crece con cada cliente que escribe. El local tiene un costo fijo (equipo y electricidad) que no depende de la cantidad de mensajes.</li>
<li><b>Latencia.</b> El objetivo es responder en unos 10 minutos como máximo. En las pruebas del prototipo (equipo con 16 GB de RAM) la respuesta tardó entre 10 y 15 segundos, muy por debajo de ese margen y sin depender de la red ni de la disponibilidad del proveedor.</li>
<li><b>Independencia.</b> El servicio no depende de cambios de precio, límites de uso ni deprecación de modelos de un proveedor externo.</li></ul>
<p><b>Trade-off asumido:</b> un modelo de 8B razona peor que uno grande de la nube. Se compensa con un prompt estricto, temperatura baja (0,2) y la regla de que, si el manual no tiene el dato, el agente deriva a un analista en lugar de inventar.</p>

<h2>3. Pipeline de ingesta y recuperación</h2>
<p>Documento base: {code("manual-butaca-comercial.md")} (productos, montos, plazo, requisitos, categorías, circuito, estados, horarios y privacidad; datos ficticios). Se guarda en la tabla {code("documents")} de Supabase, con una columna {code("vector(768)")} para los embeddings.</p>
<h3>Flujo A · Ingesta (se ejecuta una vez)</h3>
{svgA}
<h3>Flujo B · Consulta (cada mensaje)</h3>
{svgB}
<p class="note" style="text-align:center">Camino del dato: el mensaje entra por el Webhook, el AI Agent consulta el manual en Supabase y arma la respuesta, el nodo Code decide si hay que derivar y Respond to Webhook devuelve el JSON.</p>
<div class="cards">
<div class="card"><b class="t">Entrada</b><ul><li><b>Disparador:</b> Webhook POST.</li><li><b>Qué trae:</b> {code("numero")} del remitente y {code("mensaje")} del cliente.</li></ul></div>
<div class="card"><b class="t">Proceso</b><ul><li>Recuperar los 4 fragmentos más parecidos del manual.</li><li>Redactar la respuesta solo con ese contexto.</li><li>Recordar la conversación por número.</li><li>Decidir si deriva y con qué prioridad.</li></ul></div>
<div class="card"><b class="t">Salida</b><ul><li>JSON con {code("numero")}, {code("respuesta")}, {code("derivar")} y {code("prioridad")}.</li><li>Devuelto por Respond to Webhook.</li></ul></div>
</div>
<h3 style="break-before:page">Qué entra y qué sale de cada nodo</h3>
<table><tr><th style="width:23%">Nodo</th><th style="width:33%">Entra</th><th>Sale</th></tr>
<tr><td>Manual: ejecutar ingesta</td><td>Clic en «Execute workflow» (una sola vez)</td><td>Un ítem vacío que dispara la carga</td></tr>
<tr><td>Code: texto del manual</td><td>El ítem del disparador</td><td>Un ítem con el campo {code("texto")}: el manual completo</td></tr>
<tr><td>Data Loader + Splitter</td><td>{code("{{ $json.texto }}")}</td><td>8 fragmentos de hasta 500 caracteres (solape de 80) con el metadato «fuente»</td></tr>
<tr><td>Embeddings Ollama + Supabase</td><td>Cada fragmento</td><td>Un vector de 768 números por fragmento, guardado en {code("documents")}</td></tr>
<tr><td>Webhook: consulta nueva</td><td>POST con {code('{"numero":"5491155550000","mensaje":"..."}')}</td><td>El mismo dato dentro de {code("body")}, más headers y metadatos</td></tr>
<tr><td>AI Agent: responder consulta</td><td>{code("{{ $json.body.mensaje }}")}, la memoria de esa sesión y el system prompt</td><td>Respuesta de texto, tras consultar {code("manual_butaca")}</td></tr>
<tr><td>Code: detectar derivación</td><td>Respuesta del agente y mensaje original</td><td>JSON con numero, respuesta, derivar (true/false) y prioridad (NORMAL/ALTA)</td></tr>
<tr><td>Responder: respuesta al cliente</td><td>El JSON anterior</td><td>Devuelve la respuesta al sistema que envió el mensaje</td></tr></table>
<p><b>Recepción y envío:</b> el nodo <b>Webhook</b> recibe el mensaje del cliente (en producción lo enviaría la integración de WhatsApp; en la práctica se simula con una llamada POST) y el nodo <b>Respond to Webhook</b> devuelve la respuesta, que el sistema de mensajería reenvía al cliente.</p>
<p><b>Memoria:</b> Simple Memory con <b>Session ID = número del remitente</b> ({code("{{ $json.body.numero }}")}) y una ventana de 6 mensajes, para que el agente recuerde lo que ese mismo cliente ya dijo, por ejemplo su DNI.</p>
<p><b>Prioridad:</b> el nodo Code marca prioridad ALTA con reglas fijas (palabras como «débito» o «reclamo») y no con el modelo, porque un cliente molesto por más de un débito es el caso más importante y no conviene depender de que un 8B lo detecte.</p>
<p><b>Carga del manual:</b> el texto del manual se incluye en un nodo Code en lugar de leer un archivo del disco, para que el flujo no dependa de rutas ni de permisos del equipo y se pueda importar en cualquier n8n.</p>

<h2>4. Nodo del LLM conectado al retriever</h2>
<table><tr><th style="width:28%">Componente</th><th>Configuración</th></tr>
<tr><td>Modelo de chat</td><td>Ollama Chat Model, {code("llama3.1:8b")}, temperatura 0,2</td></tr>
<tr><td>Memoria</td><td>Simple Memory, clave de sesión personalizada {code("body.numero")}, ventana de 6 mensajes</td></tr>
<tr><td>Retriever</td><td>Supabase Vector Store en modo <i>Retrieve Documents (As Tool for AI Agent)</i>, herramienta {code("manual_butaca")}, tabla {code("documents")}, límite 4</td></tr>
<tr><td>Embeddings de consulta</td><td>Ollama {code("nomic-embed-text")}, el mismo modelo de la ingesta</td></tr>
<tr><td>Texto de entrada</td><td>{code("{{ $json.body.mensaje }}")}</td></tr></table>
<p>Es obligatorio usar el mismo modelo de embeddings en la ingesta y en la consulta; si no, los vectores no son comparables y las búsquedas no encuentran nada. El system prompt le ordena consultar siempre la herramienta antes de responder y no inventar si no encuentra nada, de modo que las respuestas se basan exclusivamente en el manual cargado.</p>

<h2>5. System prompt del agente</h2>
<pre>{prompt_txt}</pre>
<p>El mensaje de usuario que arma n8n es el texto del cliente ({code("{{ $json.body.mensaje }}")}).</p>

<h2>6. Workflow en n8n</h2>
<h3>Ingesta del manual</h3>
{fig("01-ingesta-flujo.png","Flujo de ingesta después de una ejecución: el manual se divide en 8 fragmentos que se guardan en Supabase.",62)}
{fig("02-supabase-tabla.png","Tabla documents en Supabase: 8 filas, cada una con el texto del fragmento, su metadato y su vector (embedding).",90)}
<h3>Prueba de ejecución 1: consulta de requisitos</h3>
<p>Mensaje de prueba: {code('{"numero":"5491155550000","mensaje":"¿Qué requisitos necesito para un crédito?"}')}</p>
{fig("03-agente-flujo.png","Canvas completo después de una ejecución exitosa. El AI Agent usó el modelo Ollama, la memoria (Session ID = número) y la herramienta manual_butaca (4 fragmentos recuperados).",78)}
{fig("04-agente-respuesta.png","Respuesta recibida (PowerShell): requisitos tomados del manual. derivar = False, prioridad = NORMAL.",80)}
<p><b>Resultado visible:</b> el agente no inventó datos: respondió con los requisitos del manual (situación laboral ANSES y hasta 2 deudas en el BCRA) y aclaró que la aprobación final la define un analista.</p>
<h3>Prueba de ejecución 2: reclamo (escalado a un analista)</h3>
<p>Mensaje de prueba: «Me debitaron dos veces la cuota y estoy muy molesto». Un cliente molesto por más de un débito es el caso de máxima prioridad.</p>
{fig("05-reclamo-flujo.png","Flujo ejecutado con el mensaje de reclamo.",72)}
{fig("06-reclamo-respuesta.png","El agente deriva: «Te paso con un analista de la butaca». derivar = True, prioridad = ALTA.",62)}

<h2>7. Reflexión: escalabilidad (x10 mensajes)</h2>
<p>La decisión se sostiene en privacidad, pero la infraestructura local tendría que crecer: un solo Ollama atiende pocas consultas en paralelo y, con 10 veces más mensajes, la demora aumentaría por encolamiento en los picos. Cambiaría: (1) una GPU dedicada o un segundo servidor Ollama con balanceo y n8n en modo cola; (2) respuestas fijas o en caché para las preguntas más repetidas (requisitos, horarios), sin pasar por el modelo; (3) un esquema híbrido, con el local para todo lo que lleve DNI o datos de cuenta y la nube solo para picos con mensajes anonimizados. El hardware es un gasto fijo que se amortiza al crecer el volumen, mientras que en la nube el costo se multiplicaría junto con los tokens.</p>

<h2>8. Límites y mejora futura</h2>
<ul>
<li>El agente <b>no tiene acceso al sistema</b>: no puede decir si se cobró una cuota ni informar un estado de cuenta; toma el DNI y deriva a un analista. Una mejora sería una herramienta que consulte el sistema solo por el DNI consultado.</li>
<li>La derivación hoy devuelve {code("derivar: true")} en el JSON; en producción debería avisar a un analista (por Teams o mail).</li>
<li>Hoy WhatsApp no es viable con la app básica; en producción requiere WhatsApp Business con API.</li></ul>
<p class="note">Los datos del manual y de las pruebas son ficticios y están armados a partir del proceso real de la butaca.</p>
</body></html>'''
(ent/"pre-entrega-4.html").write_text(doc, encoding="utf-8")
subprocess.run(["node", str(ent/"print_pdf.js"), str(ent/"pre-entrega-4.html"), str(ent/"Pre-entrega-4-RAG-Butaca.pdf")], check=True)
