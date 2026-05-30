/**
 * Seed script for 3 base conversation flows (casual, formal, anxious).
 * Run: npx tsx packages/db/src/seed-flows.ts
 */
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { conversationFlows } from "./schema/conversation-flows.js";

const casualTree = {
  nodes: {
    greeting: {
      type: "send",
      phase: "phase1",
      templates: [
        "Oi, boa tarde! Tudo bem? Vcs tem {product_name} ai?",
        "Oi! Td bem? To precisando de {product_name}, vcs tem?",
        "Boa tarde! Queria saber se vcs tem {product_name} pra vender",
      ],
      next: "wait_initial",
    },
    wait_initial: {
      type: "classify",
      timeoutMs: 1800000,
      branches: [
        { category: "has_price_and_stock", description: "Farmacia informou preco e disponibilidade", target: "check_alternatives" },
        { category: "has_stock_no_price", description: "Disse que tem mas nao informou preco", target: "ask_price" },
        { category: "out_of_stock", description: "Nao tem o produto em estoque", target: "ask_alternatives" },
        { category: "asks_cpf", description: "Pediu CPF ou receita", target: "provide_cpf" },
        { category: "asks_info", description: "Pediu mais informacao (dosagem, forma)", target: "provide_info" },
        { category: "unclear", description: "Resposta nao clara ou nao relacionada", target: "follow_up" },
        { category: "negative", description: "Recusou atender ou hostil", target: "thank_fail" },
      ],
    },
    ask_price: {
      type: "send",
      phase: "phase1",
      templates: [
        "Beleza! E quanto ta saindo?",
        "Ah legal! Qual o preco dele?",
        "Otimo! Sabe me dizer o valor?",
      ],
      next: "wait_price",
    },
    wait_price: {
      type: "classify",
      timeoutMs: 1200000,
      branches: [
        { category: "has_price", description: "Informou o preco", target: "check_alternatives" },
        { category: "unclear", description: "Nao informou preco claramente", target: "follow_up_price" },
        { category: "negative", description: "Recusou informar", target: "thank_complete" },
      ],
    },
    follow_up_price: {
      type: "send",
      phase: "phase1",
      templates: [
        "Desculpa, nao entendi bem. Qual o valor do {product_name}?",
        "Ah, entao qual seria o preco certinho?",
      ],
      next: "wait_price",
    },
    ask_alternatives: {
      type: "send",
      phase: "phase2",
      templates: [
        "Poxa, que pena 😕 E vcs tem algum generico do {active_ingredient}?",
        "Ah nao tem ne... Tem alguma outra opcao com {active_ingredient}?",
        "Hmm entendi. E algum similar ou generico do {active_ingredient}, vcs tem?",
      ],
      next: "wait_alternatives",
    },
    wait_alternatives: {
      type: "classify",
      timeoutMs: 1200000,
      branches: [
        { category: "offered_alternatives", description: "Ofereceu alternativas com precos", target: "thank_complete" },
        { category: "no_alternatives", description: "Nao tem alternativas", target: "thank_complete" },
        { category: "unclear", description: "Resposta nao clara", target: "follow_up_alt" },
      ],
    },
    follow_up_alt: {
      type: "send",
      phase: "phase2",
      templates: [
        "Entendi! Entao nao tem nenhuma opcao ne? Valeu!",
      ],
      next: "thank_complete",
    },
    check_alternatives: {
      type: "classify",
      timeoutMs: 0,
      branches: [
        { category: "mentioned_alternatives", description: "Ja mencionou alternativas/genericos na resposta anterior", target: "thank_complete" },
        { category: "no_alternatives", description: "Nao mencionou alternativas", target: "phase2_ask" },
      ],
    },
    phase2_ask: {
      type: "send",
      phase: "phase2",
      templates: [
        "Show, valeu! E vcs tem algum generico ou similar do {active_ingredient} tambem?",
        "Beleza! Ah e por acaso, tem generico desse? Com {active_ingredient}?",
      ],
      next: "wait_phase2",
    },
    wait_phase2: {
      type: "classify",
      timeoutMs: 1200000,
      branches: [
        { category: "offered_alternatives", description: "Ofereceu alternativas", target: "thank_complete" },
        { category: "no_alternatives", description: "Nao tem alternativas", target: "thank_complete" },
        { category: "unclear", description: "Resposta nao clara", target: "thank_complete" },
      ],
    },
    provide_cpf: {
      type: "send",
      phase: "phase1",
      templates: [
        "Ah sim, meu CPF e {cpf}",
        "Claro! CPF: {cpf}",
      ],
      next: "wait_initial",
    },
    provide_info: {
      type: "send",
      phase: "phase1",
      templates: [
        "E o {product_name} {presentation}, se tiver!",
        "O de {presentation}! Comprimido msm",
      ],
      next: "wait_initial",
    },
    follow_up: {
      type: "send",
      phase: "phase1",
      templates: [
        "Desculpa, e que to precisando do {product_name}. Vcs tem pra vender?",
        "Oi, desculpa! Queria saber sobre o {product_name}, tem ai?",
      ],
      next: "wait_initial",
    },
    thank_complete: {
      type: "complete",
      thankYouTemplates: [
        "Valeu pela ajuda! Obrigado 😊",
        "Beleza, muito obrigado! Bom dia!",
        "Show, obrigado pela informacao! Vlw!",
      ],
    },
    thank_fail: {
      type: "fail",
      reason: "pharmacy_refused",
    },
  },
};

