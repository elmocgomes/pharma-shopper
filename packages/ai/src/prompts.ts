import type { PersonaProfile, ConversationContext, MessageType, ConversationPhase } from "./types.js";

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
    "- Responda APENAS com a mensagem, sem aspas, sem explicações extras\n" +
    "- NÃO pergunte sobre genéricos ou alternativas na primeira mensagem — apenas pergunte sobre o produto específico\n" +
    (persona.cpf
      ? `- Se a farmácia pedir CPF para desconto ou cadastro, forneça: ${persona.cpf}\n`
      : "- Se a farmácia pedir CPF, diga que não tem em mãos no momento\n") +
    "- Se a farmácia enviar uma foto, analise o conteúdo e extraia as informações sobre o(s) produto(s)";
}

export function buildMessagePrompt(
  type: MessageType,
  ctx: ConversationContext,
): string {
  const productDescriptions = ctx.products.map((p) => {
    const parts = [p.name];
    if (p.presentation) parts.push(p.presentation);
    return parts.join(" ");
  });
  const products = productDescriptions.join(", ");

  // Backward compat: use productNames if products array is empty
  const productList = products || (ctx.productNames?.join(", ") ?? "");

  switch (type) {
    case "greeting":
      return buildPhase1Greeting(productList, ctx);

    case "inquiry":
      return (
        `Pergunte diretamente sobre preço e disponibilidade de: ${productList}. ` +
        "Seja direto mas educado. NÃO mencione genéricos ou alternativas."
      );

    case "follow_up":
      return buildFollowUpPrompt(productList, ctx);

    case "phase2_probe":
      return buildPhase2Probe(productList, ctx);

    case "cpf_response":
      return buildCpfResponse(ctx);

    case "thank_you":
      return "A farmácia forneceu as informações. Agradeça de forma natural e encerre a conversa.";
  }
}

function buildPhase1Greeting(products: string, ctx: ConversationContext): string {
  return (
    `Escreva uma mensagem de primeiro contato para a farmácia "${ctx.pharmacyName}"` +
    (ctx.pharmacyCity ? ` em ${ctx.pharmacyCity}/${ctx.pharmacyState}` : "") +
    `. Você quer saber se eles têm e quanto custa: ${products}.\n\n` +
    "IMPORTANTE:\n" +
    "- Cumprimente e pergunte sobre o(s) produto(s) ESPECÍFICO(S) na mesma mensagem\n" +
    "- Pergunte o nome exato do produto (marca de referência)\n" +
    "- Pergunte o preço\n" +
    "- NÃO pergunte sobre genéricos, similares ou alternativas agora\n" +
    "- NÃO use a palavra 'genérico' nem 'alternativa'\n" +
    "- Seja natural, como um cliente que quer aquele produto específico"
  );
}

function buildFollowUpPrompt(products: string, ctx: ConversationContext): string {
  if (ctx.phase === "phase2_alternatives") {
    return (
      "A farmácia respondeu sobre alternativas/genéricos mas não deu informação completa " +
      "(preço, disponibilidade ou dosagem). " +
      "Pergunte novamente especificamente sobre o que faltou. Seja educado e breve."
    );
  }

  return (
    "A farmácia respondeu mas não deu informação completa (preço ou disponibilidade) " +
    `sobre: ${products}. ` +
    "Pergunte novamente especificamente sobre o que faltou. " +
    "NÃO pergunte sobre genéricos ou alternativas ainda. Seja educado e breve."
  );
}

function buildPhase2Probe(products: string, ctx: ConversationContext): string {
  // Randomly pick one of several natural ways to ask about alternatives
  const probeStyles = [
    `Agora pergunte se eles têm a versão genérica de ${products}. ` +
    "Pergunte naturalmente, como um cliente que quer uma opção mais acessível. " +
    "Algo como 'E vocês têm genérico?' ou 'Tem opção mais em conta?'",

    `Pergunte se existe uma alternativa mais barata para ${products}. ` +
    "Seja casual, como quem está considerando as opções. " +
    "Algo como 'E tem uma opção mais em conta?' ou 'Tem similar?'",

    `Pergunte sobre genérico ou similar de ${products}. ` +
    "Pergunte naturalmente, como se fosse uma reflexão. " +
    "Algo como 'Hmm, e genérico, vocês têm?' ou 'E o similar, tem? Quanto fica?'",
  ];

  const style = probeStyles[Math.floor(Math.random() * probeStyles.length)];

  return (
    style + "\n\n" +
    "IMPORTANTE:\n" +
    "- Pergunte APENAS sobre genérico/similar/alternativa\n" +
    "- Pergunte também o preço da alternativa\n" +
    "- Seja breve — é uma mensagem de WhatsApp\n" +
    "- Se já sabe o preço do produto de referência, pode comparar brevemente"
  );
}

