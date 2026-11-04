import pathlib, math
from xml.sax.saxutils import escape
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Flowable
root = pathlib.Path(__file__).resolve().parent.parent
prompt = (root/"prompt/system-prompt.md").read_text()
ss = getSampleStyleSheet()
B = ParagraphStyle("b", parent=ss["BodyText"], fontSize=10.5, leading=15, spaceAfter=6)
SM = ParagraphStyle("sm", parent=B, fontSize=9, leading=12, spaceAfter=0)
H1 = ParagraphStyle("h1", parent=ss["Heading1"], fontSize=15, spaceBefore=10, textColor=colors.HexColor("#1f4e79"))
T = ParagraphStyle("t", parent=ss["Title"], fontSize=20, spaceAfter=4)
C = ParagraphStyle("c", parent=B, fontName="Courier", fontSize=8, leading=10.5, spaceAfter=0)
def P(t): return Paragraph(t, B)
def bl(items): return [Paragraph("• "+i, B) for i in items]
def tbl(rows, widths):
    t = Table([[Paragraph(c, SM) for c in r] for r in rows], colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([("GRID",(0,0),(-1,-1),0.5,colors.grey),("BACKGROUND",(0,0),(-1,0),colors.HexColor("#d9e2f3")),("VALIGN",(0,0),(-1,-1),"TOP")]))
    return t

class Flow(Flowable):
    def __init__(s, h=9*cm): super().__init__(); s.width=17*cm; s.height=h
    def box(s,c,x,y,w,h,t,fill):
        c.setFillColor(fill); c.setStrokeColor(colors.HexColor("#444")); c.roundRect(x,y,w,h,5,fill=1)
        c.setFillColor(colors.black); c.setFont("Helvetica",7.5); ls=t.split("\n")
        for i,l in enumerate(ls): c.drawCentredString(x+w/2,y+h/2+(len(ls)-1)*4.5-i*9-2.5,l)
    def arrow(s,c,x1,y1,x2,y2):
        c.setStrokeColor(colors.HexColor("#444")); c.line(x1,y1,x2,y2); a=math.atan2(y2-y1,x2-x1)
        for d in (0.35,-0.35): c.line(x2,y2,x2-6*math.cos(a-d),y2-6*math.sin(a-d))
    def draw(s):
        c=s.canv; g=colors.HexColor("#d9ead3"); b=colors.HexColor("#cfe2f3"); o=colors.HexColor("#fce5cd")
        c.setFont("Helvetica-Bold",9); c.drawString(0,s.height-10,"A) INGESTA (una vez, o cuando cambia el manual)")
        y=s.height-52; w=88; h=34; xs=[0,110,220,330]
        for x,t,f in zip(xs,["Manual Trigger","Code\ntexto del manual","Splitter 500/80\n+ Data Loader","Supabase\nVector Store"],[g,g,b,o]): s.box(c,x,y,w,h,t,f)
        for i in range(3): s.arrow(c,xs[i]+w,y+h/2,xs[i+1],y+h/2)
        s.box(c,330,y-46,w,30,"Embeddings Ollama\nnomic-embed-text",b); s.arrow(c,374,y-16,374,y)
        c.setFont("Helvetica-Bold",9); c.drawString(0,s.height-128,"B) AGENTE RAG (cada mensaje de WhatsApp)")
        y=s.height-172; xs=[0,100,200,300]
        for x,t,f in zip(xs,["Webhook POST\n{numero, mensaje}","AI Agent\n(system prompt)","Detectar\nderivación","Respond to\nWebhook"],[g,o,g,g]): s.box(c,x,y,88,34,t,f)
        for x in xs[:3]: s.arrow(c,x+88,y+17,x+100,y+17)
        s.box(c,0,y-62,88,32,"Ollama Chat\nllama3.1:8b",b); s.box(c,100,y-62,88,32,"Memoria\nSession = numero",b); s.box(c,200,y-62,100,32,"Tool retriever\nSupabase (top 4)",o)
        s.arrow(c,44,y-30,120,y); s.arrow(c,144,y-30,144,y); s.arrow(c,230,y-30,168,y)
        s.box(c,200,y-108,100,30,"Embeddings Ollama\n(consulta)",b); s.arrow(c,250,y-78,250,y-62)

