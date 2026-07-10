import {
  parseDocument,
  isMap,
  isSeq,
  isScalar,
  LineCounter,
  YAMLSeq,
  type Document,
} from "yaml";
import type { AnnotationLocation } from "./types.js";

/**
 * A sequence item that look like it's meant to be an annotation call
 * (starts with @identifier(...)), but has NOT been validated or parsed
 * yet. Could still turn out to be malformed - that's parse.ts's job.
 */
export interface AnnotationCandidate {
  /** The full trimmed scalar text, e.g. `@aws-login(region: "eu-west-1")`. */
  raw: string;
  location: AnnotationLocation;
}

/**
 * Loose test: is this worth handing to the parser at all?
 * Deliberately permissive - malformed-but-attempted annotations
 * (missing closing paren, bad params, etc.) MUST still match here,
 * so they reach parse.ts and produce a specific error rather than
 * being silently treated as a plain script line.
 */
const CANDIDATE_PATTERN = /^@[A-Za-z0-9_-]+\(/;

export function looksLikeAnnotationCandidate(trimmed: string): boolean {
  return CANDIDATE_PATTERN.test(trimmed);
}

/**
 * Parses YAML source and returns both the document and the LineCounter
 * needed to resolve node offsets to line/col. Keep these two together -
 * the LineCounter is only meaningful for the exact source it was built from.
 */
export function parseYamlSource(source: string): {
  doc: Document.Parsed;
  lineCounter: LineCounter;
} {
  const lineCounter = new LineCounter();
  const doc = parseDocument(source, { lineCounter, keepSourceTokens: true });
  return { doc, lineCounter };
}

/**
 * Walks a parsed YAML document, finds every `script:` sequence, and returns candidate annotation items within them (scalar items whose
 * ENTIRE trimmed value matches the candidate pattern).
 *
 * Ignores every other part of the document. Non-script sequences are
 * never inspected, even if their items happen to look annotation-like.
 */
export function detectAnnotations(
  doc: Document.Parsed,
  lineCounter: LineCounter,
): AnnotationCandidate[] {
  const out: AnnotationCandidate[] = [];
  walkNode(doc.contents, [], lineCounter, out);
  return out;
}

function walkNode(
  node: unknown,
  path: (string | number)[],
  lineCounter: LineCounter,
  out: AnnotationCandidate[],
): void {
  if (isMap(node)) {
    for (const pair of node.items) {
      const keyStr = isScalar(pair.key) ? String(pair.key.value) : undefined;

      if (keyStr === "script" && isSeq(pair.value)) {
        collectScriptItems(pair.value, [...path, "script"], lineCounter, out);
      } else if (keyStr !== undefined) {
        walkNode(pair.value, [...path, keyStr], lineCounter, out);
      }
      // Non-scalar keys are not expected in GitLab CI YAML; skip descending.
    }
  } else if (isSeq(node)) {
    node.items.forEach((item, idx) => {
      walkNode(item, [...path, idx], lineCounter, out);
    });
  }
  // Scalars outside of a script: sequence are irrelevant to detection.
}

function collectScriptItems(
  seq: YAMLSeq,
  basePath: (string | number)[],
  lineCounter: LineCounter,
  out: AnnotationCandidate[],
): void {
  seq.items.forEach((item: unknown, idx: number) => {
    if (isScalar(item) && typeof item.value === "string") {
      const raw = item.value.trim();

      if (looksLikeAnnotationCandidate(raw)) {
        const offset = item.range ? item.range[0] : 0;
        const pos = lineCounter.linePos(offset);

        out.push({
          raw,
          location: { line: pos.line, col: pos.col, path: [...basePath, idx] },
        });
      }
    }
  });
}
