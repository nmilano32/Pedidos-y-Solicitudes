import pathlib
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Preformatted, Table, TableStyle, PageBreak, Flowable
root = pathlib.Path(__file__).resolve().parent.parent
prompt = (root/"prompt/system-prompt.md").read_text()
ss = getSampleStyleSheet()
B = ParagraphStyle("b", parent=ss["BodyText"], fontSize=10.5, leading=15, spaceAfter=6)
H1 = ParagraphStyle("h1", parent=ss["Heading1"], fontSize=16, spaceBefore=10, textColor=colors.HexColor("#1f4e79"))
T = ParagraphStyle("t", parent=ss["Title"], fontSize=20)
C = ParagraphStyle("c", parent=B, fontName="Courier", fontSize=8, leading=10.5)
def P(t): return Paragraph(t, B)
def bullets(items): return [Paragraph("• "+i, B) for i in items]

class Flow(Flowable):
    def __init__(s, w=17*cm, h=9.2*cm): super().__init__(); s.width=w; s.height=h
    def box(s,c,x,y,w,h,t,fill):
        c.setFillColor(fill); c.setStrokeColor(colors.HexColor("#444")); c.roundRect(x,y,w,h,5,fill=1)
        c.setFillColor(colors.black); c.setFont("Helvetica",7.5)
        for i,l in enumerate(t.split("\n")): c.drawCentredString(x+w/2,y+h/2+(len(t.split("\n"))-1)*4.5-i*9-2.5,l)
    def arrow(s,c,x1,y1,x2,y2):
        c.setStrokeColor(colors.HexColor("#444")); c.line(x1,y1,x2,y2)
        import math; a=math.atan2(y2-y1,x2-x1)
        for d in (2.6,-2.6): c.line(x2,y2,x2-6*math.cos(a-d*0.12),y2-6*math.sin(a-d*0.12))
    def draw(s):
        c=s.canv; g=colors.HexColor("#d9ead3"); bl=colors.HexColor("#cfe2f3"); o=colors.HexColor("#fce5cd")
        c.setFont("Helvetica-Bold",9); c.drawString(0,s.height-10,"A) INGESTA (una vez)")
        y=s.height-50; w=88;h=34
        xs=[0,110,220,330]
        for x,t,f in zip(xs,["Manual\nTrigger","Read File\nfaq.md","Splitter 500/80\n+ Data Loader","Supabase\nVector Store"],[g,g,bl,o]): s.box(c,x,y,w,h,t,f)
        for i in range(3): s.arrow(c,xs[i]+w,y+h/2,xs[i+1],y+h/2)
        s.box(c,330,y-45,w,30,"Embeddings Ollama\nnomic-embed-text",bl); s.arrow(c,374,y-15,374,y)
        c.setFont("Helvetica-Bold",9); c.drawString(0,s.height-125,"B) AGENTE RAG (cada mensaje)")
        y=s.height-170; xs=[0,100,200,300,400]
        for x,t,f in zip(xs,["Webhook POST\n{numero,mensaje}","AI Agent\n(system prompt)","Respond to\nWebhook","",""],[g,o,g,colors.white,colors.white]):
            if t: s.box(c,x,y,88,34,t,f)
        s.arrow(c,88,y+17,100,y+17); s.arrow(c,188,y+17,200,y+17)
        s.box(c,0,y-60,88,32,"Ollama\nllama3.1:8b",bl); s.box(c,100,y-60,88,32,"Memoria\nSession=numero",bl); s.box(c,200,y-60,100,32,"Tool retriever\nSupabase (top 4)",o)
        s.box(c,200,y-105,100,30,"Embeddings Ollama\n(consulta)",bl)
        for x in (44,144,250): s.arrow(c,x,y-28,min(max(x,110),170) if x==44 else x,y)
        s.arrow(c,250,y-75,250,y-60)
        c.setFont("Helvetica-Oblique",8); c.drawString(320,y-40,"Flujo: trigger -> AI Agent -> respuesta")

