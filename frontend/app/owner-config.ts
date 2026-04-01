function parseWritableOwnerId(rawValue: string | undefined): number | null {
  if (!rawValue) {
    throw new Error("Writable owner ID is not configured");
  }

  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Writable owner ID must be a positive integer");
  }

  return parsed;
}

export function getWritableOwnerIdFromPublicEnv(): number | null {
  return parseWritableOwnerId(process.env.NEXT_PUBLIC_WRITABLE_OWNER_ID);
}

export function getWritableOwnerIdFromAnyEnv(): number | null {
  return parseWritableOwnerId(
    process.env.WRITABLE_OWNER_ID ?? process.env.NEXT_PUBLIC_WRITABLE_OWNER_ID,
  );
}
