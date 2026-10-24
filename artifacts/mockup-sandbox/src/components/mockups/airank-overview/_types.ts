export type Point = { date: string } & Record<string, number | null | string>;
export type Series = { key: string; label: string; color: string; dash?: string };
