# 🚀 Guia de Deploy na Vercel - Sistema LUCIUS v5.8

Siga estes passos para colocar a versão mais estável do sistema em produção.

## 1. Preparação do Banco de Dados (Supabase)

Antes de fazer o deploy, certifique-se de que o seu banco de dados está atualizado com as últimas migrações:

1.  Acesse o **SQL Editor** no painel do seu projeto Supabase.
2.  **Passo A:** Execute o conteúdo do arquivo `sql/MASTER_INSTALL_V5_4.sql`.
3.  **Passo B:** Execute o conteúdo do arquivo `sql/UPDATE_CONDICIONAL_V5_6.sql`.
    *(Este passo é essencial para o novo funcionamento do estoque de condicionais).*

## 2. Configuração das Variáveis de Ambiente

Na Vercel, acesse as configurações do seu projeto (**Settings > Environment Variables**) e adicione as seguintes variáveis:

| Variável | Valor |
| :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Sua URL do Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sua chave anônima (anon/public) |
| `NEXT_PUBLIC_ENABLE_DEV_FEATURES` | `false` |

*Nota: Definir `NEXT_PUBLIC_ENABLE_DEV_FEATURES` como `false` garante que recursos de teste (como a aba Condicional legada e Resumo de Caixas de teste) fiquem ocultos para o usuário final.*

## 3. Comandos para Deploy via CLI

Se você utiliza a Vercel CLI, execute os seguintes comandos no terminal:

```bash
# 1. Instalar a CLI globalmente (caso não tenha)
npm install -g vercel

# 2. Fazer login na sua conta
vercel login

# 3. Vincular o projeto local ao projeto na Vercel
vercel link

# 4. Fazer o deploy oficial para produção
vercel --prod
```

## 4. Deploy Automático (Recomendado)

A melhor forma de manter o sistema atualizado é conectando o seu repositório do GitHub diretamente à Vercel:

1.  Crie um novo projeto na Vercel.
2.  Selecione "Import" e escolha o seu repositório Git.
3.  Configure as variáveis de ambiente mencionadas no passo 2.
4.  Clique em "Deploy".
5.  A partir de agora, cada `git push` na branch `main` atualizará o sistema automaticamente.

---

**Desenvolvido com foco em estabilidade e precisão.**
