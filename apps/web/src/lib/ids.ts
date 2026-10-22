/** Client-generated ids make optimistic creation trivial (database-model.md §1). */
export const newId = (): string => crypto.randomUUID();
