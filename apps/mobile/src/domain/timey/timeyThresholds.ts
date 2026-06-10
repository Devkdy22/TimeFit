export const timeyThresholds = {
  warningEnterBufferMinutes: 3,
  warningExitBufferMinutes: 5,
  urgentEnterBufferMinutes: 0,
  urgentExitBufferMinutes: 2,
  panicMinHoldMs: 10_000,
  reroutingMinHoldMs: 8_000,
  offrouteMinHoldMs: 8_000,
} as const;
