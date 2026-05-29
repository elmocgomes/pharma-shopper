-- Seed: Admin user
INSERT INTO users (email, password_hash, name, role)
VALUES ('admin@pharmashopper.com', '$2a$10$XiYtsXAQCYX/mrxZWKABAug/VRBgCvcO9sasOvk31Op0qqB4b4WKy', 'Admin', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Seed: 10 default personas
INSERT INTO personas (name, age_range, gender, occupation, communication_style, scenario_templates) VALUES
('Ana Silva', '28-35', 'female', 'professora', 'casual', '["meu médico receitou esse remédio ontem","preciso comprar pra minha mãe que tá doente","tô procurando um remédio que minha amiga indicou"]'::jsonb),
('Carlos Santos', '40-50', 'male', 'engenheiro', 'formal', '["gostaria de verificar a disponibilidade de um medicamento","meu cardiologista prescreveu este medicamento","preciso de um orçamento para tratamento contínuo"]'::jsonb),
('Maria Oliveira', '55-65', 'female', 'aposentada', 'anxious', '["meu remédio acabou e preciso urgente!","o médico disse que não posso ficar sem esse remédio","liguei em várias farmácias e ninguém tem, vocês têm?"]'::jsonb),
('Pedro Costa', '22-28', 'male', 'estudante', 'casual', '["opa, meu dermato passou esse remédio","to procurando o genérico de um remédio","preciso de um remédio pra alergia"]'::jsonb),
('Juliana Ferreira', '30-38', 'female', 'advogada', 'formal', '["bom dia, poderia me informar o preço deste medicamento?","preciso de um medicamento para meu filho","gostaria de saber se vocês trabalham com este laboratório"]'::jsonb),
('Roberto Almeida', '45-55', 'male', 'comerciante', 'casual', '["e aí, tem esse remédio aí na farmácia?","minha esposa pediu pra eu procurar esse remédio","quanto tá saindo esse medicamento?"]'::jsonb),
('Fernanda Lima', '35-42', 'female', 'enfermeira', 'formal', '["preciso verificar o preço para um paciente","vocês têm estoque desse medicamento no momento?","qual o valor do genérico e do de referência?"]'::jsonb),
('Lucas Mendes', '25-32', 'male', 'programador', 'casual', '["fala, vcs tem esse remédio?","quanto custa esse medicamento aí?","preciso comprar um remédio que meu médico passou"]'::jsonb),
('Teresa Souza', '60-70', 'female', 'dona de casa', 'anxious', '["por favor, vocês têm esse remédio? meu marido precisa muito","estou desesperada procurando esse medicamento","o remédio do meu neto acabou, vocês têm pra vender?"]'::jsonb),
('Diego Rodrigues', '33-40', 'male', 'motorista', 'casual', '["oi, tem como ver o preço de um remédio?","preciso de um remédio pra pressão","meu médico trocou meu remédio, vcs tem esse novo?"]'::jsonb)
ON CONFLICT DO NOTHING;
