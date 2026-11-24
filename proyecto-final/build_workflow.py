"""Genera workflow-agente-rag.json (proyecto final) a partir del system prompt y del manual."""
import json
import pathlib

root = pathlib.Path(__file__).resolve().parent
repo = root.parent
prompt = (root / "system-prompt.md").read_text(encoding="utf-8").strip()
manual = (repo / "base-conocimiento/manual-butaca-comercial.md").read_text(encoding="utf-8")

LC = "@n8n/n8n-nodes-langchain."
GMAIL = {"gmailOAuth2": {"id": "rlwd2wGTa7VlKgKx", "name": "Gmail account"}}
OLLAMA = {"ollamaApi": {"id": "", "name": "Ollama account"}}
SUPA = {"supabaseApi": {"id": "", "name": "Supabase account"}}

nodes, conns = [], {}
_id = [0]


def node(name, type_, version, pos, params, creds=None, **extra):
    _id[0] += 1
    n = {"id": f"pf000000-0000-4000-8000-{_id[0]:012d}", "name": name, "type": type_,
         "typeVersion": version, "position": pos, "parameters": params}
    if creds:
        n["credentials"] = creds
    n.update(extra)
    nodes.append(n)
    return name


def link(src, dst, out=0, kind="main", inp=0):
    outs = conns.setdefault(src, {}).setdefault(kind, [])
    while len(outs) <= out:
        outs.append([])
    outs[out].append({"node": dst, "type": kind, "index": inp})


def sticky(name, text, pos, w, h, color=None):
    p = {"content": text, "width": w, "height": h}
    if color:
        p["color"] = color
    node(name, "n8n-nodes-base.stickyNote", 1, pos, p)


def cond(left, op, right=None, typ="string"):
    c = {"id": f"c{len(nodes)}{op}", "leftValue": left, "operator": {"type": typ, "operation": op}}
    if right is None:
        c["operator"]["singleValue"] = True
        c["rightValue"] = ""
    else:
        c["rightValue"] = right
    return c


def if_params(*conds):
    return {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose", "version": 2},
                           "conditions": list(conds), "combinator": "and"}, "options": {}}


def assign(fields):
    return {"assignments": {"assignments": [
        {"id": f"a{i}", "name": k, "value": v, "type": t} for i, (k, v, t) in enumerate(fields)]}, "options": {}}


# ------------------------------------------------------------------ notas
sticky("Nota: ingesta", "## A) Ingesta del manual (se ejecuta una vez)\nTexto del manual → chunks de 500 caracteres → embeddings nomic-embed-text (Ollama) → Supabase (tabla documents).", [-700, -460], 1160, 120, 4)
sticky("Nota: entradas", "## 1) Entradas\nDos fuentes distintas: WhatsApp (Webhook) y mails con asunto \"Caso butaca\" (Gmail). Cada una se lleva al mismo formato: canal, remitente, mensaje.", [-700, 60], 420, 140, 7)
sticky("Nota: agente", "## 2) Agente con RAG\nConsulta el manual en Supabase y decide RESPONDER o DERIVAR. Memoria por remitente. Modelo local (Ollama).", [-160, 60], 520, 140, 6)
sticky("Nota: errores", "## 3) Manejo de errores\n- Mensaje vacío → se deriva sin pasar por la IA.\n- Falla de Ollama o Supabase → salida de error del agente → contingencia.\n- Respuesta nula o JSON inválido → el Code la descarta y deriva.\n- Reclamo/débito → siempre DERIVAR con prioridad ALTA (regla fija).", [400, 60], 520, 170, 3)
sticky("Nota: salida", "## 4) Salida\nCada caso queda en Google Sheets (Casos butaca). Resuelto o Pendiente para el analista. Respuesta por el mismo canal: Webhook (WhatsApp) o borrador en Gmail.", [960, 60], 860, 140, 5)

# ------------------------------------------------------------------ A) ingesta
node("Manual: ejecutar ingesta", "n8n-nodes-base.manualTrigger", 1, [-680, -300], {})
node("Code: texto del manual", "n8n-nodes-base.code", 2, [-460, -300],
     {"mode": "runOnceForAllItems", "jsCode": "return [{ json: { texto: " + json.dumps(manual, ensure_ascii=False) + " } }];"})
node("Supabase: guardar manual", LC + "vectorStoreSupabase", 1.1, [-220, -300],
     {"mode": "insert", "tableName": {"__rl": True, "mode": "list", "value": "documents"}, "options": {"queryName": "match_documents"}}, SUPA)
