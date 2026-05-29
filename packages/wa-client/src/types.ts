export interface WaSession {
  session: string;
  status: "connecting" | "connected" | "disconnected";
  details?: {
    name?: string;
    phoneNumber?: string;
  };
}

export interface WaSessionDetail {
  session: string;
  status: string;
  details: {
    name: string;
    phoneNumber: string;
  };
  connection: {
    isConnected: boolean;
    lastUpdate: string;
  };
  metadata: {
    platform: string;
    deviceManufacturer: string;
    deviceModel: string;
  };
}

export interface WaSendResult {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  status: number;
}

export interface WaQrResult {
  qr?: string;
  data?: { message: string };
}

export interface WaWebhookMessage {
  session: string;
  from: string | null;
  message: string | null;
  media: {
    image: string | null;
    video: string | null;
    document: string | null;
    audio: string | null;
  };
}

export interface WaWebhookSession {
  session: string;
  status: "connecting" | "connected" | "disconnected";
}
