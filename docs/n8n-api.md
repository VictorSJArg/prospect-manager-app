# API privada para n8n

Esta app expone endpoints privados bajo `/api/n8n` para que n8n pueda leer contactos, enviar campañas por sus propios nodos de email/WhatsApp y registrar lo enviado en Firestore.

## Variables de entorno

Configurar en Vercel:

```env
N8N_API_TOKEN=un-token-largo-y-secreto
FIREBASE_PROJECT_ID=gen-lang-client-0932299961
FIRESTORE_DATABASE_ID=ai-studio-a6278b9a-2b8a-4ac0-9165-4a9d6ea34455
FIREBASE_SERVICE_ACCOUNT_KEY_BASE64=service-account-json-en-base64
```

En PowerShell podes convertir el JSON de service account a base64 con:

```powershell
[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes((Get-Content .\service-account.json -Raw)))
```

Opcional, solo si queres que la API le pida a n8n enviar un email por webhook:

```env
N8N_EMAIL_WEBHOOK_URL=https://tu-n8n/webhook/send-email
N8N_EMAIL_WEBHOOK_TOKEN=otro-token-opcional
```

## Autenticacion

Todos los endpoints usan:

```http
Authorization: Bearer TU_N8N_API_TOKEN
```

Tambien se acepta:

```http
X-API-Key: TU_N8N_API_TOKEN
```

## Endpoints

### Listar prospectos

```http
GET /api/n8n/leads?hasContact=true&limit=500
```

Filtros disponibles:

```txt
status=En Proceso
priority=Alta
highPotential=true
hasContact=true
includeOptOut=true
since=2026-05-01T00:00:00.000Z
limit=500
```

Cada registro incluye `email` y tambien `mail` como alias para mapear facil en n8n.

### Leer un prospecto

```http
GET /api/n8n/leads/LEAD_ID
```

### Leer mensajes/observaciones

```http
GET /api/n8n/leads/LEAD_ID/messages
```

### Registrar email o WhatsApp enviado por n8n

```http
POST /api/n8n/leads/LEAD_ID/log-message
Content-Type: application/json

{
  "channel": "email",
  "to": "cliente@ejemplo.com",
  "subject": "Consulta previsional",
  "content": "Texto enviado al cliente",
  "status": "sent",
  "campaignId": "campania-mayo"
}
```

Esto crea una observacion `client_message` y actualiza los campos `lastCampaignAt`, `lastCampaignChannel` y `lastCampaignStatus` del prospecto.

### Marcar baja de envios masivos

```http
POST /api/n8n/leads/LEAD_ID/opt-out
Content-Type: application/json

{
  "reason": "Pidio no recibir mas mensajes"
}
```

### Pedir a n8n que envie un email por webhook

```http
POST /api/n8n/leads/LEAD_ID/email
Content-Type: application/json

{
  "subject": "Consulta previsional",
  "content": "Texto del email",
  "campaignId": "campania-mayo"
}
```

Requiere `N8N_EMAIL_WEBHOOK_URL`. Si no lo configuras, usa n8n directamente para enviar mails despues de llamar a `GET /api/n8n/leads`.
