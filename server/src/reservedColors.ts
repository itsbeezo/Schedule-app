// Must match client/my_scheduler/src/styles/reservedColors.ts (coral, work-hours light blue, UI purple).
export const RESERVED_COLORS = ['#FF8A5B', '#A8D4FF', '#9B6BFF'];

export function isReservedColor(value: string | null | undefined): boolean {
  return !!value && RESERVED_COLORS.includes(value.trim().toUpperCase());
}
