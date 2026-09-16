# Plano de Implementação: Player de Áudio Moderno, Playlists e Build Bun 100%

O objetivo é transformar a experiência de áudio do **OffliNet** em um player de nível profissional e design moderno (estilo Spotify/Apple Music), com suporte a:
1. **Miniplayer fixo e persistente**: Fica ancorado na parte inferior da tela, permitindo navegar pelos filmes, pastas e configurações sem interromper a música.
2. **Visualização expandida / Full Player**: Capa em alta definição, barra de progresso com seek, controle de volume, botão de modo repetição (desligado, repetir tudo, repetir uma), shuffle/aleatório e visualizador de fila.
3. **Reprodução sequencial de pastas ("Tocar Pasta")**: Botão para enfileirar e tocar todas as músicas do diretório atual em ordem.
4. **Gerenciador de Playlists**:
   - Criação de playlists personalizadas armazenadas no SQLite nativo (`bun:sqlite`).
   - Adicionar/remover músicas de qualquer pasta a playlists.
   - Executar playlists inteiras em sequência ou modo aleatório.
5. **Remoção definitiva do Vite & Build 100% Bun**: Empacotamento nativo via `bun build` e `@tailwindcss/cli`, sem dependência de Vite.

---

## 1. Banco de Dados SQLite (`src/server/db.ts` & `src/types/index.ts`)

- Novas tabelas no SQLite:
  - `playlists`:
    - `id TEXT PRIMARY KEY`
    - `name TEXT NOT NULL`
    - `created_at INTEGER NOT NULL`
  - `playlist_items`:
    - `id TEXT PRIMARY KEY`
    - `playlist_id TEXT NOT NULL`
    - `file_id TEXT NOT NULL`
    - `position INTEGER NOT NULL`
    - `added_at INTEGER NOT NULL`
    - Chaves estrangeiras com `ON DELETE CASCADE`.

- `playlistRepo` com métodos:
  - `getAll()`: lista todas as playlists com contagem de faixas.
  - `getById(id)`: retorna a playlist com todas as faixas (FileItem completo).
  - `create(name)`: cria nova playlist.
  - `delete(id)`: remove playlist.
  - `addItem(playlistId, fileId)`: adiciona música à playlist.
  - `removeItem(playlistId, fileId)`: remove música da playlist.

---

## 2. Rotas Backend da API de Playlists (`src/server/routes/media.ts` ou `playlists.ts`)

- `GET /api/playlists`: Retorna lista de playlists.
- `POST /api/playlists`: Cria nova playlist `{ name: string }`.
- `GET /api/playlists/:id`: Retorna dados da playlist e itens `FileItem[]`.
- `DELETE /api/playlists/:id`: Deleta playlist.
- `POST /api/playlists/:id/items`: Adiciona música `{ fileId: string }`.
- `DELETE /api/playlists/:id/items/:fileId`: Remove música.

---

## 3. Frontend: Contexto Global de Áudio & Componentes

### 3.1. `AudioPlayerContext` (`src/client/context/AudioContext.tsx`)
- Gerencia estado global de áudio acessível por toda a aplicação:
  - `currentTrack: FileItem | null`
  - `queue: FileItem[]`
  - `queueIndex: number`
  - `isPlaying: boolean`
  - `isMinimized: boolean`
  - `volume: number`
  - `isMuted: boolean`
  - `shuffle: boolean`
  - `repeatMode: 'off' | 'all' | 'one'`
  - Métodos: `playTrack(track, queue?)`, `playFolder(tracks, startIndex?)`, `playPlaylist(playlistId)`, `togglePlay()`, `nextTrack()`, `prevTrack()`, `seek(seconds)`, `setVolume(v)`, `setShuffle(s)`, `setRepeat(r)`, `toggleMinimized()`, `closePlayer()`.

### 3.2. `AudioPlayer.tsx` (`src/client/components/AudioPlayer.tsx`)
- **Modo Miniplayer Fixo (Ancorado no Rodapé)**:
  - Barra elegante e compacta com efeito `backdrop-blur` e gradiente escuro.
  - Exibe miniatura do álbum/faixa, título da música, nome do disco/pasta.
  - Botões rápidos: Play/Pause, Próxima, Anterior, Volume com slider, botão para expandir e botão para fechar.
  - Linha de progresso no topo do miniplayer.
- **Modo Full Player (Expandido)**:
  - Arte do álbum em tamanho grande com efeito de brilho atmosférico (glow).
  - Título da música, extensão e informações de formato/taxa.
  - Barra de progresso deslizável com tempo decorrido e restante formatados.
  - Controles completos: Shuffle, Voltar, Play/Pause gigante central, Avançar, Repetir (off/all/1), Volume com Mudo, e botão de Fila de Reprodução (Queue).
  - Gaveta/Painel da fila de reprodução com lista de próximas músicas (podendo clicar para pular direto para uma faixa).

### 3.3. `PlaylistModal.tsx` (`src/client/components/PlaylistModal.tsx`)
- Modal intuitivo para:
  - Adicionar a faixa atual/selecionada a uma playlist existente com 1 clique.
  - Criar uma nova playlist diretamente no diálogo.
  - Gerenciar playlists salvas.

### 3.4. Integração no `FileExplorer.tsx`
- Se houver arquivos de áudio na pasta atual:
  - Adicionar botão de destaque na barra de ferramentas: **"Tocar Pasta" / "Tocar em Sequência"** com ícone de reprodução.
  - Clicar em qualquer arquivo de áudio (`.mp3`, `.flac`, `.wav`, `.aac`, `.ogg`, `.m4a`) inicia a reprodução imediatamente no AudioPlayer global e define todos os áudios da pasta como fila subsequente.
  - Adicionar menu/opção "Adicionar à Playlist" nas opções do arquivo de áudio.

---

## 4. Remoção do Vite & Pipeline de Build 100% Bun

- Atualizar `package.json`:
  - `build:css`: `bunx @tailwindcss/cli -i ./src/client/index.css -o ./dist/index.css --minify`
  - `build:js`: `bun build ./src/client/main.tsx --outdir ./dist --entry-naming [name].[ext] --minify`
  - `build`: compila CSS e JS e gera `dist/index.html`.
- Garantir que `index.html` em `dist/` carrega `/index.css` e `/main.js`.
- O servidor Bun em `src/server/index.ts` serve diretamente os arquivos compilados sem precisar do Vite em desenvolvimento ou produção.
- **Aviso**: O processo Bun rodando com `--hot` não será interrompido nem reiniciado!

---

## 5. Plano de Verificação

1. **Build Nativo Bun**:
   - Rodar `bun run build:css` e `bun run build:js` e verificar geração sem erros de sintaxe ou tipo.
2. **API de Playlists**:
   - Testar chamadas REST para criação de playlist e adição de músicas.
3. **Navegador e Interface**:
   - Entrar em uma pasta com músicas no Explorador.
   - Clicar em "Tocar Pasta" e verificar se o player inicia e toca em sequência.
   - Minimizar para o Miniplayer fixo e navegar até o "Modo Filme" e "Armazenamento", garantindo que a música continua tocando ininterruptamente.
   - Expandir de volta e testar controles de volume, seek, shuffle e repetição.
