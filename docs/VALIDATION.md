# Smart Scient Reviewer — Estrategia de Validación

## Principio

> Todo input no validado es untrusted. Esto incluye input de usuario, respuestas de APIs externas y outputs de LLMs.

---

## Capas de Validación

### 1. Frontend (Zod + React Hook Form)
- Validación de formularios en tiempo real
- Schemas compartidos desde `@scientificguard/shared`
- **No es suficiente** — el backend valida independientemente

### 2. Backend DTOs (class-validator + class-transformer)
- `ValidationPipe` global con:
  - `whitelist: true` — remueve propiedades no declaradas
  - `forbidNonWhitelisted: true` — rechaza propiedades extra
  - `transform: true` — transforma tipos automáticamente
- Cada endpoint tiene su DTO

### 3. Runtime Validation (Zod)
- **Respuestas de APIs externas** (Crossref, OpenAlex, PubMed)
- **Outputs de AI** (CRÍTICO — cada respuesta LLM se valida)
- Si la validación falla → `ERROR` o `AI_ANALYSIS_ERROR`
- Nunca se "repara" información científica faltante inventando valores

---

## Flujos de Validación

### Input de Usuario
```
Form Input → Zod (frontend) → HTTP → class-validator (backend) → Business Logic → Prisma
```

### API Externa
```
External API → fetch → JSON → Zod safeParse → Valid? → Normalized Result
                                              Invalid? → VerificationStatus.ERROR
```

### AI Output
```
LLM → Raw response → Zod safeParse → Valid? → Continue pipeline
                                      Invalid? → AI_ANALYSIS_ERROR / PENDING_REVIEW
```

---

## Schemas Compartidos (packages/shared)

| Schema | Ubicación | Uso |
|--------|-----------|-----|
| loginSchema | schemas/auth | Frontend form + referencia |
| userResponseSchema | schemas/auth | Respuesta de auth |
| paperResponseSchema | schemas/paper | Respuesta de paper |
| documentUploadResponseSchema | schemas/paper | Respuesta de upload |
| verificationResultSchema | schemas/verification | Resultado normalizado |
| referenceVerificationSchema | schemas/verification | Verificación de referencia |
| evidenceSchema | schemas/evidence | Evidencia con trust level |
| aiClaimSchema | schemas/ai | Claim extraído por AI |
| aiMethodologySignalSchema | schemas/ai | Señal de metodología |
| aiAnalysisOutputSchema | schemas/ai | Output completo AI (validación CRÍTICA) |
| createReviewSchema | schemas/review | Input de decisión humana |

---

## Reglas de AI Output

1. **SIEMPRE** validar con `aiAnalysisOutputSchema.safeParse()` antes de usar
2. Si `safeParse` falla → estado `AI_ANALYSIS_ERROR`, nunca inventar datos
3. AI **NUNCA** produce: APPROVED, REJECTED, VALID, INVALID, FAKE, FRAUDULENT
4. AI **PUEDE** producir: LOW_PRIORITY, MEDIUM_PRIORITY, HIGH_PRIORITY, REVIEW_RECOMMENDED
5. Si AI no puede determinar algo → `PENDING_REVIEW` o `UNCERTAIN`

---

## Validación de Archivos

- MIME type: solo `application/pdf`
- Tamaño máximo: configurable (default 20MB)
- Nombre almacenado: UUID (nunca el nombre original)
- Nunca ejecutar archivos subidos
