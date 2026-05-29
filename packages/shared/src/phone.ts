const BR_COUNTRY_CODE = "55";
const BR_PHONE_REGEX = /^(?:\+?55)?(\d{2})(\d{8,9})$/;

export function toE164BR(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  const match = digits.match(BR_PHONE_REGEX);
  if (!match) return null;

  const [, ddd, number] = match;
  return `+${BR_COUNTRY_CODE}${ddd}${number}`;
}

export function toWhatsAppJid(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `${digits}@s.whatsapp.net`;
}

export function fromWhatsAppJid(jid: string): string {
  return `+${jid.replace("@s.whatsapp.net", "").replace("@g.us", "")}`;
}
