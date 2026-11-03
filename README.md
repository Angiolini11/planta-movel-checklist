# Planta Móvel — Checklist e Passagem de Turno (MVP)

Aplicação web **real** desenvolvida com React, TypeScript, Vite e Supabase. Interface responsiva prioritariamente para celular. Visual industrial com vermelho suave `#B6423D` e cinza-grafite `#383D42`.

> **Atenção:** o código está preparado para um serviço Supabase, mas **não vem conectado** a um projeto Supabase real. Não há registros fictícios nem login simulado. Sem as chaves e a migração, a interface mostra orientações de configuração. A instalação de dependências e os testes de integração exigem ambiente com acesso à internet e projeto Supabase.


## ATUALIZAÇÃO DA VERSÃO PILOTO — edição e anulação compartilhada

O usuário já executou o SQL inicial e a correção de permissões. **Antes de iniciar esta nova versão do React**, abra o **SQL Editor** do MESMO projeto Supabase, crie uma consulta e execute integralmente `supabase/migrations/202611030002_pilot_edits.sql`. O resultado esperado é `Success. No rows returned`. Não reexecute o SQL de criação inicial.

- Operadores autenticados que participam do **mesmo turno atual e aberto** podem **editar/anular** registros de qualquer participante desse turno: horímetros, produção, paradas, ocorrências, observações de módulos e observações de passagem. Respostas do checklist podem ser alteradas e anuladas.
- Registros editados apresentam somente a **versão atual** com indicação **Editado**. Anulações exigem confirmação e removem a linha do banco, das telas operacionais, do histórico comum e do PDF (não é possível desfazer).
- As pendências vinculadas a ocorrências/checklists são sincronizadas. Uma pendência **resolvida** impede a anulação da origem nesta versão para evitar desconfigurar a situação operacional.
- O SQL remove os triggers de auditoria operacional para **novas ações**, mas preserva a auditoria administrativa. Eventos **anteriores** que já foram gravados em `audit_events`, possíveis logs de infraestrutura e backups **não são apagados**; a interface comum não mostra esses eventos. A origem do registro continua identificada.
- Turnos encerrados ou antigos permanecem bloqueados para alterações e anulações. Não habilitar esta configuração com dados reais antes de aprovação dos responsáveis operacionais, de segurança e da política de registros. Esta mudança é **somente para testes**.

No computador, salve o projeto atualizado na pasta desejada, mantenha seu `.env.local` antigo (não incluído no ZIP), execute `npm install` se ainda não instalou dependências e `npm run dev`. No Supabase, **não** é necessário republicar `operator-auth` para este ajuste.

## 1. Componentes do projeto

| Caminho | Responsabilidade |
| --- | --- |
| `src/App.tsx` | Login, navegação, turnos, painel, atualização compartilhada |
| `src/screens/Modules.tsx` | QJ341 / QH441 / QA452, checklists e horímetros |
| `src/screens/Operations.tsx` | Produção, paradas e ocorrências |
| `src/screens/Handover.tsx` | Pendências, passagem de turno e encerramento |
| `src/screens/History.tsx` | Consulta de turnos e registros atuais (sem versões anteriores na fase piloto) |
| `src/screens/Settings.tsx` | Fotos oficiais, lista de operadores, redefinição de PIN |
| `src/lib/pdf.ts` | PDF resumido, exportado no navegador |
| `supabase/migrations/202611020001_initial.sql` | PostgreSQL, RLS, triggers e funções de turno |
| `supabase/migrations/202611030002_pilot_edits.sql` | Migração de edição/anulação compartilhada para a fase piloto |
| `supabase/functions/operator-auth/index.ts` | Cadastro, login e redefinição segura de PIN |
| `public/equipment/` | Ilustrações SVG próprias e provisórias (sem logos oficiais) |
| `.github/workflows/deploy.yml` | Publicação automática no GitHub Pages |

## 2. Pré-requisitos

- Node.js 22, npm e Git.
- Conta Supabase e **um projeto próprio** (pode ser plano gratuito, sujeito aos limites e políticas vigentes).
- Para publicar, conta GitHub (o frontend pode usar GitHub Pages; dados/fotos/backend continuam no Supabase).

## 3. Preparar o Supabase

