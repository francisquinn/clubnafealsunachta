// Supabase's embedded-relation typing returns either a single object or an
// array depending on how it infers the FK's cardinality. This normalizes
// either shape to a single row (or null), so callers don't each re-implement
// the same ternary.
export function unwrapRelation<T>(relation: T | T[] | null | undefined): T | null {
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }
  return relation ?? null;
}
