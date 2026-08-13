# ScientificGuard AI — Señales de Verificación

## Resumen de Señales

| ID | Nombre | Fuente | Severidades |
|----|--------|--------|-------------|
| SIGNAL-001 | DOI Verification | Crossref, OpenAlex | LOW, HIGH |
| SIGNAL-002 | Metadata Consistency | Crossref, OpenAlex | LOW, MEDIUM, HIGH |
| SIGNAL-003 | Retraction | Crossref | CRITICAL |
| SIGNAL-004 | Post-publication Update | Crossref | HIGH, MEDIUM |
| SIGNAL-005 | Reference Verification | Crossref, OpenAlex | MEDIUM |

---

## SIGNAL-001 — DOI Verification

**Propósito:** Verificar que el DOI extraído del PDF existe en fuentes externas.

| Estado | Severidad | Significado |
|--------|-----------|-------------|
| VERIFIED | LOW | DOI encontrado y confirmado |
| NOT_FOUND | HIGH | DOI no existe en la fuente |
| MISMATCH | HIGH | DOI existe pero apunta a otro paper |

---

## SIGNAL-002 — Metadata Consistency

**Propósito:** Comparar metadata extraída del PDF con la registrada en fuentes externas.

Campos comparados: title, authors, year, journal, DOI.

| Resultado | Severidad | Significado |
|-----------|-----------|-------------|
| MATCH | LOW | Todos los campos coinciden |
| PARTIAL_MATCH (1 campo) | MEDIUM | Un campo no coincide |
| MISMATCH (2+ campos) | HIGH | Múltiples campos no coinciden |

**Normalización aplicada:**
- Case insensitive
- Remoción de puntuación
- Normalización de whitespace
- Similitud Jaccard > 0.8 = match

---

## SIGNAL-003 — Retraction

**Propósito:** Detectar si el paper ha sido retractado.

| Estado | Severidad | Acción |
|--------|-----------|--------|
| Retraction detected | CRITICAL | Review Priority → CRITICAL |

**UI dice:** "Retraction signal detected" + "Human review strongly recommended"
**UI NO dice:** "This paper is fraudulent"

La evidencia incluye: source, DOI de la noticia de retracción, fecha.

---

## SIGNAL-004 — Post-publication Update

**Propósito:** Detectar actualizaciones post-publicación (no retracciones).

| Tipo | Severidad |
|------|-----------|
| Expression of concern | HIGH |
| Correction / Erratum | MEDIUM |
| Other updates | MEDIUM |

No todo update es "malo" — las correcciones son normales en ciencia.

---

## SIGNAL-005 — Reference Verification

**Propósito:** Verificar que las referencias citadas existen y son correctas.

MVP: Se verifican hasta 20 referencias.

| Estado | Severidad |
|--------|-----------|
| VERIFIED | — (no genera evidencia) |
| PARTIAL_MATCH | LOW |
| NOT_CONFIDENTLY_MATCHED | MEDIUM |
| MISMATCH | MEDIUM |

---

## Niveles de Confianza de Datos

| Nivel | Significado |
|-------|-------------|
| VERIFIED | Confirmado por fuente externa confiable |
| DETECTED | Señal encontrada en evidencia externa |
| AI_INTERPRETED | Interpretación del AI basada en evidencia |
| PENDING_REVIEW | Certeza insuficiente |
| HUMAN_DECISION | Decisión final del revisor autenticado |

Estos niveles deben ser **visualmente distinguibles** en la UI.

---

## Review Priority (Cálculo Determinístico)

```
if (signals contain CRITICAL) → CRITICAL
else if (signals contain HIGH) → HIGH
else if (signals contain MEDIUM) → MEDIUM
else → LOW
```

**IMPORTANTE:** AI no determina la prioridad final. Solo un humano autenticado toma la decisión de APPROVE/REJECT.
