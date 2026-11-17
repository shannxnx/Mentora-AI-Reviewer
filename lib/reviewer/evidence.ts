/** A complete short fact or a substantial verbatim excerpt can serve as a source citation. */
export function hasSupportingPassage(facts: string[], evidence: string) {
  const quote = evidence.trim().replace(/\s+/gu, " ");
  if (!/[\p{L}\p{N}]/u.test(quote)) return false;
  return facts.some(value => {
    const fact = value.trim().replace(/\s+/gu, " ");
    return fact === quote || (quote.length >= 16 && fact.includes(quote));
  });
}