node("Embeddings Ollama: ingesta", LC + "embeddingsOllama", 1, [-260, -120], {"model": "nomic-embed-text:latest"}, OLLAMA)
node("Data Loader: manual", LC + "documentDefaultDataLoader", 1, [-80, -120],
     {"dataType": "json", "jsonMode": "expressionData", "jsonData": "={{ $json.texto }}", "textSplittingMode": "custom",
      "options": {"metadata": {"metadataValues": [{"name": "fuente", "value": "manual-butaca-comercial"}]}}})
node("Splitter: fragmentos", LC + "textSplitterRecursiveCharacterTextSplitter", 1, [-80, 40], {"chunkSize": 500, "chunkOverlap": 80})
link("Manual: ejecutar ingesta", "Code: texto del manual")
link("Code: texto del manual", "Supabase: guardar manual")
link("Embeddings Ollama: ingesta", "Supabase: guardar manual", kind="ai_embedding")
link("Data Loader: manual", "Supabase: guardar manual", kind="ai_document")
link("Splitter: fragmentos", "Data Loader: manual", kind="ai_textSplitter")

# ------------------------------------------------------------------ 1) entradas
node("Webhook: mensaje WhatsApp", "n8n-nodes-base.webhook", 2, [-680, 260],
     {"httpMethod": "POST", "path": "butaca-whatsapp", "responseMode": "responseNode", "options": {}},
     webhookId="5b1d7a52-2f4e-4c1a-9a51-butaca0final1")
node("Gmail Trigger: caso butaca", "n8n-nodes-base.gmailTrigger", 1.2, [-680, 460],
     {"pollTimes": {"item": [{"mode": "everyMinute"}]}, "simple": False,
      "filters": {"q": "subject:\"caso butaca\"", "readStatus": "unread"}, "options": {}}, GMAIL)
node("Edit Fields: normalizar WhatsApp", "n8n-nodes-base.set", 3.4, [-460, 260], assign([
    ("canal", "WhatsApp", "string"),
    ("remitente", "={{ String($json.body.numero ?? '').replace(/\\D/g, '') }}", "string"),
    ("mensaje", "={{ String($json.body.mensaje ?? '').trim() }}", "string")]))
node("Edit Fields: normalizar mail", "n8n-nodes-base.set", 3.4, [-460, 460], assign([
    ("canal", "Mail", "string"),
    ("remitente", "={{ $json.from?.value?.[0]?.address ?? '' }}", "string"),
    ("mensaje", "={{ String($json.text ?? '').trim().slice(0, 3000) }}", "string")]))
node("If: ¿mensaje válido?", "n8n-nodes-base.if", 2.2, [-220, 360],
     if_params(cond("={{ $json.mensaje }}", "notEmpty"), cond("={{ $json.remitente }}", "notEmpty")))
link("Webhook: mensaje WhatsApp", "Edit Fields: normalizar WhatsApp")
link("Gmail Trigger: caso butaca", "Edit Fields: normalizar mail")
link("Edit Fields: normalizar WhatsApp", "If: ¿mensaje válido?")
link("Edit Fields: normalizar mail", "If: ¿mensaje válido?")

# ------------------------------------------------------------------ 2) agente + RAG
node("AI Agent: decidir consulta", LC + "agent", 3.1, [20, 300], {
    "promptType": "define",
    "text": "=Canal: {{ $json.canal }}\nRemitente: {{ $json.remitente }}\n\n<<<MENSAJE\n{{ $json.mensaje }}\nMENSAJE>>>",
    "options": {"systemMessage": prompt, "maxIterations": 5}}, onError="continueErrorOutput")
node("Ollama (modelo)", LC + "lmChatOllama", 1, [-60, 560], {"model": "llama3.1:8b", "options": {"temperature": 0.1}}, OLLAMA)
node("Memoria (Session ID = remitente)", LC + "memoryBufferWindow", 1.3, [100, 560],
     {"sessionIdType": "customKey", "sessionKey": "={{ $json.remitente }}", "contextWindowLength": 6})
node("manual_butaca", LC + "vectorStoreSupabase", 1.1, [360, 640], {
    "mode": "retrieve-as-tool", "toolName": "manual_butaca",
    "toolDescription": "Devuelve fragmentos del manual de la butaca comercial de Argenpesos: productos, requisitos, montos, plazo, circuito, estados y horarios. Usala siempre antes de decidir.",
    "tableName": {"__rl": True, "mode": "list", "value": "documents"}, "topK": 4, "options": {"queryName": "match_documents"}}, SUPA,
     onError="continueRegularOutput")  # si Supabase falla, el error vuelve al agente y este deriva
