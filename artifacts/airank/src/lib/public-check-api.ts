import { useMutation, useQuery } from "@tanstack/react-query";
import type {
  PublicCheckProfile, PublicCheckPreview, PublicCheckScore, PublicCheckReport,
  PublicCheckCapabilities, PublicCheckDelivery,
} from "@workspace/api-client-react";

/** Public checker transport is intentionally independent of account cookies and CSRF. */
export interface PublicProfile extends PublicCheckProfile {
  domain: string;
  brand_name: string;
  aliases: string[];
  category_fi: string;
  market: string;
  language: string;
}
export interface PublicPreview extends PublicCheckPreview {
  profile: PublicProfile;
  prompts: string[];
  providers: string[];
  methodology: string;
  preview_hash: string;
  paid_calls: number;
}
export interface PublicScore extends PublicCheckScore {
  value: number | null;
  out_of: number;
  state: string;
  mentions: number;
  valid_answers: number;
  expected_answers: number;
  providers_requested: number;
  providers_measured: number;
  formula: string;
}
export interface PublicReport extends PublicCheckReport {
  id: string;
  domain: string;
  brand_name: string;
  status: "queued" | "running" | "completed" | "partial" | "failed";
  created_at: number;
  finished_at: number | null;
  profile: PublicProfile;
  score: PublicScore;
  prompts: { id: string; sequence: number; text: string }[];
  observations: {
    id: string; prompt_id: string; provider: string; model: string | null;
    status: string; response_text: string | null; brand_mentioned: number;
    citations: { url: string; domain: string; owned?: boolean }[];
  }[];
  providers: {
    provider: string; score: number | null; mentions: number; valid_answers: number;
    expected_answers: number; models: string[]; unavailable_answers: number;
  }[];
  progress: { completed: number; expected: number };
  insight: { kind: "mentions" | "no_mentions" | "insufficient"; mentions: number; valid_answers: number };
  methodology: string;
}
export interface PublicCapabilities extends PublicCheckCapabilities {
  enabled: boolean;
  emailEnabled: boolean;
  marketingEnabled: boolean;
  autofillEnabled: boolean;
  providers: string[];
  promptCount: number;
  markets: { code: string; name: string }[];
  languages: { code: string; name: string }[];
  limits: { guestScansPerDay: number; domainScansPerWeek: number };
}
export interface PublicDelivery extends PublicCheckDelivery {
  requestId: string;
  status: "sending" | "sent" | "failed" | "uncertain" | "delivered" | "bounced";
  marketingStatus: "not_requested" | "pending" | "subscribed" | "failed" | "unavailable";
}
export class PublicCheckError extends Error {
  constructor(public code: string, public status: number) {
    super(code);
  }
}
const prefix = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/public-check/v1`;
async function request<T>(path: string, body?: unknown, token?: string): Promise<T> {
  const response = await fetch(`${prefix}${path}`, {
    method: body === undefined ? "GET" : "POST",
    credentials: "omit",
    headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(token ? { "X-Scan-Token": token } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: "no-store",
    referrerPolicy: "no-referrer",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new PublicCheckError(data?.error?.code ?? "PUBLIC_CHECK_UNAVAILABLE", response.status);
  return data as T;
}
export const usePublicCapabilities = () => useQuery({
  queryKey: ["public-check", "capabilities"], queryFn: () => request<PublicCapabilities>("/capabilities"),
  retry: false, staleTime: 60_000,
});
export const usePreparePublicProfile = () => useMutation({
  mutationFn: (body: { website: string; market: string; language: string }) =>
    request<{ draft: PublicProfile; sources: { url: string }[]; model: string | null }>("/prepare", body),
});
export const usePreviewPublicScan = () => useMutation({
  mutationFn: (body: PublicProfile) => request<PublicPreview>("/preview", body),
});
export const useStartPublicScan = () => useMutation({
  mutationFn: (body: PublicProfile & { preview_hash: string; methodology: string; profile_confirmed: true; submission_id: string }) =>
    request<{ id: string; status: "queued"; scan_token: string }>("/scans", body),
});
export const usePublicScan = (id: string | null, token: string | null) => useQuery({
  queryKey: ["public-check", "scan", id],
  queryFn: () => request<PublicReport>(`/scans/${encodeURIComponent(id!)}`, undefined, token!),
  enabled: Boolean(id && token), retry: false,
  refetchInterval: query => {
    if (query.state.error instanceof PublicCheckError && [401, 403, 404].includes(query.state.error.status)) return false;
    return !query.state.data || ["queued", "running"].includes(query.state.data.status) ? 2500 : false;
  },
});
export const useEmailPublicReport = (id: string | null, token: string | null) => useMutation({
  mutationFn: (body: { email: string; marketingConsent: boolean; locale: "fi" | "en"; resend?: boolean }) =>
    request<PublicDelivery>(`/scans/${encodeURIComponent(id!)}/email`, body, token!),
});
export const usePublicDelivery = (id: string | null, token: string | null) => useQuery({
  queryKey: ["public-check", "delivery", id],
  queryFn: () => request<PublicDelivery>(`/deliveries/${encodeURIComponent(id!)}`, undefined, token!),
  enabled: Boolean(id && token), retry: false,
  refetchInterval: query => ["sending", "sent"].includes(query.state.data?.status ?? "") ? 10_000 : false,
});
export const usePublicReport = (token: string) => useQuery({
  queryKey: ["public-check", "report", token],
  queryFn: () => request<PublicReport>(`/reports/${encodeURIComponent(token)}`),
  enabled: /^[A-Za-z0-9_-]{40,100}$/.test(token), retry: false, staleTime: Infinity,
});
