export function reasons<T extends { name: string }>(rows: readonly T[]): T[];
export function format(text: string, values: readonly string[]): string;
export function text(source: string, values?: readonly string[]): string;
export function message<T>(value: T): T extends string ? string : T;
export function matchParts(value: string, parts: readonly string[]): string[] | null;
