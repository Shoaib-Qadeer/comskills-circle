// Tiny helpers that are safe to import from both server and client components.
export function firstName(name: string): string {
  return name.split(/\s+/)[0] || name;
}
