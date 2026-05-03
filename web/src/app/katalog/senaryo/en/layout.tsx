/**
 *  English locale layout — renders children inside a `<div lang="en">` wrapper.
 *
 *  The root `<html lang="tr">` causes CSS `text-transform: uppercase` to use
 *  Turkish casing rules, turning lowercase `i` into `İ` (dotted capital). For
 *  these English-only senaryo pages we override with element-level `lang="en"`
 *  so uppercase produces ASCII `I`. CSS spec respects nearest `lang`.
 */
export default function EnLayout({ children }: { children: React.ReactNode }) {
  return <div lang="en">{children}</div>;
}
