# ScientificGuard AI — API Reference

## Base URL

```
http://localhost:3001/api
```

---

## Autenticación

Todas las rutas (excepto login) requieren JWT en cookie HttpOnly.

### POST /api/auth/login
Login con email y password. Rate limited: 5 intentos/min.

**Body:**
```json
{
  "email": "reviewer@scientificguard.local",
  "password": "..."
}
```

**Response 200:**
```json
{
  "user": {
    "id": "uuid",
    "name": "Luis Reviewer",
    "email": "reviewer@scientificguard.local",
    "role": "REVIEWER",
    "status": "ACTIVE",
    "lastLoginAt": "2026-08-13T...",
    "createdAt": "...",
    "updatedAt": "..."
  },
  "message": "Login successful"
}
```
Sets cookies: `access_token` (15min), `refresh_token` (7d)

---

### POST /api/auth/logout
Limpia las cookies de autenticación.

**Response 200:**
```json
{ "message": "Logout successful" }
```

---

### POST /api/auth/refresh
Renueva tokens usando el refresh_token cookie.

**Response 200:**
```json
{ "message": "Tokens refreshed" }
```

---

### GET /api/auth/me
🔒 Requiere autenticación.

**Response 200:**
```json
{
  "user": {
    "id": "uuid",
    "email": "...",
    "name": "...",
    "role": "REVIEWER",
    "status": "ACTIVE"
  }
}
```

---

## Documentos

### POST /api/documents/upload
🔒 Requiere autenticación.

**Body:** multipart/form-data con campo `file` (PDF, max 20MB)

**Response 201:**
```json
{
  "documentId": "uuid",
  "paperId": "uuid",
  "status": "UPLOADED"
}
```

**Errores:**
- 400: No file provided / Only PDF files are allowed
- 413: File too large

---

## Papers

### GET /api/papers/:id
🔒 Requiere autenticación.

Retorna paper con documentos, verificaciones, evidencia, claims y reviews.

---

### POST /api/papers/:id/analyze
🔒 Requiere autenticación.

Ejecuta el pipeline completo de análisis:
1. Verificación con proveedores externos
2. Procesamiento de evidencia
3. Cálculo de Review Priority

**Response 200:**
```json
{
  "paperId": "uuid",
  "status": "COMPLETED",
  "reviewPriority": "HIGH",
  "verificationsCount": 3
}
```

---

### GET /api/papers/:id/report
🔒 Requiere autenticación.

Retorna el reporte completo con paper, verificaciones, evidencia, claims y reviews.

---

### GET /api/papers/:id/evidence
🔒 Requiere autenticación.

Retorna toda la evidencia asociada al paper, ordenada por severidad.

---

## Reviews

### POST /api/papers/:id/review
🔒 Requiere autenticación.

**Body:**
```json
{
  "decision": "REJECT",
  "reason": "Retraction confirmed by external evidence."
}
```

Decisiones válidas: `APPROVE`, `REJECT`, `NEEDS_MORE_REVIEW`
Reason mínimo: 10 caracteres.

El `reviewerId` se obtiene de la sesión autenticada (nunca del frontend).

---

## Audit

### GET /api/papers/:id/audit
🔒 Requiere autenticación.

Retorna el historial de auditoría para un paper.

---

## Admin

### GET /api/admin/users
🔒 Requiere rol ADMIN. Returns 403 para REVIEWER.

### GET /api/admin/audit
🔒 Requiere rol ADMIN. Retorna audit logs globales.

---

## Códigos de Error

| Código | Significado |
|--------|-------------|
| 400 | Validación fallida (body inválido, archivo inválido) |
| 401 | No autenticado |
| 403 | No autorizado (rol insuficiente) |
| 404 | Recurso no encontrado |
| 413 | Archivo demasiado grande |
| 429 | Rate limit excedido |
| 500 | Error interno del servidor |

---

## Señales de Verificación

| Signal | Descripción | Severidades posibles |
|--------|-------------|---------------------|
| SIGNAL-001 | DOI Verification | LOW (verified), HIGH (not found) |
| SIGNAL-002 | Metadata Consistency | LOW (match), MEDIUM/HIGH (mismatch) |
| SIGNAL-003 | Retraction | CRITICAL |
| SIGNAL-004 | Post-publication Update | HIGH (expression of concern), MEDIUM (correction) |
| SIGNAL-005 | Reference Verification | MEDIUM (mismatch) |

---

## Review Priority (Determinístico)

| Condición | Prioridad |
|-----------|-----------|
| Cualquier señal CRITICAL | CRITICAL |
| Cualquier señal HIGH | HIGH |
| Cualquier señal MEDIUM | MEDIUM |
| Solo señales LOW o ninguna | LOW |
