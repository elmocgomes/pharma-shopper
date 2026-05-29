import type { PersonaProfile, ConversationContext, MessageType } from "./types.js";

export function buildPersonaSystemPrompt(persona: PersonaProfile, scenario: string): string {
  const styleGuide: Record<string, string> = {
    formal:
      "Fale de forma educada e formal. Use 'senhor/senhora', frases completas, pontuação correta. " +
      "Cumprimente com 'Bom dia/Boa tarde'. Não use gírias ou abreviações.",
    casual:
      "Fale de forma casual e descontraída. Use abreviações (vc, tb, pq, td bem), gírias comuns. " +
      "Cumprimente com 'Oi' ou 'E aí'. Pode usar emojis ocasionalmente.",
    anxious:
      "Fale com certa urgência e ansiedade. Faça perguntas extras, demonstre preocupação. " +
      "Use '!' e '...' com frequência. Mostre que precisa muito do medicamento.",
  };

  return [
    `Você é ${persona.name}`,
    persona.ageRange ? `${persona.ageRange} anos` : null,
    persona.gender === "F" ? "mulher" : persona.gender === "M" ? "homem" : null,
    persona.occupation ? persona.occupation : null,
  ]
    .filter(Boolean)
    .join(", ") +
    ".\n\n" +
    (styleGuide[persona.communicationStyle] || styleGuide.casual) +
    "\n\n" +
    `Cenário: ${scenario}\n\n` +
    "REGRAS IMPORTANTES:\n" +
    "- Você está enviando mensagem pelo WhatsApp para uma farmácia\n" +
    "- Nunca revele que é um robô ou que está fazendo pesquisa de preços\n" +
    "- Aja naturalmente como um cliente real buscando medicamentos\n" +
    "- Seja breve — mensagens de WhatsApp são curtas\n" +
    "- Responda APENAS com a mensagem, sem aspas, sem explicações extras";
}

export function buildMessagePrompt(
  type: MessageType,
  ctx: ConversationContext,
): string {
  const products = ctx.productNames.join(", ");

  switch (type) {
    case "greeting":
      return (
        `Escreva uma mensagem de primeiro contato para a farmácia "${ctx.pharmacyName}"` +
        (ctx.pharmacyCity ? ` em ${ctx.pharmacyCity}/${ctx.pharmacyState}` : "") +
        `. Você quer saber se eles têm e quanto custa: ${products}. ` +
        "Cumprimente e pergunte sobre o(s) produto(s) na mesma mensagem."
      );

    case "inquiry":
      return (
        `Pergunte diretamente sobre preço e disponibilidade de: ${products}. ` +
        "Seja direto mas educado."
      );

    case "follow_up":
      return (
        "A farmácia respondeu mas não deu informação completa (preço ou disponibilidade). " +
        `Pergunte novamente especificamente sobre o que faltou para: ${products}. ` +
        "Seja educado e breve."
      );

    case "thank_you":
      return (
        "A farmácia forneceu as informações. Agradeça de forma natural e encerre a conversa."
      );
  }
}

export function buildParseSystemPrompt(): string {
  return (
    "Você é um extrator de dados de mensagens de farmácia. " +
    "Analise a resposta da farmácia e extraia informações de preço e disponibilidade.\n\n" +
    "FORMATOS COMUNS DE PREÇO BR:\n" +
    "- R$ 25,90 / R$25.90 / 25 reais / 25,90\n" +
    "- 'tem sim' = in_stock, 'temos' = in_stock\n" +
    "- 'em falta' = out_of_stock, 'não temos' = out_of_stock\n" +
    "- 'encomenda' = on_order, 'pedido' = on_order\n\n" +
    "Use a ferramenta extract_prices para retornar os dados estruturados."
  );
}

export function buildParseUserPrompt(
  pharmacyResponse: string,
  requestedProducts: string[],
): string {
  return (
    `Produtos solicitados: ${requestedProducts.join(", ")}\n\n` +
    `Resposta da farmácia:\n"${pharmacyResponse}"\n\n` +
    "Extraia preço e disponibilidade de cada produto mencionado."
  );
}

export function pickScenario(persona: PersonaProfile): string {
  const templates = persona.scenarioTemplates;
  if (templates.length === 0) return "Preciso comprar um medicamento";
  return templates[Math.floor(Math.random() * templates.length)];
}
