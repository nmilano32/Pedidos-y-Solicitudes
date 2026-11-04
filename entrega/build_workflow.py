import json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
prompt = (root/"prompt/system-prompt.md").read_text()
LC = "@n8n/n8n-nodes-langchain."
def n(id_, name, type_, v, pos, params, creds=None):
    d = {"id": id_, "name": name, "type": type_, "typeVersion": v, "position": pos, "parameters": params}
    if creds: d["credentials"] = creds
    return d
ollama = {"ollamaApi": {"id": "ollama-local", "name": "Ollama account"}}
supa = {"supabaseApi": {"id": "supabase-cred", "name": "Supabase account"}}
nodes = [
 # ---- Flujo 1: ingesta ----
 n("n1","Nota: ingesta","n8n-nodes-base.stickyNote",1,[-200,-120],{"content":"## 1) INGESTA (se ejecuta una vez)\nTexto del manual -> splitter -> embeddings (nomic-embed-text) -> Supabase","width":760,"height":120}),
 n("n2","Manual: ejecutar ingesta","n8n-nodes-base.manualTrigger",1,[-200,60],{}),
 n("n3","Code: texto del manual","n8n-nodes-base.code",2,[0,60],{"mode":"runOnceForAllItems","jsCode":"return [{ json: { texto: " + json.dumps((root/"base-conocimiento/manual-butaca-comercial.md").read_text()) + " } }];"}),
 n("n4","Supabase: guardar manual","%svectorStoreSupabase"%LC,1.1,[220,60],{"mode":"insert","tableName":{"__rl":True,"mode":"list","value":"documents"},"options":{"queryName":"match_documents"}},supa),
 n("n5","Embeddings Ollama: ingesta","%sembeddingsOllama"%LC,1,[180,260],{"model":"nomic-embed-text:latest"},ollama),
 n("n6","Data Loader: manual","%sdocumentDefaultDataLoader"%LC,1,[340,260],{"dataType":"json","jsonMode":"expressionData","jsonData":"={{ $json.texto }}","textSplittingMode":"custom","options":{"metadata":{"metadataValues":[{"name":"fuente","value":"manual-butaca-comercial"}]}}}),
 n("n7","Splitter: fragmentos","%stextSplitterRecursiveCharacterTextSplitter"%LC,1,[340,420],{"chunkSize":500,"chunkOverlap":80}),
 # ---- Flujo 2: agente ----
 n("n8","Nota: agente RAG","n8n-nodes-base.stickyNote",1,[-200,560],{"content":"## 2) AGENTE RAG\nWebhook -> AI Agent (Ollama + memoria por remitente + retriever Supabase) -> Detectar derivacion -> Respond to Webhook","width":1000,"height":120}),
 n("n9","Webhook: consulta nueva","n8n-nodes-base.webhook",2,[-200,760],{"httpMethod":"POST","path":"butaca-consulta","responseMode":"responseNode","options":{}}),
 n("n10","AI Agent: responder consulta","%sagent"%LC,1.7,[40,760],{"promptType":"define","text":"={{ $json.body.mensaje }}","options":{"systemMessage":prompt}}),
 n("n11","Ollama (modelo)","%slmChatOllama"%LC,1,[-20,980],{"model":"llama3.1:8b","options":{"temperature":0.2}},ollama),
 n("n12","Memoria (Session ID = número)","%smemoryBufferWindow"%LC,1.3,[160,980],{"sessionIdType":"customKey","sessionKey":"={{ $('Webhook: consulta nueva').item.json.body.numero }}","contextWindowLength":6}),
 n("n13","manual_butaca","%svectorStoreSupabase"%LC,1.1,[340,980],{"mode":"retrieve-as-tool","toolName":"manual_butaca","toolDescription":"Devuelve información oficial del manual de la butaca comercial: productos, montos, plazo, requisitos, circuito, estados de una consulta y horarios. Usala siempre antes de responder.","tableName":{"__rl":True,"mode":"list","value":"documents"},"topK":4,"options":{"queryName":"match_documents"}},supa),
 n("n14","Embeddings Ollama (consulta)","%sembeddingsOllama"%LC,1,[340,1160],{"model":"nomic-embed-text:latest"},ollama),
 n("n16","Code: detectar derivación","n8n-nodes-base.code",2,[260,760],{"mode":"runOnceForEachItem","jsCode":"const out = $json.output || '';\nconst w = $('Webhook: consulta nueva').item.json.body;\nconst alta = /d[eé]bit|descont|reclam|estaf|denunci|defensa del consumidor|enojad|harto|inaceptable/i.test(w.mensaje || '');\nconst derivar = /analista de la butaca/i.test(out) || alta;\nreturn { json: { numero: w.numero, respuesta: out, derivar, prioridad: alta ? 'ALTA' : 'NORMAL' } };"}),
 n("n15","Responder: respuesta al cliente","n8n-nodes-base.respondToWebhook",1.1,[480,760],{"respondWith":"json","responseBody":"={{ $json }}","options":{}}),
]
def main(a,b): return [{"node":a,"type":"main","index":0}]
def ai(a,t): return [{"node":a,"type":t,"index":0}]
conn = {
 "Manual: ejecutar ingesta":{"main":[main("Code: texto del manual",0)[0:1]]},
 "Code: texto del manual":{"main":[main("Supabase: guardar manual",0)[0:1]]},
 "Embeddings Ollama: ingesta":{"ai_embedding":[ai("Supabase: guardar manual","ai_embedding")]},
 "Data Loader: manual":{"ai_document":[ai("Supabase: guardar manual","ai_document")]},
 "Splitter: fragmentos":{"ai_textSplitter":[ai("Data Loader: manual","ai_textSplitter")]},
 "Webhook: consulta nueva":{"main":[main("AI Agent: responder consulta",0)[0:1]]},
 "AI Agent: responder consulta":{"main":[main("Code: detectar derivación",0)[0:1]]},
 "Code: detectar derivación":{"main":[main("Responder: respuesta al cliente",0)[0:1]]},
 "Ollama (modelo)":{"ai_languageModel":[ai("AI Agent: responder consulta","ai_languageModel")]},
 "Memoria (Session ID = número)":{"ai_memory":[ai("AI Agent: responder consulta","ai_memory")]},
 "manual_butaca":{"ai_tool":[ai("AI Agent: responder consulta","ai_tool")]},
 "Embeddings Ollama (consulta)":{"ai_embedding":[ai("manual_butaca","ai_embedding")]},
}
wf = {"name":"RAG Butaca Comercial - Ollama + Supabase","nodes":nodes,"connections":conn,"settings":{"executionOrder":"v1","saveDataSuccessExecution":"all","saveManualExecutions":True,"timezone":"America/Argentina/Buenos_Aires"},"pinData":{}}
(root/"n8n/workflow-rag-butaca.json").write_text(json.dumps(wf,indent=2,ensure_ascii=False))