function buildCpfResponse(ctx: ConversationContext): string {
  return (
    "A farmácia pediu o CPF (para programa de desconto, cadastro, ou consulta de preço). " +
    "Responda naturalmente fornecendo o CPF. " +
    "Algo como 'Claro, é [CPF]' ou 'Meu CPF é [CPF]'. " +
    "Seja breve e natural. Depois de dar o CPF, pergunte novamente sobre preço/disponibilidade se necessário."
  );
}

// --- Parsing prompts ---

export function buildParseSystemPrompt(phase: ConversationPhase): string {
  const basePrompt =
    "Você é um extrator de dados de conversas com farmácias brasileiras. " +
    "Analise a resposta da farmácia e extraia informações detalhadas.\n\n" +
    "FORMATOS COMUNS DE PREÇO BR:\n" +
    "- R$ 25,90 / R$25.90 / 25 reais / 25,90\n" +
    "- 'tem sim' = in_stock, 'temos' = in_stock\n" +
    "- 'em falta' = out_of_stock, 'não temos' = out_of_stock\n" +
    "- 'encomenda' = on_order, 'pedido' = on_order\n\n" +
    "DADOS FARMACÊUTICOS A EXTRAIR:\n" +
    "- Dosagem: 50mg, 500mg, 25mg/5ml, etc.\n" +
    "- Quantidade: 30 comprimidos, 60cp, 1 frasco 120ml, caixa com 20, etc.\n" +
    "- Apresentação: comprimido, cápsula, suspensão, pomada, creme, solução, gotas, etc.\n" +
    "- Princípio ativo: se mencionado\n" +
    "- Marca vs genérico: se é marca de referência, genérico ou similar\n\n" +
    "DETECÇÃO DE CPF:\n" +
    "- Se a farmácia pedir CPF (ex: 'preciso do cpf', 'qual seu cpf', 'cpf pra ver o desconto'), marque cpfRequested = true\n" +
    "- Pedidos de CPF são comuns em programas de desconto (Farmácia Popular, etc.)\n\n" +
    "IMAGENS:\n" +
    "- Se o texto contém '[Imagem: ...]' é a descrição de uma foto enviada pela farmácia\n" +
    "- Extraia informações de produto, preço e disponibilidade da descrição da imagem\n" +
    "- Fotos geralmente mostram prateleiras, embalagens com preços, ou telas de sistema\n\n";

  if (phase === "phase1_branded") {
    return (
      basePrompt +
      "CONTEXTO: Esta é a resposta à PRIMEIRA pergunta, onde perguntamos sobre um produto ESPECÍFICO (marca).\n" +
      "ATENÇÃO ESPECIAL: Verifique se a farmácia ESPONTANEAMENTE mencionou alternativas, genéricos ou similares.\n" +
      "- Se a farmácia disse algo como 'temos o de marca e também o genérico por X' → substitution_type = 'spontaneous'\n" +
      "- Se a farmácia só falou do produto que pedimos → substitution_type = 'requested'\n" +
      "- spontaneousSubstitution = true se QUALQUER alternativa foi oferecida sem ser pedida\n\n" +
      "Use a ferramenta extract_pharmacy_data para retornar os dados estruturados."
    );
  }

  return (
    basePrompt +
    "CONTEXTO: Esta é a resposta à SEGUNDA pergunta, onde perguntamos explicitamente sobre genéricos/alternativas.\n" +
    "- Produtos mencionados aqui têm substitution_type = 'prompted'\n" +
    "- Se a farmácia disse que não tem alternativa → substitution_type = 'not_offered' para um produto placeholder\n\n" +
    "Use a ferramenta extract_pharmacy_data para retornar os dados estruturados."
  );
}

export function buildParseUserPrompt(
  pharmacyResponse: string,
  requestedProducts: string[],
  phase: ConversationPhase,
  conversationHistory?: { role: "user" | "assistant"; content: string }[],
): string {
  let prompt =
    `Produtos solicitados: ${requestedProducts.join(", ")}\n` +
    `Fase da conversa: ${phase === "phase1_branded" ? "Fase 1 — perguntamos sobre o produto de marca" : "Fase 2 — perguntamos sobre genérico/alternativa"}\n\n`;

  if (conversationHistory?.length) {
    prompt += "Histórico da conversa:\n";
    for (const msg of conversationHistory) {
      prompt += `${msg.role === "assistant" ? "Nós" : "Farmácia"}: "${msg.content}"\n`;
    }
    prompt += "\n";
  }

  prompt +=
    `Última resposta da farmácia:\n"${pharmacyResponse}"\n\n` +
    "Extraia TODOS os produtos mencionados com preço, disponibilidade, dosagem, quantidade e apresentação.";

  if (phase === "phase1_branded") {
    prompt +=
      "\n\nATENÇÃO: A farmácia ofereceu espontaneamente algum genérico, similar ou alternativa? " +
      "Se sim, marque spontaneousSubstitution = true e o produto alternativo com substitution_type = 'spontaneous'.";
  }

  return prompt;
}

export function pickScenario(persona: PersonaProfile): string {
  const templates = persona.scenarioTemplates;
  if (templates.length === 0) return "Preciso comprar um medicamento";
  return templates[Math.floor(Math.random() * templates.length)];
}
