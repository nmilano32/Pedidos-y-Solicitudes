import json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
prompt = (root/"prompt/system-prompt.md").read_text()
LC = "@n8n/n8n-nodes-langchain."
def n(id_, name, type_, v, pos, params, creds=None):
    d = {"id": id_, "name": name, "type": type_, "typeVersion": v, "position": pos, "parameters": params}
    if creds: d["credentials"] = creds
    return d
ollama = {"ollamaApi": {"id": "ollama-local", "name": "Ollama local"}}
supa = {"supabaseApi": {"id": "supabase-cred", "name": "Supabase"}}
nodes = [
 # ---- Flujo 1: ingesta ----
 n("n1","Nota ingesta","n8n-nodes-base.stickyNote",1,[-200,-120],{"content":"## 1) INGESTA (se ejecuta una vez)\nArchivo -> splitter -> embeddings (nomic-embed-text) -> Supabase","width":760,"height":120}),
 n("n2","Ejecutar ingesta","n8n-nodes-base.manualTrigger",1,[-200,60],{}),
 n("n3","Leer FAQ","n8n-nodes-base.readWriteFile",1,[0,60],{"operation":"read","fileSelector":"/data/manual-butaca-comercial.md"}),
 n("n4","Guardar en Supabase","%svectorStoreSupabase"%LC,1.1,[220,60],{"mode":"insert","tableName":{"__rl":True,"mode":"list","value":"documents"},"options":{"queryName":"match_documents"}},supa),
 n("n5","Embeddings Ollama (ingesta)","%sembeddingsOllama"%LC,1,[180,260],{"model":"nomic-embed-text:latest"},ollama),
 n("n6","Cargador de documento","%sdocumentDefaultDataLoader"%LC,1,[340,260],{"dataType":"binary","textSplittingMode":"custom","options":{"metadata":{"metadataValues":[{"name":"fuente","value":"manual-butaca-comercial"}]}}}),
 n("n7","Splitter","%stextSplitterRecursiveCharacterTextSplitter"%LC,1,[340,420],{"chunkSize":500,"chunkOverlap":80}),
 # ---- Flujo 2: agente ----
 n("n8","Nota agente","n8n-nodes-base.stickyNote",1,[-200,560],{"content":"## 2) AGENTE RAG\nWebhook -> AI Agent (Ollama + memoria por remitente + retriever Supabase) -> Detectar derivacion -> Respond to Webhook","width":1000,"height":120}),
 n("n9","Webhook mensaje","n8n-nodes-base.webhook",2,[-200,760],{"httpMethod":"POST","path":"butaca-consulta","responseMode":"responseNode","options":{}}),
 n("n10","AI Agent","%sagent"%LC,1.7,[40,760],{"promptType":"define","text":"={{ $json.body.mensaje }}","options":{"systemMessage":prompt}}),
 n("n11","Ollama Chat Model","%slmChatOllama"%LC,1,[-20,980],{"model":"llama3.1:8b","options":{"temperature":0.2}},ollama),
 n("n12","Memoria (Session ID = remitente)","%smemoryBufferWindow"%LC,1.3,[160,980],{"sessionIdType":"customKey","sessionKey":"={{ $('Webhook mensaje').item.json.body.numero }}","contextWindowLength":6}),
 n("n13","manual_butaca","%svectorStoreSupabase"%LC,1.1,[340,980],{"mode":"retrieve-as-tool","toolName":"manual_butaca","toolDescription":"Devuelve información oficial del manual de la butaca comercial: productos, montos, plazo, requisitos, circuito, estados de una consulta y horarios. Usala siempre antes de responder.","tableName":{"__rl":True,"mode":"list","value":"documents"},"topK":4,"options":{"queryName":"match_documents"}},supa),
 n("n14","Embeddings Ollama (consulta)","%sembeddingsOllama"%LC,1,[340,1160],{"model":"nomic-embed-text:latest"},ollama),
 n("n16","Detectar derivación","n8n-nodes-base.code",2,[260,760],{"mode":"runOnceForEachItem","jsCode":"const out = $json.output || '';\nconst w = $('Webhook mensaje').item.json.body;\nconst alta = /d[eé]bit|descont|reclam|estaf|denunci|defensa del consumidor|enojad|harto|inaceptable/i.test(w.mensaje || '');\nconst derivar = /analista de la butaca/i.test(out) || alta;\nreturn { json: { numero: w.numero, respuesta: out, derivar, prioridad: alta ? 'ALTA' : 'NORMAL' } };"}),
 n("n15","Responder al remitente","n8n-nodes-base.respondToWebhook",1.1,[480,760],{"respondWith":"json","responseBody":"={{ $json }}","options":{}}),
]
def main(a,b): return [{"node":a,"type":"main","index":0}]
def ai(a,t): return [{"node":a,"type":t,"index":0}]
conn = {
 "Ejecutar ingesta":{"main":[main("Leer FAQ",0)[0:1]]},
 "Leer FAQ":{"main":[main("Guardar en Supabase",0)[0:1]]},
 "Embeddings Ollama (ingesta)":{"ai_embedding":[ai("Guardar en Supabase","ai_embedding")]},
 "Cargador de documento":{"ai_document":[ai("Guardar en Supabase","ai_document")]},
 "Splitter":{"ai_textSplitter":[ai("Cargador de documento","ai_textSplitter")]},
 "Webhook mensaje":{"main":[main("AI Agent",0)[0:1]]},
 "AI Agent":{"main":[main("Detectar derivación",0)[0:1]]},
 "Detectar derivación":{"main":[main("Responder al remitente",0)[0:1]]},
 "Ollama Chat Model":{"ai_languageModel":[ai("AI Agent","ai_languageModel")]},
 "Memoria (Session ID = remitente)":{"ai_memory":[ai("AI Agent","ai_memory")]},
 "manual_butaca":{"ai_tool":[ai("AI Agent","ai_tool")]},
 "Embeddings Ollama (consulta)":{"ai_embedding":[ai("manual_butaca","ai_embedding")]},
}
wf = {"name":"RAG Butaca Comercial - Ollama + Supabase","nodes":nodes,"connections":conn,"settings":{"executionOrder":"v1"},"pinData":{}}
(root/"n8n/workflow-rag-butaca.json").write_text(json.dumps(wf,indent=2,ensure_ascii=False))
