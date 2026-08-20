import { isSeq, type Document } from "yaml";
import type { ExpansionSuccess } from "../expand/expand.js";

export function applyExpansions(
  doc: Document.Parsed,
  successes: ExpansionSuccess[],
): void {
  const groups = new Map<string, ExpansionSuccess[]>();

  for (const success of successes) {
    const parentPath = success.location.path.slice(0, -1);
    const key = JSON.stringify(parentPath);
    const existing = groups.get(key);

    if (existing) {
      existing.push(success);
    } else {
      groups.set(key, [success]);
    }
  }

  for (const [key, group] of groups) {
    const parentPath = JSON.parse(key) as (string | number)[];
    const seq = doc.getIn(parentPath);

    if (!isSeq(seq)) {
      throw new Error(
        `applyExpansions: expected a YAML sequence at path ${key}, found something else. This indicates a bug in detection/location tracking, not a user-facing error.`,
      );
    }

    // Descending index order within this group so earlier splices never invalidate later ones in the same sequence.
    const sorted = [...group].sort((a, b) => {
      const idxA = a.location.path[a.location.path.length - 1] as number;
      const idxB = b.location.path[b.location.path.length - 1] as number;
      return idxB - idxA;
    });

    for (const success of sorted) {
      const idx = success.location.path[
        success.location.path.length - 1
      ] as number;
      const newNodes = success.resolvedLines.map((line) =>
        doc.createNode(line),
      );
      seq.items.splice(idx, 1, ...newNodes);
    }
  }
}
