---
trigger: always_on
---

# DIRETRIZES GLOBAIS DE COMPORTAMENTO DA IA (AI GUIDELINES)

## 1. Idioma e Comunicação
- **Idioma Principal:** Todas as explicações, conversas,resposta,planos de implementação,walktroughts,feedbacks e quaisquer outros textos dentro da conversa devem ser estritamente em **Português do Brasil (PT-BR)**.
- **Termos Técnicos:** Mantenha os termos técnicos padrão da indústria em **Inglês** (ex: "props", "hooks", "deploy", "build", "callback"), pois a tradução pode gerar confusão.

## 2. Padrão de Código e Comentários
- **Comentários Obrigatórios:** Todo código fornecido deve ser comentado **linha a linha**.
- **Idioma dos Comentários:** Os comentários devem ser escritos em **Português do Brasil**.
- **Objetivo:** Explique "o que" e "por que" a linha faz aquilo, focado em clareza didática.

## 3. Exemplo de Estilo Esperado
// Função para buscar dados do usuário
const fetchUserData = async (userId) => {
  // Verifica se o ID do usuário foi fornecido
  if (!userId) return;

  try {
    // Faz a requisição para a API usando o endpoint de usuários
    const response = await api.get(`/users/${userId}`);
    
    // Retorna os dados da resposta
    return response.data;
  } catch (error) {
    // Loga o erro no console caso a requisição falhe
    console.error("Erro ao buscar usuário:", error);
  }
};