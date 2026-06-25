import type { ApiCallLog } from "./types";

// Mock API layer. Instead of calling real external services, each "call" looks up
// a deterministic response from the active scenario fixture and records an
// ApiCallLog entry so the backend console can replay the exact sequence.

export class MockApiClient {
  private api: Record<string, unknown>;
  private nowIso: string;
  public log: ApiCallLog[] = [];
  private seq = 0;

  constructor(api: Record<string, unknown>, nowIso: string) {
    this.api = api;
    this.nowIso = nowIso;
  }

  call(endpoint: string, request: Record<string, unknown>, relatedRules: string[] = []): unknown {
    this.seq += 1;
    const response = this.api[endpoint] ?? { error: "NO_FIXTURE", message: `No mock response configured for ${endpoint}` };
    const entry: ApiCallLog = {
      id: `api_${this.seq}`,
      endpoint,
      request,
      response,
      relatedRules,
      timestamp: this.nowIso,
    };
    this.log.push(entry);
    return response;
  }

  attachNormalized(endpoint: string, normalized: unknown) {
    const entry = [...this.log].reverse().find((l) => l.endpoint === endpoint);
    if (entry) entry.normalized = normalized;
  }
}

// Catalogue of all mock endpoints (for documentation / UI listing).
export const MOCK_ENDPOINTS = [
  "GST Detailed III",
  "GST Details Advanced",
  "PAN to GST Detailed",
  "PAN to CIN",
  "CIN Detailed",
  "DIN Detailed",
  "Proprietor Detailed",
  "Udyam Verification",
  "FSSAI License Verification",
  "Import Export Code Verification",
  "TAN Detail",
  "Employer EPFO",
  "Company Name to GST",
  "Mobile to GST",
  "Mobile to Udyam",
];
