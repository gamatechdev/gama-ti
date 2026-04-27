import { useState, useEffect } from 'react';

// Exporta o hook utilitário customizado para podermos capturar a largura de tela com reatividade nativa do React
export function useScreenWidth() {
  // Inicializamos a variável de estado extraindo nativamente a largura através do innerWidth
  const [width, setWidth] = useState<number>(
    // Fazemos um check preventivo para evitar erros durante hidratação, caso seja executado via server side
    typeof window !== 'undefined' ? window.innerWidth : 0
  );

  // UseEffect para conectar e amarrar os hooks de Resize sempre e apenas quando o componente montar
  useEffect(() => {
    // Verifica se window existe no contexto atual para contornar qualquer problema extra
    if (typeof window === 'undefined') return;

    // Função local para enviar o valor atualizado da largura inteira de tela pro nosso React state
    const handleResize = () => {
      setWidth(window.innerWidth);
    };

    // Fica 'ouvindo' e injeta a rotina nativa na janela do navegador do usuário
    window.addEventListener('resize', handleResize);

    // Etapa crucial: Faz a ação reversa ao desmontar o componente limpando da memória de eventos atrelados
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []); // Dependência vazia, portanto a montagem se aplicará apenas 1 vez ao se conectar

  // Retorna o valor numérico puro provido reativamente da largura do usuário em tempo real
  return width;
}
