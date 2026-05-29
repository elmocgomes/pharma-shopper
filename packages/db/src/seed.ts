import "dotenv/config";
import { createDb } from "./client.js";
import { users } from "./schema/users.js";
import { personas } from "./schema/personas.js";
import bcrypt from "bcryptjs";

const db = createDb(process.env.DATABASE_URL!);

function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

async function seed() {
  console.log("Seeding database...");

  await db
    .insert(users)
    .values({
      email: "admin@pharmashopper.com",
      passwordHash: hashPassword("admin123"),
      name: "Admin",
      role: "admin",
    })
    .onConflictDoNothing();

  const defaultPersonas = [
    {
      name: "Ana Silva",
      ageRange: "28-35",
      gender: "female",
      occupation: "professora",
      communicationStyle: "casual" as const,
      scenarioTemplates: [
        "meu médico receitou esse remédio ontem",
        "preciso comprar pra minha mãe que tá doente",
        "tô procurando um remédio que minha amiga indicou",
      ],
    },
    {
      name: "Carlos Santos",
      ageRange: "40-50",
      gender: "male",
      occupation: "engenheiro",
      communicationStyle: "formal" as const,
      scenarioTemplates: [
        "gostaria de verificar a disponibilidade de um medicamento",
        "meu cardiologista prescreveu este medicamento",
        "preciso de um orçamento para tratamento contínuo",
      ],
    },
    {
      name: "Maria Oliveira",
      ageRange: "55-65",
      gender: "female",
      occupation: "aposentada",
      communicationStyle: "anxious" as const,
      scenarioTemplates: [
        "meu remédio acabou e preciso urgente!",
        "o médico disse que não posso ficar sem esse remédio",
        "liguei em várias farmácias e ninguém tem, vocês têm?",
      ],
    },
    {
      name: "Pedro Costa",
      ageRange: "22-28",
      gender: "male",
      occupation: "estudante",
      communicationStyle: "casual" as const,
      scenarioTemplates: [
        "opa, meu dermato passou esse remédio",
        "to procurando o genérico de um remédio",
        "preciso de um remédio pra alergia",
      ],
    },
    {
      name: "Juliana Ferreira",
      ageRange: "30-38",
      gender: "female",
      occupation: "advogada",
      communicationStyle: "formal" as const,
      scenarioTemplates: [
        "bom dia, poderia me informar o preço deste medicamento?",
        "preciso de um medicamento para meu filho",
        "gostaria de saber se vocês trabalham com este laboratório",
      ],
    },
    {
      name: "Roberto Almeida",
      ageRange: "45-55",
      gender: "male",
      occupation: "comerciante",
      communicationStyle: "casual" as const,
      scenarioTemplates: [
        "e aí, tem esse remédio aí na farmácia?",
        "minha esposa pediu pra eu procurar esse remédio",
        "quanto tá saindo esse medicamento?",
      ],
    },
    {
      name: "Fernanda Lima",
      ageRange: "35-42",
      gender: "female",
      occupation: "enfermeira",
      communicationStyle: "formal" as const,
      scenarioTemplates: [
        "preciso verificar o preço para um paciente",
        "vocês têm estoque desse medicamento no momento?",
        "qual o valor do genérico e do de referência?",
      ],
    },
    {
      name: "Lucas Mendes",
      ageRange: "25-32",
      gender: "male",
      occupation: "programador",
      communicationStyle: "casual" as const,
      scenarioTemplates: [
        "fala, vcs tem esse remédio?",
        "quanto custa esse medicamento aí?",
        "preciso comprar um remédio que meu médico passou",
      ],
    },
    {
      name: "Teresa Souza",
      ageRange: "60-70",
      gender: "female",
      occupation: "dona de casa",
      communicationStyle: "anxious" as const,
      scenarioTemplates: [
        "por favor, vocês têm esse remédio? meu marido precisa muito",
        "estou desesperada procurando esse medicamento",
        "o remédio do meu neto acabou, vocês têm pra vender?",
      ],
    },
    {
      name: "Diego Rodrigues",
      ageRange: "33-40",
      gender: "male",
      occupation: "motorista",
      communicationStyle: "casual" as const,
      scenarioTemplates: [
        "oi, tem como ver o preço de um remédio?",
        "preciso de um remédio pra pressão",
        "meu médico trocou meu remédio, vcs tem esse novo?",
      ],
    },
  ];

  for (const persona of defaultPersonas) {
    await db.insert(personas).values(persona).onConflictDoNothing();
  }

  console.log("Seed complete: 1 admin user + 10 personas");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