node("Embeddings Ollama (consulta)", LC + "embeddingsOllama", 1, [360, 820], {"model": "nomic-embed-text:latest"}, OLLAMA)
link("If: ¿mensaje válido?", "AI Agent: decidir consulta", out=0)
link("Ollama (modelo)", "AI Agent: decidir consulta", kind="ai_languageModel")
link("Memoria (Session ID = remitente)", "AI Agent: decidir consulta", kind="ai_memory")
link("manual_butaca", "AI Agent: decidir consulta", kind="ai_tool")
link("Embeddings Ollama (consulta)", "manual_butaca", kind="ai_embedding")

# ------------------------------------------------------------------ 3) validación y errores
VALIDAR = r"""// Valida la salida del agente ANTES de escribir en la planilla o responder al cliente.
const base = $('If: ¿mensaje válido?').first().json;
const raw = String($json.output ?? '');
let d = null;
try {
  const m = raw.replace(/```json|```/g, '').match(/\{[\s\S]*\}/);
  d = m ? JSON.parse(m[0]) : null;
} catch (e) { d = null; }

let decision = d && ['RESPONDER', 'DERIVAR'].includes(String(d.decision).toUpperCase()) ? String(d.decision).toUpperCase() : null;
let respuesta = d && typeof d.respuesta === 'string' ? d.respuesta.trim() : '';
let motivo = d && d.motivo ? String(d.motivo).trim() : '';
let prioridad = d && String(d.prioridad).toUpperCase() === 'ALTA' ? 'ALTA' : 'NORMAL';
const valida = Boolean(decision) && respuesta.length > 0;

// Respuesta nula o con formato inválido: no se responde con algo dudoso, se deriva.
if (!valida) {
  decision = 'DERIVAR';
  motivo = 'La respuesta del asistente vino vacía o con formato inválido: se deriva a un analista.';
  respuesta = 'Recibimos tu consulta. Un analista de la butaca te va a contactar a la brevedad (lunes a viernes de 8 a 18 h).';
}

// Regla fija: un reclamo o un débito siempre va al analista con prioridad ALTA, decida lo que decida el modelo.
const alta = /d[eé]bit|descont|reclam|estaf|fraude|denunci|defensa del consumidor|enojad|molest|harto|inaceptable/i.test(base.mensaje);
if (alta) {
  prioridad = 'ALTA';
  if (decision !== 'DERIVAR') {
    decision = 'DERIVAR';
    motivo = 'Regla fija: reclamo o débito detectado en el mensaje.';
    respuesta = 'Lamentamos lo ocurrido. Ya derivamos tu caso a un analista de la butaca para que lo revise con prioridad.';
  }
}
if (decision === 'RESPONDER') prioridad = 'NORMAL';

// El DNI solo se guarda si tiene 7 u 8 dígitos y aparece escrito en el mensaje original (evita datos inventados).
let dni = d && d.dni ? String(d.dni).replace(/\D/g, '') : '';
if (!/^\d{7,8}$/.test(dni) || !base.mensaje.replace(/[.\s-]/g, '').includes(dni)) dni = '';

return [{ json: { canal: base.canal, remitente: base.remitente, mensaje: base.mensaje,
  decision, prioridad, dni, motivo, respuesta, respuesta_valida: valida } }];"""
node("Code: validar decisión", "n8n-nodes-base.code", 2, [300, 260], {"mode": "runOnceForAllItems", "jsCode": VALIDAR})

CONTINGENCIA = [
    ("canal", "={{ $('If: ¿mensaje válido?').first().json.canal }}", "string"),
    ("remitente", "={{ $('If: ¿mensaje válido?').first().json.remitente }}", "string"),
    ("mensaje", "={{ $('If: ¿mensaje válido?').first().json.mensaje }}", "string"),
    ("decision", "DERIVAR", "string"),
    ("prioridad", "NORMAL", "string"),
    ("dni", "", "string"),
    ("motivo", "=Falla del asistente (modelo o Supabase sin respuesta): {{ $json.error?.message ?? $json.error ?? 'sin detalle' }}", "string"),
    ("respuesta", "Recibimos tu consulta. Un analista de la butaca te va a contactar a la brevedad (lunes a viernes de 8 a 18 h).", "string")]
node("Edit Fields: contingencia", "n8n-nodes-base.set", 3.4, [300, 440], assign(CONTINGENCIA))
link("AI Agent: decidir consulta", "Code: validar decisión", out=0)
link("AI Agent: decidir consulta", "Edit Fields: contingencia", out=1)

node("Edit Fields: mensaje inválido", "n8n-nodes-base.set", 3.4, [20, 820], assign([
    ("canal", "={{ $json.canal }}", "string"),
    ("remitente", "={{ $json.remitente || 'desconocido' }}", "string"),
    ("mensaje", "={{ $json.mensaje }}", "string"),
    ("decision", "DERIVAR", "string"),
    ("prioridad", "NORMAL", "string"),
    ("dni", "", "string"),
    ("motivo", "Mensaje vacío o sin remitente: no se envía a la IA.", "string"),
    ("respuesta", "No pudimos leer tu consulta. Un analista de la butaca te va a contactar para ayudarte.", "string")]))
