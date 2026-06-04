/**
 * Simple class name combiner (replaces clsx + tailwind-merge).
 * Joins truthy class strings with a space.
 */
export function cn(...inputs: (string | undefined | null | false)[]): string {
  return inputs.filter(Boolean).join(" ");
}