def shot(t):
    tb=Table([[Paragraph("<b>PEGAR AQUÍ LA CAPTURA</b><br/>"+t,B)]],colWidths=[16.5*cm],rowHeights=[6.5*cm])
    tb.setStyle(TableStyle([("BOX",(0,0),(-1,-1),1,colors.grey),("BACKGROUND",(0,0),(-1,-1),colors.HexColor("#f3f3f3")),("VALIGN",(0,0),(-1,-1),"MIDDLE"),("ALIGN",(0,0),(-1,-1),"CENTER")]))
    return tb
def prompt_flow():
    out=[]
    for l in prompt.replace("`","").split("\n"):
        if not l.strip(): out.append(Spacer(1,4)); continue
        if l.startswith("# "): out.append(Paragraph("<b>"+escape(l[2:])+"</b>",ParagraphStyle("ph",parent=C,fontName="Courier-Bold",fontSize=9,spaceBefore=4)))
        else: out.append(Paragraph(escape(l),ParagraphStyle("pl",parent=C,leftIndent=10,firstLineIndent=-10 if l.startswith("-") else 0)))
    return out
F="<font face='Courier'>%s</font>"

s=[Paragraph("Pre entrega 4",T),
 Paragraph("<b>AI Agent con RAG: primer filtro de consultas de la butaca comercial</b>",ParagraphStyle("st",parent=B,fontSize=12)),
 Paragraph("Ejercicio pre-entregable · Nicolás Milano · 04/11/2026",ParagraphStyle("by",parent=B,textColor=colors.grey)),
 Paragraph("1. Caso de uso",H1),
 P("Continúa las pre entregas anteriores. A la butaca comercial de la financiera los clientes le escriben por WhatsApp con consultas que se repiten: ¿puedo sacar un crédito?, ¿cobraron mi cuota?, ¿me informan mi estado de cuenta?, ¿ya me liquidaron el préstamo? "
   "El agente es el <b>primer filtro</b>: responde con el manual de la butaca lo que figura en él (requisitos, montos, plazo, circuito, estados, horarios) y deriva a un analista lo que depende del sistema, lo que implica una decisión de crédito o un reclamo. "
   "Los mensajes son cortos e informales, de lunes a viernes de 8 a 18 h, y pueden incluir un DNI o un cliente molesto por un débito."),
 Paragraph("2. Decisión de infraestructura: modelo local (Ollama)",H1),
 P("<b>Elección:</b> modelo local con Ollama. Chat: <b>llama3.1:8b</b>. Embeddings: <b>nomic-embed-text</b> (768 dimensiones). Vector Store: Supabase. "
   "El 8B cuantizado ocupa unos 5 GB y se recomienda un equipo con 16 GB de RAM o más (con GPU responde más rápido); en las pruebas de este prototipo corrió en el equipo local sin problemas. Soporta español y herramientas, que el AI Agent necesita para usar el retriever. Para un manual corto y preguntas acotadas alcanza; un modelo mayor sería sobredimensionado. Si el equipo tuviera menos de 16 GB de RAM, la alternativa es llama3.2:3b, con menor calidad de redacción.")]
s+=bl([
 "<b>Privacidad:</b> la butaca maneja información financiera de clientes: DNI, situación en el BCRA, estado de cuenta. Los mensajes de WhatsApp van a incluir DNI y datos de deudas, que son datos personales protegidos por la Ley 25.326, y la política de la butaca solo permite informar lo que corresponde al DNI consultado. Con Ollama, esos mensajes no salen de la infraestructura de la empresa; con una API en la nube cada consulta viajaría a un tercero.",
 "<b>Costos operativos:</b> en la nube se paga por token, y el agente reenvía en cada mensaje el system prompt, el historial y los fragmentos recuperados, por lo que cada consulta consume bastantes tokens y el costo crece con cada cliente que escribe. El local tiene un costo fijo (equipo y electricidad) que no depende de la cantidad de mensajes.",
 "<b>Latencia:</b> el objetivo es responder en unos 10 minutos como máximo. Un 8B local genera la respuesta en el orden de segundos a un par de minutos según el equipo, dentro de ese margen, sin depender de la red ni de la disponibilidad del proveedor.",
 "<b>Independencia:</b> el servicio no depende de cambios de precio, límites de uso ni deprecación de modelos de un proveedor externo."])
