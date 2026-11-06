# Corte Certo — regras do projeto

## O app é pensado para celular, sempre

Toda tela e funcionalidade nova é desenhada primeiro para smartphone (iPhone e Android, de 320 px
de largura para cima). Desktop é secundário. Referências: Apple Human Interface Guidelines e
Material Design 3.

Regras que já valem no código e devem ser mantidas:

- **Toque**: alvos de no mínimo 44×44 px; `touch-action: manipulation`; sem destaque azul de toque.
- **Zona do polegar**: a ação principal de cada tela fica no botão fixo da barra inferior (`#primary`).
- **Navegação nativa**: barra superior com "voltar", título e progresso; cada tela entra no
  histórico (History API), então o botão voltar do Android e o gesto de voltar do iPhone funcionam.
  Telas em tela cheia (câmera) também empilham no histórico.
- **Áreas seguras**: usar `env(safe-area-inset-*)` em tudo que encosta nas bordas (notch, barra de gestos).
- **Sem rolagem lateral** em nenhuma tela; testar em 320, 390 e 412 px.
- **Campos de texto com 16 px ou mais** (abaixo disso o iPhone dá zoom ao focar).
- **Componentes nativos**: controle segmentado em vez de chips; folha de compartilhamento do sistema
  (`navigator.share`); vibração curta (`navigator.vibrate`) como resposta tátil; fonte do sistema
  no texto da interface.
- **Modo escuro** e `prefers-reduced-motion` respeitados.
- **PWA**: `manifest.json`, ícones e `sw.js`. Ao mudar arquivos da "casca", subir a `VERSION` em `sw.js`.
- **Câmera**: as fotos são salvas sem espelhar (senão o perfil esquerdo vira direito); a prévia da
  câmera frontal é espelhada só na tela.

## Como testar

`python app.py` (sem `ANTHROPIC_API_KEY` roda em modo demonstração) e abrir no celular ou no
Playwright com emulação de aparelho (`devices['iPhone 13']`, `devices['Pixel 7']`,
`devices['iPhone SE']`). Para a câmera no Playwright: Chromium com
`--use-fake-device-for-media-stream --use-fake-ui-for-media-stream` e permissão `camera`.