const formalTree = {
  nodes: {
    greeting: {
      type: "send",
      phase: "phase1",
      templates: [
        "Bom dia! Gostaria de saber se a farmacia possui {product_name} disponivel para venda, por favor.",
        "Boa tarde! Poderia me informar se voces tem {product_name} em estoque?",
        "Ola, boa tarde! Estou procurando {product_name}. A farmacia possui?",
      ],
      next: "wait_initial",
    },
    wait_initial: {
      type: "classify",
      timeoutMs: 1800000,
      branches: [
        { category: "has_price_and_stock", description: "Informou preco e disponibilidade", target: "check_alternatives" },
        { category: "has_stock_no_price", description: "Confirmou estoque sem preco", target: "ask_price" },
        { category: "out_of_stock", description: "Produto em falta", target: "ask_alternatives" },
        { category: "asks_cpf", description: "Solicitou CPF ou receita", target: "provide_cpf" },
        { category: "asks_info", description: "Pediu mais informacoes", target: "provide_info" },
        { category: "unclear", description: "Resposta nao clara", target: "follow_up" },
        { category: "negative", description: "Recusou atender", target: "thank_fail" },
      ],
    },
    ask_price: {
      type: "send",
      phase: "phase1",
      templates: [
        "Obrigada pela informacao! Poderia me informar o valor, por favor?",
        "Que bom! E qual seria o preco do produto?",
      ],
      next: "wait_price",
    },
    wait_price: {
      type: "classify",
      timeoutMs: 1200000,
      branches: [
        { category: "has_price", description: "Informou o preco", target: "check_alternatives" },
        { category: "unclear", description: "Nao ficou claro", target: "follow_up_price" },
        { category: "negative", description: "Recusou informar", target: "thank_complete" },
      ],
    },
    follow_up_price: {
      type: "send",
      phase: "phase1",
      templates: [
        "Perdao, nao consegui entender. Qual seria o valor exato do {product_name}?",
      ],
      next: "wait_price",
    },
    ask_alternatives: {
      type: "send",
      phase: "phase2",
      templates: [
        "Entendo. E a farmacia possui algum medicamento generico com {active_ingredient}?",
        "Compreendo. Haveria alguma alternativa generica ou similar com o principio ativo {active_ingredient}?",
      ],
      next: "wait_alternatives",
    },
    wait_alternatives: {
      type: "classify",
      timeoutMs: 1200000,
      branches: [
        { category: "offered_alternatives", description: "Ofereceu alternativas", target: "thank_complete" },
        { category: "no_alternatives", description: "Sem alternativas", target: "thank_complete" },
        { category: "unclear", description: "Resposta nao clara", target: "thank_complete" },
      ],
    },
    check_alternatives: {
      type: "classify",
      timeoutMs: 0,
      branches: [
        { category: "mentioned_alternatives", description: "Ja mencionou alternativas", target: "thank_complete" },
        { category: "no_alternatives", description: "Nao mencionou alternativas", target: "phase2_ask" },
      ],
    },
    phase2_ask: {
      type: "send",
      phase: "phase2",
      templates: [
        "Muito obrigada! E por gentileza, a farmacia teria tambem algum generico ou similar de {active_ingredient}?",
        "Agradeco! Aproveitando, haveria opcoes genericas com {active_ingredient} disponiveis?",
      ],
      next: "wait_phase2",
    },
    wait_phase2: {
      type: "classify",
      timeoutMs: 1200000,
      branches: [
        { category: "offered_alternatives", description: "Ofereceu alternativas", target: "thank_complete" },
        { category: "no_alternatives", description: "Sem alternativas", target: "thank_complete" },
        { category: "unclear", description: "Resposta nao clara", target: "thank_complete" },
      ],
    },
    provide_cpf: {
      type: "send",
      phase: "phase1",
      templates: [
        "Claro, meu CPF e {cpf}.",
        "Sim, o CPF e {cpf}. Obrigada.",
      ],
      next: "wait_initial",
    },
    provide_info: {
      type: "send",
      phase: "phase1",
      templates: [
        "Seria o {product_name} na apresentacao {presentation}, por favor.",
        "Estou procurando o {product_name} {presentation}.",
      ],
      next: "wait_initial",
    },
    follow_up: {
      type: "send",
      phase: "phase1",
      templates: [
        "Perdao, gostaria de saber se a farmacia possui {product_name} para venda.",
        "Desculpe a insistencia. Seria possivel verificar a disponibilidade do {product_name}?",
      ],
      next: "wait_initial",
    },
    thank_complete: {
      type: "complete",
      thankYouTemplates: [
        "Muito obrigada pela atencao! Tenha um otimo dia.",
        "Agradeco muito pelas informacoes. Boa tarde!",
      ],
    },
    thank_fail: {
      type: "fail",
      reason: "pharmacy_refused",
    },
  },
};

