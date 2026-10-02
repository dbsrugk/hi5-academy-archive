export function useTheme() {
  const dark = typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  return { theme: dark ? "dark" : "light", resolvedTheme: dark ? "dark" : "light", setTheme: () => undefined };
}
export function ThemeProvider({ children }: { children: React.ReactNode }) { return <>{children}</>; }
