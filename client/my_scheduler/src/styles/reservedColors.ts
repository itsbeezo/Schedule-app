// Must match server/src/reservedColors.ts. Coral (conflicts), light blue (work hours), purple (UI).
export const RESERVED_COLORS: readonly string[] = ['#FF8A5B', '#A8D4FF', '#9B6BFF'];

export function isReservedColor(value: string | null | undefined): boolean {
  return !!value && RESERVED_COLORS.includes(value.trim().toUpperCase());
}
