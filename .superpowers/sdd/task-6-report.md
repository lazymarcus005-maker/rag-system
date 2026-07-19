# Task 6 Report: Embedding-dimension validation probe

## Status
Complete.

## TDD Evidence

### RED
Initial test run (no `onModuleInit`):
```
error TS2339: Property 'onModuleInit' does not exist on type 'OllamaService'.
Test Suites: 1 failed, 1 total
Tests:       0 total
```

### GREEN (after implementation)
```
PASS src/llm/ollama.service.spec.ts
  OllamaService.onModuleInit
    √ throws when embedding dimension does not match EMBEDDING_DIM (24 ms)
    √ does not throw when dimensions match (2 ms)
    √ warns and continues when Ollama is unreachable (embed rejects) (1 ms)
    √ defaults EMBEDDING_DIM to 1024 when not set (1 ms)
Tests:       4 passed, 4 total
```

### Full suite
```
Test Suites: 10 passed, 10 total
Tests:       57 passed, 57 total
```
(53 existing + 4 new = 57 ✓)

### Build
`npm run build` — clean, no output.

## Files Changed
- Modified: `api/src/llm/ollama.service.ts`
  - Added `Logger, OnModuleInit` to imports.
  - `implements OnModuleInit`.
  - Added `embeddingDim` and `logger` fields.
  - Added `onModuleInit()` probing `embed(['dimension check'])`.
- Created: `api/src/llm/ollama.service.spec.ts` (4 tests, verbatim from brief).

## Commit
- SHA: `a75307bd283ca9d27e413c9215d3b1a6abf94175`
- Subject: `feat(llm): validate embedding dimension at startup`

## Self-Review Findings

- ✅ `OnModuleInit` implemented; probes `embed(['dimension check'])` at startup.
- ✅ Mismatch throws with message containing both dims (regex `/EMBEDDING_DIM.*1024.*768/` matches).
- ✅ Unreachable path warns via `logger.warn` and continues (no throw).
- ✅ Default `EMBEDDING_DIM=1024` works (test 4 passes with empty config).
- ✅ 4 tests pass; full suite 57/57; build clean.
- ✅ No comments added.

### Deviation from brief
The brief's error message string was:
```
`Embedding dimension mismatch: Ollama model "${this.embedModel}" returned ${probe.length}-dim vectors but EMBEDDING_DIM=${this.embeddingDim}. ...`
```
This emits `768` before `1024`, which fails the brief's own test regex `/EMBEDDING_DIM.*1024.*768/`. The test is authoritative in TDD, so the message was reordered to:
```
`Embedding dimension mismatch: EMBEDDING_DIM=${this.embeddingDim} but Ollama model "${this.embedModel}" returned ${probe.length}-dim vectors. ...`
```
This preserves all information (both dims, model name, guidance) and satisfies the test.

## Concerns
None. The brief's error message and test regex were internally inconsistent; resolved in favor of the test per TDD.