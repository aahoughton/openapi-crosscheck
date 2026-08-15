import { createHash } from "node:crypto";
import type { Case } from "../types/case";

/**
 * A digest of the corpus, so two measurements can be compared honestly.
 *
 * Over the whole case, rather than over the ids alone. An id is a name someone
 * chose and a case can be rewritten under it: a document edited, a request
 * retargeted, an expected verdict flipped. A report joining two runs on case id
 * would then present answers to two different questions as a disagreement
 * between two libraries, which is the misattribution this repository exists to
 * avoid.
 *
 * What it pins is the serialization, which is wider than the questions. Every
 * field is in it, the prose a reader sees and the citations included, so fixing
 * a typo in a case's title moves it and every run before that edit is formally
 * incomparable with every run after. Key order is in it too, `JSON.stringify`
 * being insertion-ordered, so assembling a case object differently moves it
 * with nothing about the corpus having changed.
 *
 * Both are false alarms and the direction is deliberate. A digest that missed a
 * changed question would publish a wrong comparison; one that fires on a
 * changed word produces a refusal somebody reads and dismisses.
 *
 * It is computed where a corpus is measured and nowhere else. Nothing
 * recomputes it from the `corpus.json` sitting beside a measurement, so it
 * records which corpus the harness held at measure time rather than attesting
 * that the questions in a directory are still those. It is also silent about
 * the harness: the splitting rules, the stage gate and the scorer can all move
 * under a digest that holds still.
 *
 * Deterministic, because the gate compares generated artifacts byte for byte:
 * the same corpus always produces the same digest, on any machine and in any
 * run. `JSON.stringify` over the cases in corpus order is enough for that, and
 * corpus order is fixed by `ordering.test.ts`.
 */
export function corpusDigest(cases: readonly Case[]): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(cases)).digest("hex")}`;
}