def shot(t):
    tb=Table([[Paragraph("<b>PEGAR AQUÍ LA CAPTURA</b><br/>"+t,B)]],colWidths=[16.5*cm],rowHeights=[6.5*cm])
    tb.setStyle(TableStyle([("BOX",(0,0),(-1,-1),1,colors.grey),("BACKGROUND",(0,0),(-1,-1),colors.HexColor("#f3f3f3")),("VALIGN",(0,0),(-1,-1),"MIDDLE"),("ALIGN",(0,0),(-1,-1),"CENTER")]))
    return tb

def prompt_flow():
    from xml.sax.saxutils import escape
    out=[]
    for l in prompt.replace("`","").split("\n"):
        if not l.strip(): out.append(Spacer(1,4)); continue
        if l.startswith("# "): out.append(Paragraph("<b>"+escape(l[2:])+"</b>",ParagraphStyle("ph",parent=C,fontName="Courier-Bold",fontSize=9,spaceBefore=4)))
        else: out.append(Paragraph(escape(l),ParagraphStyle("pl",parent=C,leftIndent=10,firstLineIndent=-10 if l.startswith("-") else 0)))
    return out
s=[Paragraph("Pre-entregable: AI Agent con RAG",T),
 Paragraph("<b>Decisión de modelo (local vs. nube) + implementación en n8n</b><br/>Caso: Clínica Odontológica Sonrisa - asistente por WhatsApp",ParagraphStyle("st",parent=B,alignment=1)),
 Paragraph("1. Definición del caso de uso",H1),
 P("Clínica Sonrisa es un consultorio odontológico de barrio. El agente \"Sonri\" atiende por WhatsApp las preguntas frecuentes (horarios, valores de referencia, obras sociales, cuidados posteriores) y recopila los datos para pedir un turno, que luego confirma recepción. "
   "Recibe mensajes cortos e informales, por ejemplo: \"¿hasta qué hora atienden el sábado?\", \"¿cuánto sale una limpieza?\", \"¿aceptan OSDE?\", \"quiero un turno para blanqueamiento\", y ocasionalmente urgencias (\"me duele mucho una muela\") que deben derivarse a una persona."),
 Paragraph("2. Decisión de infraestructura: modelo local (Ollama)",H1),
 P("<b>Elección:</b> modelo local con Ollama: <b>llama3.1:8b</b> para el chat y <b>nomic-embed-text</b> (768 dimensiones) para embeddings, con Supabase como Vector Store."),
 P("<b>Por qué llama3.1:8b:</b> con ~5 GB (cuantizado a 4 bits) corre en una PC con 8 GB de VRAM o incluso en CPU con 16 GB de RAM. Soporta español y llamadas a herramientas (necesario para que el AI Agent use el retriever). Para una FAQ con contexto recuperado de 4 fragmentos, un 8B alcanza; un 70B sería sobredimensionado.")]
s+=bullets([
 "<b>Privacidad de datos:</b> en una clínica los mensajes pueden revelar síntomas, tratamientos y datos de obra social (datos de salud, sensibles según la Ley 25.326 de protección de datos personales). Con Ollama el texto del paciente y las consultas nunca salen de la infraestructura propia; con una API en la nube cada mensaje se enviaría a un tercero.",
 "<b>Costos operativos:</b> el costo es fijo (hardware y electricidad) y no crece por mensaje. En la nube se paga por token en cada consulta, y como el agente reenvía el system prompt, el historial y 4 fragmentos recuperados, cada mensaje consume miles de tokens. A volumen bajo-medio, el local sale más barato; la nube solo gana si el volumen es muy bajo o muy variable.",
 "<b>Latencia:</b> un 8B local responde en ~2-6 s en una GPU modesta, aceptable para WhatsApp, y no depende de la red ni de la cola del proveedor. La contrapartida es que la latencia crece si llegan varios mensajes a la vez (ver punto 6).",
 "<b>Independencia:</b> no depende de la disponibilidad, los cambios de precio ni la deprecación de modelos de un proveedor externo. Los embeddings también son locales, por lo que el índice vectorial no queda atado a una API."])