1. Entre no [Supabase Dashboard](https://supabase.com/dashboard) e crie um projeto.
2. Acesse **SQL Editor** e execute **uma única vez** todo o conteúdo de `supabase/migrations/202611020001_initial.sql`. Isso cria tabelas, funções, políticas RLS, bucket privado e publicação Realtime.
3. Em **Authentication > Providers**, mantenha a autenticação Email habilitada (ela é utilizada apenas internamente pelo backend). **O operador não precisa fornecer e-mail.** Recomendamos desabilitar novos cadastros diretos pelo Supabase Auth; o cadastro público da aplicação passa pela Edge Function administrativa, e deve ser limitado ao ambiente piloto.
4. Copie a **Project URL** e a **anon/public publishable key** em **Project Settings > API**. Chaves `service_role` e segredos de autenticação nunca vão para o frontend.

**Por que existe um e-mail interno?** O Supabase Auth não aceita matrícula como identificador direto. O backend gera um e-mail técnico aleatório, invisível no formulário, e usa um segredo do servidor para derivar uma senha de alta entropia a partir de matrícula e PIN. O Supabase Auth guarda apenas o hash da senha derivada. Matrícula e PIN nunca são validados apenas no navegador.

### Publicar a Edge Function

Instale/use a **Supabase CLI** seguindo a [documentação oficial](https://supabase.com/docs/guides/local-development/cli/getting-started). Na pasta do projeto:

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
```

Gere localmente um segredo aleatório longo (32 bytes ou mais). Por exemplo, no Python:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Copie o valor gerado e registre-o como segredo no Supabase:

```bash
npx supabase secrets set AUTH_PIN_PEPPER=SEU_SEGREDO_ALEATORIO
npx supabase functions deploy operator-auth --no-verify-jwt
```

**Importante:** mantenha `AUTH_PIN_PEPPER` em local seguro. **Não substitua esse valor** depois de criar operadores: o PIN derivado deixaria de autenticar, e seria necessário um procedimento controlado de redefinição. Não coloque esse segredo em `.env.local` (Vite), nem no GitHub. `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são providenciados pelo ambiente hospedado da Edge Function.

O deploy usa `--no-verify-jwt` porque **login e cadastro ainda não têm sessão**. Na ação administrativa `reset-pin`, a função verifica o JWT, consulta o perfil Configurador, reconfirma seu próprio PIN e grava auditoria. Não remova essas validações.

### Definir o primeiro Configurador

1. Abra a aplicação depois de configurar as variáveis públicas (seção seguinte).
2. Use **Cadastrar** para criar o operador que será o responsável pelas configurações, com a matrícula correta.
3. Confira a identidade da pessoa e sua matrícula **fora do site**.
4. Como administrador do Supabase, execute no **SQL Editor**:

```sql
update public.profiles
set role = 'configurador'
where matricula = 'MATRICULA_JA_CADASTRADA';
```

5. Verifique que **uma única linha** foi alterada. O operador faz logout/login e verá Configurações.

**NÃO** deixe um cadastro comum atribuir seu próprio perfil. A UI e as políticas RLS impedem isso.

## 4. Rodar no computador

Na pasta do projeto, abra o terminal:

```bash
npm install
cp .env.example .env.local
```

No Windows, você pode simplesmente copiar/renomear `.env.example` para `.env.local` pelo Explorador. Preencha `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://seu-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_publica_anon
VITE_BASE_PATH=/
```

Depois:

```bash
npm run dev
```

Abra o endereço mostrado no terminal (normalmente `http://localhost:5173`). Para acessar pelo celular na mesma rede Wi-Fi, use o **IP local do computador** indicado pelo Vite e a porta 5173. Nesse modo o computador precisa permanecer ligado.

### Validar e compilar

```bash
npm test
npm run build
npm run preview
```

O build final aparece em `dist/`. **Não** envie para publicação o código-fonte com segredos administrativos; as variáveis prefixadas por `VITE_` são incorporadas ao bundle e devem conter **somente valores públicos**.

## 5. Publicação gratuita no GitHub Pages

1. Crie um repositório GitHub e envie **os arquivos da pasta do projeto**, sem `node_modules`, `.env.local` ou outras credenciais.
2. O repositório já inclui `.github/workflows/deploy.yml` para compilar e publicar a aplicação em cada `push` na branch `main`.
3. Em **Settings > Secrets and variables > Actions > Variables**, crie:
   - `VITE_SUPABASE_URL` = URL pública do Supabase
   - `VITE_SUPABASE_ANON_KEY` = chave pública (anon / publishable)
4. Em **Settings > Pages**, selecione **Source: GitHub Actions**.
5. Em **Actions**, execute o workflow **Publicar frontend no GitHub Pages** (ou faça `push` para `main`).
6. O endereço terá o formato `https://USUARIO.github.io/REPOSITORIO/`.

O workflow define `VITE_BASE_PATH` automaticamente com o nome do repositório. O app usa navegação por estado, de modo que não precisa de regras de reescrita de rota no GitHub Pages.

**GitHub Pages hospeda apenas o frontend.** O Supabase hospeda dados, autenticação, fotografias e Edge Functions. Depois da publicação, o computador pode ficar desligado.

## 6. Regras de operação da primeira versão

- **Turnos:** diurno 07h–19h; noturno 19h–07h, sempre com a data do início. Tudo baseado em `America/Sao_Paulo`. O banco impede dois registros de turno para a mesma data/tipo.
- **Participação:** automática ao acessar o turno atual. Outros operadores no mesmo turno veem os mesmos registros.
- **Segurança:** dados somente para usuários com perfil autenticado; escritas somente por participantes do turno corrente; Configurador exclusivo via backend; fotos em bucket privado e URL assinada.
- **Checklist:** 8 verificações por módulo em operação, orientações preliminares; opções conforme, anomalia, não se aplica, não verificado. Justificativas obrigatórias em qualquer resposta diferente de Conforme.
- **Não utilizado / manutenção / indisponibilidade:** checklist reduzido aos itens 1, 2 e 8, com justificativa da condição. Antes de operar, retorne à condição apropriada e conclua os itens exigidos. Esta regra simplificada **precisa ser validada pela empresa**.
- **Anomalias:** geradas automaticamente em `issues` no banco; mantidas quando a resposta do item muda; solução explícita para resolver, com auditoria.
- **Horímetros:** leituras append-only, com autor e hora; diferença final − inicial; restrição na UI e no banco contra final menor que inicial.
- **Produção:** registros separados por material/atividade e conjunto de módulos; a tonelagem de um registro é somada uma vez, independentemente de quantos módulos utilizar. `NULL` significa não informado, `0` significa zero.
- **Paradas:** podem ser cadastradas com horários vazios e complementadas depois; o histórico de versões anteriores não aparece na fase piloto; cálculo de duração suporta virada de dia quando datas são informadas corretamente.
- **Ocorrências:** um evento por linha, foto opcional, opção individual de gerar pendência.
- **Compartilhamento:** canal Realtime com atualização periódica (20 s) como contingência. Edições verificam a revisão do registro para evitar sobrescritas concorrentes. No piloto, o histórico operacional mostra apenas valores atuais.
- **Encerramento:** participante do turno fecha via função SQL protegida. Após o horário, exige justificativa. Se declarar condições alteradas, exige confirmação e ao menos uma atualização de checklist registrada no banco.
- **Histórico:** turnos anteriores somente leitura. Pendências de turnos anteriores continuam visíveis nos turnos ativos. A UI não exibe trilha de edições nesta versão piloto; registros anulados deixam de aparecer no site e PDF.
- **PDF:** resumo de operadores, módulos, horímetros, produção, paradas/ocorrências relevantes, pendências e passagem. Não inclui fotos nem todas as perguntas; turno aberto gera **Relatório parcial**.

## 7. Checklist de testes da primeira versão

Use **contas e informações de teste**, preferencialmente com dois celulares/dispositivos distintos:

- [ ] Criar 2 operadores e bloquear matrícula duplicada.
- [ ] Entrar com matrícula/PIN sem e-mail. Tentar PIN incorreto 5 vezes e conferir bloqueio temporário.
- [ ] Testar sessão persistente e saída do sistema.
- [ ] Tornar uma conta Configurador via SQL; conferir que operador comum não altera a própria permissão nem imagens por requisição direta.
- [ ] Abrir o mesmo turno com dois operadores e verificar um único `shifts.id` e dados compartilhados.
- [ ] Registrar condição antes do checklist. Testar Conforme, Anomalia, Não se aplica e Não verificado, com as validações de justificativa.
- [ ] Enviar foto privada; confirmar acesso com usuário autorizado e bloqueio sem sessão.
- [ ] Preencher item simultaneamente em dois celulares; confirmar mensagem de conflito em vez de sobrescrita silenciosa.
- [ ] Marcar equipamento não utilizado; confirmar checklist adaptado e voltar para operação antes de utilizar.
- [ ] Registrar horímetros iniciais/finais, inclusive leitura final menor que inicial (deve rejeitar).
- [ ] Registrar Hematita Bocaina, Hematitinha, Granulado e Outro, com 0 e com tonelagem vazia.
- [ ] Registrar parada sem horário e depois complementar; testar travessia de meia-noite com duas datas.
- [ ] Criar ocorrência com e sem pendência e foto opcional.
- [ ] Confirmar pendência no turno seguinte e resolução com descrição identificada.
- [ ] Confirmar o início do turno noturno às 19h e a data de referência entre 00h e 07h (horário de São Paulo).
- [ ] Finalizar um turno com confirmação; conferir bloqueio de edições comuns.
- [ ] Deixar um turno expirar; conferir status pendente, operação normal do próximo e encerramento tardio com justificativa obrigatória.
- [ ] Consultar turno anterior no histórico e exportar PDF parcial e definitivo.
- [ ] Redefinir PIN pelo Configurador depois da verificação de identidade e reconfirmação do próprio PIN.
- [ ] Conferir uso em Android, iPhone e computador; layout sem rolagem horizontal.

## 8. Limitações e cuidados antes do uso real

1. **Cadastro livre não comprova identidade nem vínculo com a empresa**. Não operar em produção sem política de cadastramento/verificação, validação interna, proteção contra automação de cadastro e consentimento para armazenamento de dados pessoais.
2. O controle de tentativas de login considera a matrícula e janela de 15 minutos; o cadastro possui limite global simples de até 20 novos perfis por 15 minutos. Sistemas maiores também precisam de proteção adicional no gateway (IP, captcha/rate limiting distribuído, monitoramento). A execução simultânea de muitos logins requer controle de concorrência/rate limiting mais rígido para produção.
3. A autorização de turno e o fechamento são verificados no banco, mas os itens de inspeção adaptada, os campos do checklist e as condições de encerramento devem ser **homologados pelos responsáveis de operação e segurança**.
4. O produto **não libera o equipamento para operação** e não instrui manutenção/intervenção em partes móveis. Inspeções internas só com parada, bloqueio e procedimento autorizado.
5. O fuso da operação é America/Sao_Paulo. O formulário de hora da ocorrência usa `-03:00`, consistente com o horário atual do Brasil; uma mudança legal futura do fuso exigiria atualização desse conversor.
6. O histórico completo fica no banco; a UI limita a quantidade de registros retornados por consulta. Imagens substituídas não são removidas automaticamente do bucket privado; pode ser incluída rotina de limpeza após homologação.
7. A redefinição de PIN exige verificação humana; não existe recuperação automática por e-mail/SMS. Tokens de acesso já emitidos podem permanecer válidos até sua expiração, mesmo após redefinir o PIN; para ambientes reais, é recomendável um mecanismo adicional de revogação global de sessões.
8. O projeto **depende de internet**; não inclui suporte offline, nem integração com sistemas corporativos, nem autorização oficial do fabricante.
9. Antes de ativar dados reais, valide RLS e regras de integridade com testes de integração no projeto Supabase configurado, incluindo permissões diretas pela API, e faça cópias de segurança conforme política da empresa.

---

Projeto independente para uso piloto e educacional. Ilustrações de equipamentos são esquemáticas, não oficiais. As orientações de checklist precisam ser confrontadas com manuais e procedimentos internos aprovados.


## Atualização V3 — layout simplificado

A V3 reorganiza a navegação, sem alteração do esquema do Supabase. Consulte `ATUALIZACAO-V3-LEIA.txt` para instruções rápidas.
