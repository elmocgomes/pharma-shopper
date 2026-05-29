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
    return this.request<WaQrResult>("/session/start", {
      method: "POST",
      body: JSON.stringify({ session: sessionId }),
    });
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