s+=[P("<b>Trade-off asumido:</b> un modelo de 8B razona peor que uno grande de la nube. Se compensa con un prompt estricto, temperatura baja (0,2) y la regla de que, si el manual no tiene el dato, el agente deriva a un analista en lugar de inventar."),
 PageBreak(),
 Paragraph("3. Pipeline de ingesta y recuperación",H1),
 P("Documento base: "+F%"manual-butaca-comercial.md"+" (productos, montos, plazo, requisitos, categorías, circuito, estados, horarios, privacidad; datos ficticios). Tabla "+F%"documents"+" en Supabase con columna "+F%"vector(768)"+".")]
s+=[Flow(h=8.8*cm),Spacer(1,6)]
s+=[P("<b>Qué entra y qué sale de cada nodo</b>"),
 tbl([["Nodo","Entra","Sale"],
  ["Manual Trigger","Clic en «Execute workflow» (una sola vez)","Un ítem vacío que dispara la carga"],
  ["Code: texto del manual","Ejecución manual","Un ítem con el campo «texto» con el manual completo"],
  ["Splitter + Data Loader","El texto del manual","Fragmentos de 500 caracteres con solapamiento de 80, con metadato «fuente»"],
  ["Embeddings Ollama + Supabase","Cada fragmento","Un vector de 768 números por fragmento, guardado en la tabla "+F%"documents"],
  ["Webhook","POST "+F%"/butaca-consulta"+" con "+F%'{"numero":"5491155550000","mensaje":"..."}',"El mismo dato dentro de "+F%"body"],
  ["AI Agent","El mensaje, la memoria de esa sesión y el system prompt","Respuesta de texto breve, usando antes el retriever"],
  ["Detectar derivación (Code)","Respuesta del agente y mensaje original","JSON con numero, respuesta, derivar (true/false) y prioridad (NORMAL/ALTA)"],
  ["Respond to Webhook","El JSON anterior","Devuelve la respuesta al sistema que envió el mensaje"]],[4.3*cm,5.8*cm,6.9*cm]),
 Spacer(1,8),P("<b>Recepción y envío:</b> el nodo <b>Webhook</b> recibe el mensaje del cliente (en producción lo enviaría la integración de WhatsApp; en la práctica se simula con una llamada POST) y el nodo <b>Respond to Webhook</b> devuelve la respuesta, que el sistema de mensajería reenvía al cliente. "
   "<b>Memoria:</b> Simple Memory con <b>Session ID = número del remitente</b> ("+F%"{{ $json.body.numero }}"+"), ventana de 6 mensajes, para que el agente recuerde lo que ese mismo cliente ya dijo, por ejemplo su DNI. "
   "<b>Prioridad:</b> el nodo Code marca prioridad ALTA con reglas fijas (palabras como «débito» o «reclamo») y no con el modelo, porque un cliente molesto por más de un débito es el caso más importante y no conviene depender de que un 8B lo detecte."),
 Paragraph("4. Nodo del LLM conectado al retriever",H1),
 P("El AI Agent usa Ollama Chat Model (llama3.1:8b, temperatura 0,2). El Supabase Vector Store está conectado como herramienta en modo <i>Retrieve Documents (As Tool for AI Agent)</i>, con top-K = 4 y el mismo modelo de embeddings (nomic-embed-text) que se usó en la ingesta; es obligatorio que sean el mismo. "
   "El system prompt le ordena consultar siempre la herramienta antes de responder y no inventar si no encuentra nada, así que las respuestas se basan exclusivamente en el manual cargado."),
 PageBreak(),
 Paragraph("5. System prompt del agente",H1),
 P("Incluye rol, tono para WhatsApp, información disponible, política de escalado a un analista y límites claros (privacidad, sin promesas de aprobación).")]
