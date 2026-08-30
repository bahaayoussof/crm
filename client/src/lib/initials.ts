/**
 * First letters of the first two words of a name, uppercased. Falls back to the
 * first two characters of a single-word name, or "U" when there is no name.
 * Shared by the sidebar user menu and the profile hero avatar.
 */
export function initialsOf(name: string | null | undefined): string {
  if (!name) return "U";
  const parts = name.split(" ").filter(Boolean);
  const fromWords = parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return fromWords || name.slice(0, 2).toUpperCase() || "U";
}