link("If: ¿mensaje válido?", "Edit Fields: mensaje inválido", out=1)

# ------------------------------------------------------------------ 4) decisión y salida
node("If: ¿deriva al analista?", "n8n-nodes-base.if", 2.2, [560, 360], if_params(cond("={{ $json.decision }}", "equals", "DERIVAR")))
for src in ("Code: validar decisión", "Edit Fields: contingencia", "Edit Fields: mensaje inválido"):
    link(src, "If: ¿deriva al analista?")


def fila(estado):
    return assign([
        ("fecha", "={{ $now.toFormat('dd/MM/yyyy HH:mm') }}", "string"),
        ("canal", "={{ $json.canal }}", "string"),
        ("remitente", "={{ $json.remitente }}", "string"),
        ("mensaje", "={{ $json.mensaje }}", "string"),
        ("decision", "={{ $json.decision }}", "string"),
        ("prioridad", "={{ $json.prioridad }}", "string"),
        ("dni", "={{ $json.dni }}", "string"),
        ("motivo", "={{ $json.motivo }}", "string"),
        ("respuesta", "={{ $json.respuesta }}", "string"),
        ("estado", estado, "string")])


node("Edit Fields: caso derivado", "n8n-nodes-base.set", 3.4, [780, 260], fila("Pendiente"))
node("Edit Fields: caso resuelto", "n8n-nodes-base.set", 3.4, [780, 460], fila("Resuelto"))
link("If: ¿deriva al analista?", "Edit Fields: caso derivado", out=0)
link("If: ¿deriva al analista?", "Edit Fields: caso resuelto", out=1)

node("Google Sheets: registrar caso", "n8n-nodes-base.googleSheets", 4.5, [1000, 360], {
    "operation": "append",
    "documentId": {"__rl": True, "mode": "list", "value": ""},
    "sheetName": {"__rl": True, "mode": "list", "value": ""},
    "columns": {"mappingMode": "autoMapInputData", "value": {}, "matchingColumns": [], "schema": []},
    "options": {}})
link("Edit Fields: caso derivado", "Google Sheets: registrar caso")
link("Edit Fields: caso resuelto", "Google Sheets: registrar caso")

node("If: ¿vino por WhatsApp?", "n8n-nodes-base.if", 2.2, [1220, 360], if_params(cond("={{ $json.canal }}", "equals", "WhatsApp")))
link("Google Sheets: registrar caso", "If: ¿vino por WhatsApp?")
node("Responder: respuesta WhatsApp", "n8n-nodes-base.respondToWebhook", 1.1, [1460, 260], {
    "respondWith": "json",
    "responseBody": "={{ { numero: $json.remitente, respuesta: $json.respuesta, decision: $json.decision, prioridad: $json.prioridad, estado: $json.estado } }}",
    "options": {}})
node("Gmail: borrador de respuesta", "n8n-nodes-base.gmail", 2.1, [1460, 460], {
    "resource": "draft", "operation": "create",
    "subject": "=Re: {{ $('Gmail Trigger: caso butaca').first().json.subject }}",
    "message": "={{ $json.respuesta }}\n\nButaca comercial - Argenpesos",
    "options": {"threadId": "={{ $('Gmail Trigger: caso butaca').first().json.threadId }}",
                "sendTo": "={{ $('Gmail Trigger: caso butaca').first().json.from.value[0].address }}"}},
     GMAIL, webhookId="9c2e41d0-7b3a-4f55-8e10-butaca0final2")
node("Gmail: marcar como leído", "n8n-nodes-base.gmail", 2.1, [1680, 460], {
    "operation": "markAsRead", "messageId": "={{ $('Gmail Trigger: caso butaca').first().json.id }}"},
     GMAIL, webhookId="1f6b8a33-0d2c-4e7a-b9c4-butaca0final3")
link("If: ¿vino por WhatsApp?", "Responder: respuesta WhatsApp", out=0)
link("If: ¿vino por WhatsApp?", "Gmail: borrador de respuesta", out=1)
link("Gmail: borrador de respuesta", "Gmail: marcar como leído")

wf = {"name": "Proyecto final - Agente butaca Argenpesos (RAG)", "nodes": nodes, "connections": conns,
      "settings": {"executionOrder": "v1", "saveDataSuccessExecution": "all", "saveManualExecutions": True,
                   "timezone": "America/Argentina/Buenos_Aires"}, "pinData": {}}
(root / "workflow-agente-rag.json").write_text(json.dumps(wf, indent=2, ensure_ascii=False), encoding="utf-8")
print(f"{len(nodes)} nodos")
