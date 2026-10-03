const RealDate = Date;
const FIXED_NOW_MS = RealDate.parse("2026-10-01T00:00:00.000Z");

class FixedDate extends RealDate {
  constructor(...args) {
    if (args.length === 0) {
      super(FIXED_NOW_MS);
      return;
    }
    super(...args);
  }

  static now() {
    return FIXED_NOW_MS;
  }
}

// domain-check contains service-date scenarios whose meaning must not change
// with the wall clock. Keep production code on the real clock and freeze only
// this isolated test process before importing the checks.
globalThis.Date = FixedDate;

await import("./domain-check.mjs");