const anxiousTree = {
  nodes: {
    greeting: {
      type: "send",
      phase: "phase1",
      templates: [
        "Oi! Boa tarde! Me desculpa incomodar, mas eu to precisando muito do {product_name}, vcs tem?? Meu medico receitou e preciso urgente!",
        "Ola! Por favor, vcs tem {product_name}?? Preciso muito, ja fui em varias farmacias e nao encontro 😰",
        "Oi boa tarde! Sera que vcs tem o {product_name}? To desesperada procurando!",
      ],
      next: "wait_initial",
    },
    wait_initial: {
      type: "classify",
      timeoutMs: 1800000,
      branches: [
        { category: "has_price_and_stock", description: "Informou preco e disponibilidade", target: "check_alternatives" },
        { category: "has_stock_no_price", description: "Tem mas sem preco", target: "ask_price" },
        { category: "out_of_stock", description: "Nao tem", target: "ask_alternatives" },
        { category: "asks_cpf", description: "Pediu CPF", target: "provide_cpf" },
        { category: "asks_info", description: "Pediu mais info", target: "provide_info" },
        { category: "unclear", description: "Resposta nao clara", target: "follow_up" },
        { category: "negative", description: "Recusou", target: "thank_fail" },
      ],
    },
    ask_price: {
      type: "send",
      phase: "phase1",
      templates: [
        "Ai que alivio que tem!! Quanto custa? Preciso comprar logo!",
        "Que bom que vcs tem!!! Quanto ta saindo? Quero ir comprar hj msm!",
      ],
      next: "wait_price",
    },
    wait_price: {
      type: "classify",
      timeoutMs: 1200000,
      branches: [
        { category: "has_price", description: "Informou preco", target: "check_alternatives" },
        { category: "unclear", description: "Nao ficou claro", target: "follow_up_price" },
        { category: "negative", description: "Recusou", target: "thank_complete" },
      ],
    },
    follow_up_price: {
      type: "send",
      phase: "phase1",
      templates: [
        "Desculpa, nao entendi o valor 😅 Quanto ta o {product_name}?",
      ],
      next: "wait_price",
    },
    ask_alternatives: {
      type: "send",
      phase: "phase2",
      templates: [
        "Ai nao 😭 E tem algum generico? Qualquer coisa com {active_ingredient}?? Preciso muito!",
        "Nossa que pena!! E um similar? Generico do {active_ingredient}? Qualquer opcao me ajuda!!",
      ],
      next: "wait_alternatives",
    },
    wait_alternatives: {
      type: "classify",
      timeoutMs: 1200000,
      branches: [
        { category: "offered_alternatives", description: "Ofereceu alternativas", target: "thank_complete" },
        { category: "no_alternatives", description: "Sem alternativas", target: "thank_complete" },
        { category: "unclear", description: "Nao ficou claro", target: "thank_complete" },
      ],
    },
    check_alternatives: {
      type: "classify",
      timeoutMs: 0,
      branches: [
        { category: "mentioned_alternatives", description: "Ja mencionou alternativas", target: "thank_complete" },
        { category: "no_alternatives", description: "Nao mencionou alternativas", target: "phase2_ask" },
      ],
    },
    phase2_ask: {
      type: "send",
      phase: "phase2",
      templates: [
        "Muito obrigada!! Ah e por acaso, vcs tem generico do {active_ingredient} tbm?? Seria otimo ter opcao!",
        "Valeu demais!! E generico com {active_ingredient}, tem?? Quero comparar os precos!",
      ],
      next: "wait_phase2",
    },
    wait_phase2: {
      type: "classify",
      timeoutMs: 1200000,
      branches: [
        { category: "offered_alternatives", description: "Ofereceu alternativas", target: "thank_complete" },
        { category: "no_alternatives", description: "Sem alternativas", target: "thank_complete" },
        { category: "unclear", description: "Nao ficou claro", target: "thank_complete" },
      ],
    },
    provide_cpf: {
      type: "send",
      phase: "phase1",
      templates: [
        "Sim claro!! Meu CPF e {cpf}! Me desculpa a pressa!",
        "Ah sim! CPF {cpf}. Desculpa!",
      ],
      next: "wait_initial",
    },
    provide_info: {
      type: "send",
      phase: "phase1",
      templates: [
        "E o {product_name} {presentation}!! Meu medico receitou esse!",
        "O de {presentation}! O medico disse que tem que ser esse!",
      ],
      next: "wait_initial",
    },
    follow_up: {
      type: "send",
      phase: "phase1",
      templates: [
        "Oi, desculpa! E que eu to procurando o {product_name}, vcs tem?? Preciso muito!",
        "Me desculpe incomodar! E sobre o {product_name}, vcs conseguem verificar se tem?",
      ],
      next: "wait_initial",
    },
    thank_complete: {
      type: "complete",
      thankYouTemplates: [
        "Muito muito obrigadaaa!! Vou ai correndo!! Valeu mesmo!! 🙏",
        "Obrigadaaaa pela ajuda!! Deus abencoe!! 😊🙏",
        "Valeu demais!! Obrigada por tudo!! Vou comprar hj mesmo!",
      ],
    },
    thank_fail: {
      type: "fail",
      reason: "pharmacy_refused",
    },
  },
};

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: dbUrl });
  const db = drizzle(pool);

  const flows = [
    { name: "Fluxo Casual v1", personaStyle: "casual" as const, tree: casualTree, entryNodeId: "greeting" },
    { name: "Fluxo Formal v1", personaStyle: "formal" as const, tree: formalTree, entryNodeId: "greeting" },
    { name: "Fluxo Ansioso v1", personaStyle: "anxious" as const, tree: anxiousTree, entryNodeId: "greeting" },
  ];

  for (const flow of flows) {
    await db.insert(conversationFlows).values({
      name: flow.name,
      personaStyle: flow.personaStyle,
      version: 1,
      isActive: true,
      tree: flow.tree as unknown as Record<string, unknown>,
      entryNodeId: flow.entryNodeId,
    }).onConflictDoNothing();
    console.log(`Seeded: ${flow.name}`);
  }

  await pool.end();
  console.log("Done!");
}

main().catch(console.error);
