# 🎬 OFFLINET - Streaming & Nuvem LAN

Um servidor completo de streaming de mídia (estilo Netflix) e explorador de arquivos em nuvem privada para sua rede local (LAN), construído com alta performance usando **Bun**, **SQLite nativo (`bun:sqlite`)**, **React**, **React Router**, **Tailwind CSS v4** e **Lucide Icons**.

---

## ✨ Principais Funcionalidades

### 1. 🍿 Modo Filme (Estilo Netflix)
- **Banner Hero**: Destaque dinâmico para os filmes mais recentes ou em andamento com botão "Assistir Agora".
- **Continuar Assistindo**: Salva automaticamente o minuto e segundo exatos onde você parou no banco de dados SQLite nativo.
- **Carrosséis Categorizados**: Organização automática por "Adicionados Recentemente", agrupamento por volumes/discos e catálogo completo.
- **Player de Vídeo Customizado de Alta Performance**:
  - Suporte completo a **HTTP Range Requests (Status 206 Partial Content)** para seek instantâneo sem sobrecarregar a memória do servidor.
  - Atalhos de teclado: `Espaço` (Play/Pause), `←`/`→` (Voltar/Avançar 10s), `↑`/`↓` (Volume), `M` (Mudo), `F` (Tela Cheia), `ESC` (Fechar).
  - Seletor de velocidade de reprodução (0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x).
  - Suporte a legendas automáticas (`.srt` e `.vtt` encontrados na mesma pasta do filme).
  - Opção para abrir o link de stream direto em reprodutores externos como VLC.
- **Modal de Detalhes**: Exibe informações do arquivo, tamanho, formato, localização no disco, ações de download, exclusão e lista de outros episódios na mesma pasta.

### 2. 📁 Modo Explorador de Arquivos
- **Múltiplos Discos & Volumes**: Navegue entre diferentes unidades físicas e pastas configuradas (`C:\...`, `D:\...`, `E:\...` no Windows ou `/mnt/...` no Linux).
- **Navegação com Breadcrumbs**: Caminho visual interativo para qualquer nível de pasta.
- **Visualização em Grade ou Lista**: Alterne entre cartões com miniaturas ou tabela com dados detalhados de tamanho e data.
- **Upload com Drag & Drop**: Arraste múltiplos arquivos diretamente para a pasta selecionada com barra de progresso.
- **Visualizador de Mídias Integrado**:
  - Lightbox para fotos (`.jpg`, `.png`, `.webp`, `.gif`).
  - Tocador de áudio integrado com waveform para músicas e podcasts (`.mp3`, `.flac`, `.wav`, etc.).
  - Leitor de arquivos de texto e código (`.txt`, `.json`, `.md`).
- **Gerenciamento**: Criação de novas pastas, renomeação de itens e exclusão segura.

### 3. ⚙️ Gerenciamento de Armazenamento & Descoberta LAN
- **Configuração de Pastas em Múltiplos Discos**: Adicione pastas de qualquer unidade (ex: `D:\Filmes`, `E:\Series`, `C:\Users\...\Fotos`) com validação imediata de existência no sistema operacional.
- **Descoberta Automática de IP Local**: Identifica automaticamente os endereços IPv4 da sua máquina na rede (ex: `http://192.168.1.140:3000`) para que você conecte Smart TVs, smartphones e tablets sem precisar adivinhar o IP.
- **Geração Inteligente de Miniaturas**:
  - Imagens servidas com cache.
  - Detecção de cartazes locais (`poster.jpg`, `cover.jpg` ou `<nome-do-filme>.jpg`).
  - Captura automática de frames do vídeo via Canvas no navegador enviada para o cache do servidor.
  - Suporte nativo a extração via FFmpeg quando instalado.
  - Banners vetoriais SVG estilizados dinâmicos para vídeos sem miniatura prévia.

---

## 🚀 Como Iniciar o Projeto

### Pré-requisitos
- [Bun](https://bun.sh/) instalado (versão 1.1+).

### 1. Iniciar o Servidor (Produção / LAN pronta)
Basta rodar:

```bash
bun start
```

O servidor Bun irá:
1. Iniciar a API e o streaming na porta **3000**.
2. Servir o frontend React compilado.
3. Exibir no terminal os endereços de acesso na sua rede local:
   ```
   =======================================================
    🚀 OFFLINET - Streaming & Nuvem LAN (Bun Server)
   =======================================================
    Servidor local:   http://localhost:3000
    Acesso em outros dispositivos na rede local (LAN):
    👉 http://192.168.1.x:3000
   =======================================================
   ```

### 2. Modo Desenvolvimento (com Hot-Reload)
Se quiser rodar o Vite com recarregamento instantâneo do código front-end:

```bash
# Terminal 1 - Servidor Bun:
bun run server

# Terminal 2 - Frontend Vite:
bun run dev
```

---

## 📺 Como Conectar na Smart TV, Celular ou Tablet

1. Certifique-se de que a Smart TV, celular ou outro PC está conectado na **mesma rede Wi-Fi ou cabo Ethernet**.
2. Abra o navegador da Smart TV (Samsung Tizen Browser, LG WebOS Browser, Google Chrome na TV Android, etc.) ou do celular (Safari, Chrome).
3. Digite o endereço LAN exibido no topo da tela do OffliNet ou no terminal (exemplo: `http://192.168.1.140:3000`).
4. Pronto! O catálogo de filmes e o explorador funcionarão normalmente com streaming fluido.

---

## 💾 Configurando Pastas e Discos

No menu **"Discos & LAN"** no topo da página:
1. Digite um nome para a unidade (ex: `Disco D - Filmes`).
2. Digite o caminho no seu sistema operacional:
   - **Windows**: `D:\Filmes`, `E:\Series`, `C:\Arquivos`
   - **Linux / macOS**: `/mnt/storage/movies`, `/media/dados`
3. Clique em **"Adicionar e Indexar"**.
4. O servidor catalogará os arquivos automaticamente e manterá a biblioteca atualizada.
