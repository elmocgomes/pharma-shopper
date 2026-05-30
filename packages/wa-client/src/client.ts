import type {
  WaSession,
  WaSessionDetail,
  WaSendResult,
  WaQrResult,
} from "./types.js";

export interface WaClientConfig {
  baseUrl: string;
  apiKey?: string;
}

export class WaClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: WaClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.apiKey = config.apiKey || "";
  }

  private async request<T>(
    path: string,
    options?: RequestInit,
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey ? { key: this.apiKey } : {}),
        ...options?.headers,
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`wa-gateway ${res.status}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  async listSessions(): Promise<WaSession[]> {
    const res = await this.request<{ data: WaSession[] }>("/session");
    return res.data;
  }

  async getSession(sessionId: string): Promise<WaSessionDetail> {
    const res = await this.request<{ data: WaSessionDetail }>(
      `/session/${sessionId}`,
    );
    return res.data;
  }

  async startSession(
    sessionId: string,
  ): Promise<WaQrResult> {
    // wa-gateway wraps response in { data: ... } like other endpoints
    // but the QR may be at top-level or nested — handle both
    const raw = await this.request<any>("/session/start", {
      method: "POST",
      body: JSON.stringify({ session: sessionId }),
    });
    // If response has { data: { qr: "..." } }, unwrap it
    if (raw?.data?.qr) {
      return { qr: raw.data.qr };
    }
    // If response has { qr: "..." } directly
    if (raw?.qr) {
      return { qr: raw.qr };
    }
    // Return whatever we got
    return raw as WaQrResult;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.request(`/session/${sessionId}`, { method: "DELETE" });
  }

  async logoutSession(sessionId: string): Promise<void> {
    await this.request("/session/logout", {
      method: "POST",
      body: JSON.stringify({ session: sessionId }),
    });
  }

  async sendText(
    sessionId: string,
    to: string,
    text: string,
    isGroup?: boolean,
  ): Promise<WaSendResult> {
    const res = await this.request<{ data: WaSendResult }>(
      "/message/send-text",
      {
        method: "POST",
        body: JSON.stringify({ session: sessionId, to, text, is_group: isGroup }),
      },
    );
    return res.data;
  }

  async sendImage(
    sessionId: string,
    to: string,
    text: string,
    imageUrl: string,
    isGroup?: boolean,
  ): Promise<WaSendResult> {
    const res = await this.request<{ data: WaSendResult }>(
      "/message/send-image",
      {
        method: "POST",
        body: JSON.stringify({
          session: sessionId,
          to,
          text,
          image_url: imageUrl,
          is_group: isGroup,
        }),
      },
    );
    return res.data;
  }

  async sendDocument(
    sessionId: string,
    to: string,
    text: string,
    documentUrl: string,
    documentName: string,
    isGroup?: boolean,
  ): Promise<WaSendResult> {
    const res = await this.request<{ data: WaSendResult }>(
      "/message/send-document",
      {
        method: "POST",
        body: JSON.stringify({
          session: sessionId,
          to,
          text,
          document_url: documentUrl,
          document_name: documentName,
          is_group: isGroup,
        }),
      },
    );
    return res.data;
  }

  /**
   * Download media (image/video/audio/document) from wa-gateway.
   * Returns the raw Buffer and content type.
   */
  async downloadMedia(
    mediaUrl: string,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    // mediaUrl from wa-gateway webhook is usually a full URL or relative path
    const url = mediaUrl.startsWith("http")
      ? mediaUrl
      : `${this.baseUrl}${mediaUrl}`;

    const res = await fetch(url, {
      headers: this.apiKey ? { key: this.apiKey } : {},
    });

    if (!res.ok) {
      throw new Error(`wa-gateway media download ${res.status}: ${await res.text()}`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") || "image/jpeg";
    return { buffer, contentType };
  }

  async checkNumberExists(
    sessionId: string,
    target: string,
  ): Promise<boolean> {
    try {
      await this.request("/profile", {
        method: "POST",
        body: JSON.stringify({ session: sessionId, target }),
      });
      return true;
    } catch {
      return false;
    }
  }
}
