// Shared by importParser.ts (classifying rows as they're imported) and
// repository.ts (reclassifyOrderStatusFromRemarks — fixing already-imported
// records whose remark text contradicts their stored Order Placed / Order
// In Process flags). Kept in its own module so neither of those two files
// has to import the other.

const NA_UPPER = 'N/A';

/**
 * Infers the deal outcome from a free-text buyer remark. Priority (checked
 * in this order):
 *
 *   1. An explicit "MoU signed" mention, or a clearly negative outcome
 *      ("not interested", "no response", "not buying") — left alone under
 *      MoU Signed only, not reclassified as Order Placed/In Process.
 *   2. Definitive completed-order language ("order placed", "PO issued",
 *      "goods supplied", "delivered", "shipped", "dispatched") — Order
 *      Placed. A negated form of these ("not yet supplied", "will be
 *      delivered") is excluded so pending fulfillment isn't misread as done.
 *   3. Ongoing-engagement language (discussion, negotiation, sample
 *      requests, testing, "will place"/"going to place") — Order In Process.
 *   4. Nothing recognizable — left as-is (no inferred change).
 *
 * Deliberately conservative: a remark with no match changes nothing rather
 * than guessing, and "will/going to place" (future intent) is distinguished
 * from "placed" (past tense) so hopeful language doesn't get counted as a
 * completed order.
 */
export function classifyOutcomeFromRemark(remark: string): 'placed' | 'inProcess' | 'mouOnly' | 'none' {
  const t = remark.trim().toLowerCase();
  if (!t || t === NA_UPPER.toLowerCase()) return 'none';

  const hasMou = /\bmou\b/.test(t);
  const hasSign = /\bsign/.test(t);
  const negativeOutcome = /not interested|no response|not\s+respond|not buying/.test(t);
  if ((hasMou && hasSign) || negativeOutcome) return 'mouOnly';

  // A negated/future form of a completion word ("not yet supplied", "will
  // be delivered", "to be shipped") means fulfillment hasn't happened yet —
  // checked before the positive match below so it isn't misread as done.
  const completionNegatedRe = /\b(not|yet to|to be|will be|going to be|hasn't been|has not been|haven't been)\s+(\w+\s+){0,2}(supplied|delivered|shipped|dispatched|fulfilled)\b/;
  const placedRe = /\bplaced\b(?:\s+\w+){0,3}\s*\border\b|\border\b(?:\s+\w+){0,2}\s*\bplaced\b|\bpo\s*(raised|issued)\b|purchase\s*order[\s\S]{0,20}(placed|raised|issued)|\b(goods?|good)\s*supplied\b|\bsupplied\b|\bdelivered\b|\bdispatched\b|\bshipped\b|order\s*(completed|fulfilled|received)/;
  if (placedRe.test(t) && !completionNegatedRe.test(t)) return 'placed';

  const inProcessRe = /discuss|negoti|cuss?ion|\bsample|testing|\btest\b|\breview\b|going\s*to\s*place|will\s+(?:be\s+)?place|expect(ing)?\s*to\s*place|awaiting|waiting\s*for|in\s*touch|working\s*with|expected\s*by|shortly|shorty/;
  if (inProcessRe.test(t)) return 'inProcess';

  return 'none';
}
