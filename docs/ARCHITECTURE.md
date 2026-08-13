# Smart Scient Reviewer — Arquitectura del Proyecto

## Visión General

Smart Scient Reviewer es una plataforma de revisión científica asistida por IA. El sistema ayuda a revisores humanos a evaluar papers científicos más rápido proporcionando verificación bibliográfica, detección de retracciones, análisis de claims y una prioridad de revisión calculada determinísticamente.

**Principio core:** AI sugiere. La evidencia respalda. Los humanos deciden.

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Backend | NestJS 11, TypeScript, REST API |
| Base de datos | PostgreSQL 18, Prisma ORM 6 |
| Validación | Zod (shared/runtime), class-validator (DTOs NestJS) |
| Autenticación | JWT en HttpOnly cookies, Argon2, Passport |
| AI | OpenAI (configurable via abstracción) |
| Providers externos | Crossref, OpenAlex, PubMed/NCBI |

---

## Estructura del Repositorio

```
smart-scient-reviewer/
├── app/                          ← Next.js frontend (páginas)
├── components/                   ← Componentes React (por crear)
├── lib/                          ← Utilidades frontend (por crear)
├── backend/                      ← NestJS API
│   ├── src/
│   │   ├── main.ts              ← Bootstrap con seguridad
│   │   ├── app.module.ts        ← Módulo raíz
│   │   ├── prisma/              ← Prisma service (global)
│   │   ├── auth/                ← Autenticación JWT
│   │   ├── users/               ← Gestión de usuarios
│   │   ├── documents/           ← Upload y extracción PDF
│   │   ├── papers/              ← Orquestación de análisis
│   │   ├── verification/        ← Proveedores de verificación
│   │   ├── evidence/            ← Motor de evidencia + Review Priority
│   │   ├── ai/                  ← Análisis AI (abstracción)
│   │   ├── reviews/             ← Decisiones humanas
│   │   └── audit/               ← Trail de auditoría
│   ├── prisma/
│   │   ├── schema.prisma        ← Schema de BD
│   │   └── seed.ts              ← Usuarios demo
│   └── package.json
├── packages/
│   └── shared/                  ← Schemas Zod compartidos
│       └── src/
│           ├── schemas/         ← auth, paper, verification, evidence, ai, review
│           └── types/           ← Enums compartidos
├── docs/                        ← Documentación del proyecto
├── turbo.json                   ← Config Turborepo
├── .env.example                 ← Variables de entorno template
└── package.json                 ← Workspace root
```

---

## Decisiones Arquitectónicas

### 1. Monorepo con npm workspaces
**Decisión:** Mantener el frontend Next.js en la raíz y crear `backend/` y `packages/shared/` como workspaces.
**Razón:** El usuario prefirió no reestructurar el proyecto existente.

### 2. JWT en HttpOnly cookies (no localStorage)
**Decisión:** Access token (15min) + Refresh token (7d) en cookies HttpOnly.
**Razón:** La spec prohibe almacenar tokens en localStorage. Las cookies HttpOnly son inmunes a XSS.

### 3. Argon2 para hashing (no bcrypt)
**Decisión:** Usar Argon2 como algoritmo de hashing.
**Razón:** Recomendado por la spec, más resistente a ataques de hardware especializado.

### 4. Cálculo determinístico de Review Priority
**Decisión:** La prioridad se calcula por lógica backend basada en severidad de señales, nunca por AI.
**Razón:** Spec §27 y §72 — AI puede proporcionar señales pero no determinar la prioridad final.

### 5. Aislamiento de fallos entre proveedores
**Decisión:** Si un proveedor externo falla, los demás continúan. El fallo no se interpreta como sospecha.
**Razón:** Spec §57 — la caída de un proveedor no debe detener el análisis.

### 6. Validación en 3 capas
**Decisión:** Frontend (Zod + React Hook Form) → Backend (class-validator DTOs) → Runtime (Zod para AI/external APIs).
**Razón:** Spec §5, §7, §8 — nunca confiar solo en validación de frontend o tipos de compilación.

---

## Modelo de Base de Datos

```
User ──┬── Review[]
       └── AuditLog[]

Paper ──┬── Document[]
        ├── Verification[]
        ├── Evidence[]
        ├── AIAnalysis[]
        ├── Claim[]
        ├── Review[]
        └── AuditLog[]
```

### Modelos principales:
- **User** — id, name, email, passwordHash, role (REVIEWER/ADMIN), status (ACTIVE/INACTIVE)
- **Paper** — id, title, doi, pmid, journal, publicationYear, authors, analysisStatus, reviewPriority
- **Document** — archivo PDF con metadata de extracción
- **Verification** — resultado de cada proveedor por señal
- **Evidence** — evidencia significativa con severidad
- **AIAnalysis** — resultado del análisis AI (validado con Zod)
- **Claim** — claims extraídos por AI con confidence y supportLevel
- **Review** — decisión humana (APPROVE/REJECT/NEEDS_MORE_REVIEW) con reason obligatoria
- **AuditLog** — registro inmutable de acciones (append-only)

---

## Interfaces de Abstracción

### VerificationProvider
```typescript
interface VerificationProvider {
  readonly name: string;
  verify(input: PaperVerificationInput): Promise<VerificationResult>;
  isAvailable(): Promise<boolean>;
}
```
Implementaciones: CrossrefProvider, OpenAlexProvider, PubMedProvider

### AIProvider
```typescript
interface AIProvider {
  readonly name: string;
  analyzePaper(input: AIAnalysisInput): Promise<AIAnalysisRawResult>;
}
```
Implementación: OpenAIProvider (configurable via env vars)

---

## Pipeline de Análisis

```
PDF Upload → Extraction → DOI/PMID → Verification (Crossref/OpenAlex/PubMed)
                                          ↓
                                    Evidence Engine
                                          ↓
                                    Review Priority (determinístico)
                                          ↓
                                    AI Analysis (claims, methodology)
                                          ↓
                                    Human Review → Audit Trail
```

---

## Seguridad

- Helmet (headers de seguridad)
- CORS configurado con origin específico
- Rate limiting (5 intentos/min en login, 100 req/min global)
- Validación MIME para uploads (solo PDF)
- UUID para nombres de archivo almacenados
- Cookies Secure + SameSite=strict en producción
- Nunca se exponen secrets en frontend
- Audit logs inmutables (append-only)
- Role-based access control (REVIEWER/ADMIN)

---

## Riesgos Identificados

| # | Riesgo | Severidad | Mitigación |
|---|--------|-----------|------------|
| 1 | PDF extraction imprecisa | HIGH | Marcar campos inciertos, no inventar datos |
| 2 | Crossref rate limits | LOW | Parámetro mailto para polite pool, cache demo |
| 3 | AI structured output inválido | HIGH | Zod validation obligatoria, retry 1 vez |
| 4 | APIs externas caídas en demo | HIGH | Cache de resultados para papers demo (§63) |
| 5 | JWT + cookies cross-origin | MEDIUM | Mismo origin en prod o CORS credentials |
| 6 | Tiempo de hackathon | HIGH | Priorización estricta P0/P1/P2 |