s+=prompt_flow()
from reportlab.platypus import Image, KeepTogether
from PIL import Image as PILImage
def pic(name, cap, w=15.5*cm):
    path=str(root/"entrega/capturas"/name); iw,ih=PILImage.open(path).size
    im=Image(path,width=w,height=w*ih/iw)
    return KeepTogether([im,Paragraph("<i>"+cap+"</i>",ParagraphStyle("cap",parent=SM,textColor=colors.grey,spaceBefore=3,spaceAfter=10))])
s+=[PageBreak(),Paragraph("6. Capturas del prototipo en n8n",H1),
 P("Prototipo corriendo en n8n local (instalado con npm, Windows), con Ollama local (llama3.1:8b y nomic-embed-text) y Supabase como Vector Store."),
 Paragraph("<b>6.1 Ingesta del manual</b>",B),
 pic("01-ingesta-flujo.png","Flujo de ingesta ejecutado: el manual se divide en 8 fragmentos que se guardan en Supabase.",w=11.5*cm),
 pic("02-supabase-tabla.png","Tabla documents en Supabase: 8 filas, cada una con el texto del fragmento, su metadato y su vector (embedding).",w=15.5*cm),
 PageBreak(),
 Paragraph("<b>6.2 Ejecución del agente: consulta de requisitos</b>",B),
 P("Mensaje de prueba enviado al webhook: "+F%'{"numero":"5491155550000","mensaje":"¿Qué requisitos necesito para un crédito?"}'+". El Session ID de la memoria es el número del remitente."),
 pic("03-agente-flujo.png","Flujo completo con ejecución exitosa: Webhook → AI Agent (Ollama, Memoria con Session ID = número, herramienta manual_butaca con 4 fragmentos recuperados) → Code → Respond to Webhook.",w=13.5*cm),
 pic("04-agente-respuesta.png","Respuesta recibida: requisitos tomados del manual (ANSES, hasta 2 deudas en el BCRA, aprobación final del analista). derivar = False, prioridad = NORMAL.",w=14.5*cm),
 PageBreak(),
 Paragraph("<b>6.3 Ejecución del agente: reclamo (escalado a un analista)</b>",B),
 P("Mensaje de prueba: «Me debitaron dos veces la cuota y estoy muy molesto». El reclamo por más de un débito es el caso de máxima prioridad."),
 pic("05-reclamo-flujo.png","Flujo ejecutado con el mensaje de reclamo.",w=13.5*cm),
 pic("06-reclamo-respuesta.png","El agente deriva: «Te paso con un analista de la butaca». derivar = True, prioridad = ALTA.",w=11*cm),
 PageBreak(),
 Paragraph("7. Reflexión: escalabilidad (x10 mensajes)",H1),
 P("La decisión se sostiene en privacidad, pero la infraestructura local tendría que crecer: un solo Ollama atiende pocas consultas en paralelo, y con 10 veces más mensajes la demora crecería por encolamiento en los picos. "
   "Cambiaría: (1) una GPU dedicada o un segundo servidor Ollama con balanceo y n8n en modo cola; (2) respuestas fijas o en caché para las preguntas más repetidas (requisitos, horarios), sin pasar por el modelo; "
   "(3) un esquema híbrido, con el local para todo lo que lleve DNI o datos de cuenta y la nube solo para picos con mensajes anonimizados. "
   "El hardware es un gasto fijo que se amortiza al crecer el volumen, mientras que en la nube el costo se multiplicaría junto con los tokens."),
 Paragraph("8. Límites y mejora futura",H1)]
s+=bl(["El agente <b>no tiene acceso al sistema</b>: no puede decir si se cobró una cuota ni informar un estado de cuenta; toma el DNI y deriva a un analista. Una mejora sería una herramienta que consulte el sistema solo por el DNI consultado.",
 "La derivación hoy devuelve "+F%"derivar: true"+" en el JSON; en producción debería avisar a un analista (por Teams o mail).",
 "Hoy WhatsApp no es viable con la app básica; en producción requiere WhatsApp Business con API.",
 "Los datos del manual son ficticios y están armados a partir del proceso real de la butaca."])
SimpleDocTemplate(str(root/"entrega/Pre-entrega-4-RAG-Butaca.pdf"),pagesize=A4,leftMargin=2*cm,rightMargin=2*cm,topMargin=2*cm,bottomMargin=2*cm,title="Pre entrega 4 - AI Agent con RAG").build(s)