s+=[Paragraph("<b>Trade-off asumido:</b> un modelo de 8B razona peor que uno grande de la nube, por eso se mitiga con un prompt estricto, temperatura baja (0.2) y respuestas basadas solo en el contexto recuperado.",B),
 PageBreak(),
 Paragraph("3. Pipeline de ingesta y recuperación",H1),
 P("Documento base: <font face='Courier'>base-conocimiento/faq-clinica-sonrisa.md</font>. Tabla <font face='Courier'>documents</font> en Supabase con columna <font face='Courier'>vector(768)</font> (script en <font face='Courier'>n8n/supabase-setup.sql</font>).")]
s.append(Flow(h=8.6*cm))
s+=[Spacer(1,6),P("<b>Pasos</b>")]
s+=bullets([
 "<b>Ingesta (manual, una vez):</b> Manual Trigger → Read/Write Files from Disk (lee el .md) → Default Data Loader → Recursive Character Text Splitter (chunks de 500 caracteres, solapamiento de 80) → Embeddings Ollama (nomic-embed-text) → Supabase Vector Store en modo <i>Insert Documents</i>.",
 "<b>Recepción:</b> un nodo <b>Webhook</b> (POST <font face='Courier'>/webhook/mensaje-clinica</font>, respuesta \"Using Respond to Webhook Node\") recibe <font face='Courier'>{\"numero\":\"5491155550000\",\"mensaje\":\"...\"}</font> desde WhatsApp (Twilio/Meta) o un simulador.",
 "<b>Agente:</b> el AI Agent usa Ollama Chat Model (llama3.1:8b), Simple Memory con <b>Session ID = número del remitente</b> (<font face='Courier'>{{ $json.body.numero }}</font>, ventana de 6 mensajes) y el Supabase Vector Store en modo <i>Retrieve Documents (As Tool for AI Agent)</i> con top-K = 4 y el mismo modelo de embeddings para la consulta.",
 "<b>Respuesta:</b> un nodo <b>Respond to Webhook</b> devuelve <font face='Courier'>{numero, respuesta}</font> al sistema que envió el mensaje, que lo reenvía al paciente por WhatsApp.",
 "<b>Respuesta exclusivamente del contexto:</b> lo garantiza el system prompt (consulta obligatoria a la herramienta, prohibido inventar) más la baja temperatura."])
s+=[Paragraph("4. System prompt del agente",H1),P("Incluye rol, tono para WhatsApp, información disponible, política de escalado a humano y límites claros."),*prompt_flow(),PageBreak(),
 Paragraph("Capturas del prototipo en n8n",H1),
 P("Completar con capturas reales del n8n local (importar <font face='Courier'>n8n/workflow-rag-clinica.json</font>, asignar credenciales de Ollama y Supabase)."),
 shot("Workflow completo: Webhook → AI Agent (Ollama, Memoria, Vector Store tool) → Respond to Webhook"),Spacer(1,8),
 shot("Ejecución exitosa con mensaje de prueba, por ejemplo: {\"numero\":\"5491155550000\",\"mensaje\":\"¿Hasta qué hora atienden el sábado?\"} y la respuesta del agente"),
 PageBreak(),
 Paragraph("5. Reflexión de escalabilidad (x10 mensajes)",H1),
 P("La decisión se sostiene en privacidad, pero no sin cambios en infraestructura: un único Ollama con una GPU modesta procesa pocas solicitudes en paralelo, así que con 10x mensajes la latencia crecería por encolamiento. "
   "Cambiaría: (1) una GPU dedicada o un segundo servidor Ollama con <font face='Courier'>OLLAMA_NUM_PARALLEL</font> y balanceo, y n8n en modo cola; (2) cachear respuestas de preguntas repetidas (horarios, precios) y resolver las más simples sin LLM; "
   "(3) un esquema híbrido: el local para todo lo que contenga datos de pacientes y, solo para picos, un modelo en la nube con datos anonimizados. "
   "El costo de hardware es un gasto fijo que se amortiza al crecer el volumen, mientras que en la nube el costo se multiplicaría por 10 junto con los tokens.")]
SimpleDocTemplate(str(root/"entrega/Pre-entrega-RAG-Clinica-Sonrisa.pdf"),pagesize=A4,leftMargin=2*cm,rightMargin=2*cm,topMargin=2*cm,bottomMargin=2*cm,title="Pre-entregable AI Agent RAG").build(s)
