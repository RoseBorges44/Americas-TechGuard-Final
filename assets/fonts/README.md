# assets/fonts/

Fontes locais em `*.woff2` - **nunca CDN** (regra §4: zero rede na demo).

Três papéis (direção de design da Fase 2):
- display condensado - números da cota (o objeto mais legível da tela);
- corpo neutro - texto;
- **monoespaçada obrigatória** - o quadro de 23 bytes.

Enquanto os `.woff2` não chegam, o `index.html` usa a pilha de fontes do sistema
(`system-ui` + `ui-monospace`). Trocar por `@font-face` local nas tarefas de estilo.
