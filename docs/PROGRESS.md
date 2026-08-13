# ScientificGuard AI — Progreso de Implementación

## Estado General

| Phase | Descripción | Estado | Tests |
|-------|-------------|--------|-------|
| Phase 0 | Análisis de arquitectura | ✅ Completado | — |
| Phase 1 | Setup del proyecto (monorepo, NestJS, Prisma, shared) | ✅ Completado | — |
| Phase 2 | Autenticación (JWT, cookies, guards, roles) | ✅ Completado | 7 ✅ |
| Phase 3 | Base de datos (schema, migración) | ⚠️ Schema definido, migración pendiente (PostgreSQL no corriendo) | — |
| Phase 4 | PDF Upload + Extracción | ✅ Completado | 10 ✅ |
| Phase 5 | Crossref Provider | ✅ Completado | 10 ✅ |
| Phase 6 | Evidence Engine + Review Priority | ✅ Completado | 8 ✅ |
| Phase 7 | OpenAlex + PubMed | ✅ Completado | 13 ✅ |
| Phase 8 | AI Analysis | 🔲 Pendiente | — |
| Phase 9 | Human Review | 🔲 Pendiente | — |
| Phase 10 | Audit Trail | 🔲 Pendiente | — |
| Phase 11 | Frontend UI | 🔲 Pendiente | — |
| Phase 12 | Testing + Demo + Polish | 🔲 Pendiente | — |

**Total tests: 48 pasando ✅**

---

## Detalle por Phase

### Phase 0 — Análisis de Arquitectura ✅
- Análisis completo de la spec (77 secciones)
- Identificación de riesgos y conflictos
- Propuesta de estructura de repositorio
- Propuesta de schema Prisma
- Definición de interfaces de abstracción
- Plan de implementación aprobado

### Phase 1 — Setup del Proyecto ✅
- Monorepo con npm workspaces configurado
- NestJS backend con todos los módulos stub
- Prisma schema con 9 modelos y enums
- Paquete shared con schemas Zod
- Interfaces VerificationProvider y AIProvider
- Seguridad base (helmet, CORS, throttler, ValidationPipe)
- .env.example y .gitignore actualizados

### Phase 2 — Autenticación ✅
- AuthService: login con Argon2, JWT access/refresh tokens
- AuthController: POST login, logout, refresh + GET me
- JWT Strategy extrayendo token de HttpOnly cookie
- LoginDto con class-validator
- Rate limiting: 5 intentos/min en login
- Cookies Secure + SameSite=strict
- CurrentUser decorator y RolesGuard
- **7 tests unitarios**

### Phase 3 — Base de Datos ⚠️
- Schema Prisma completo y validado
- Prisma client generado
- Seed script con Argon2
- **Pendiente:** ejecutar migración cuando PostgreSQL esté corriendo

### Phase 4 — PDF Upload + Extracción ✅
- DocumentsController: POST /api/documents/upload con JWT guard
- DocumentsService: upload, UUID storage, extracción asíncrona
- PdfExtractorService: texto, páginas, metadata
- DoiExtractorService: DOI y PMID con regex robustos
- ReferenceExtractorService: hasta 20 referencias
- Validación MIME (solo PDF) y tamaño máximo
- **10 tests unitarios (DOI extraction)**

### Phase 5 — Crossref Provider ✅
- CrossrefProvider: verificación DOI, metadata, retracción, post-publication updates
- Validación Zod de respuestas de Crossref
- VerificationService: orquestación con aislamiento de fallos
- Normalización de strings para comparación
- Signals: SIGNAL-001, SIGNAL-002, SIGNAL-003, SIGNAL-004
- **10 tests unitarios**

### Phase 6 — Evidence Engine ✅
- EvidenceService: procesamiento de señales en evidencia
- ReviewPriorityService: cálculo determinístico
- PapersService: orquestación del pipeline completo
- PapersController: GET paper, POST analyze, GET report, GET evidence
- **8 tests unitarios**

### Phase 7 — OpenAlex + PubMed ✅
- OpenAlexProvider: verificación DOI, metadata, retracción (is_retracted flag)
- PubMedProvider: verificación por PMID o búsqueda por DOI, detección retracción vía pubtype
- Validación Zod de respuestas de ambas APIs
- Aislamiento de fallos: un proveedor falla sin detener los demás
- Per spec §13: NOT_FOUND en PubMed no es sospechoso
- VerificationService actualizado con los 3 proveedores
- **6 tests OpenAlex + 7 tests PubMed**

---

## Commits Sugeridos

1. `feat(infra): inicializar arquitectura del proyecto ScientificGuard`
2. `feat(auth): implementar autenticación JWT con HttpOnly cookies`
3. `feat(documents): implementar upload PDF y extracción de metadata`
4. `feat(verification): implementar CrossrefProvider con detección de retracciones`
5. `feat(evidence): implementar Evidence Engine y cálculo determinístico de Review Priority`
6. `feat(verification): implementar OpenAlex y PubMed providers`

---

## Próximos Pasos

1. **Phase 8** — AI Analysis (claims, methodology, Zod validation)
2. **Phase 9** — Human Review (decisiones, ownership)
3. **Phase 10** — Audit Trail (append-only)
4. **Phase 11** — Frontend UI
5. **Phase 12** — Testing + Demo data + Polish

---

## Prerequisitos Pendientes

- [ ] PostgreSQL corriendo en localhost:5432
- [ ] Ejecutar `npx prisma migrate dev --name init` en backend/
- [ ] Ejecutar `npx prisma db seed` para crear usuarios demo
- [ ] Configurar AI_API_KEY en .env para Phase 8
