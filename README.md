# Resplice — AI DJ Studio

Estúdio experimental de criação de mixes, com busca musical, organização de setlists e edição de trechos em uma timeline. Projeto de portfólio de Lucas, desenvolvido com assistência de IA.

> **Status: protótipo em desenvolvimento, local-first.** Não é um serviço de streaming nem uma aplicação multiusuário pronta para produção. Algumas interações de reprodução ainda precisam de validação e refinamento.

## A proposta

Explorar um fluxo de trabalho que conecta descoberta musical e montagem de mixes: buscar referências, organizar faixas, escolher pontos de entrada e saída e renderizar áudio com transições.

## Funcionalidades implementadas

- Busca no YouTube, com sinalização de indisponibilidade/quota e catálogo de demonstração.
- Integração Spotify via OAuth PKCE para consultar biblioteca e playlists, conforme as permissões da API.
- Biblioteca de links e arquivos locais, com File System Access API quando disponível.
- Setlist reordenável e timeline com seleção de trechos, controles de reprodução e marcador de posição.
- Planejamento de mixes com OpenAI quando configurado e fallback heurístico.
- Renderização de áudio com Python, yt-dlp e FFmpeg, incluindo cortes e transições.
- Exportação WAV do mix e download de áudio suportado para a biblioteca.

## Stack e arquitetura

| Camada | Tecnologias / responsabilidade |
| --- | --- |
| Interface | Next.js App Router, React, TypeScript e Tailwind CSS |
| Backend local | Route Handlers do Next.js e servidor HTTP Node auxiliar |
| Áudio | Python, yt-dlp, FFmpeg e ffprobe |
| Integrações | YouTube Data API, Spotify OAuth PKCE e OpenAI |
| Persistência | localStorage, IndexedDB e arquivos locais de sessão |

```text
Navegador → Next.js :3939 → APIs de busca / planejamento / renderização
          ↘ Node HTTP :3941 → helpers Python → yt-dlp + FFmpeg
```

O servidor auxiliar atende downloads e trechos de áudio. A renderização depende de processos locais; esta arquitetura não funciona integralmente como um site estático no GitHub Pages.

## Executando localmente

### Pré-requisitos

- Node.js 22 e npm.
- Python 3.11 ou superior.
- FFmpeg e ffprobe disponíveis no PATH.
- yt-dlp instalado no interpretador Python utilizado pelo app.
- Credenciais próprias das integrações que deseja utilizar.

```bash
npm ci
python -m pip install -r requirements.txt
```

Copie `.env.example` para `.env.local` e preencha as variáveis necessárias. Não compartilhe esse arquivo. Configure `PYTHON_PATH` com o caminho do seu interpretador Python.

No dashboard do Spotify, registre exatamente:

```text
http://127.0.0.1:3939/api/spotify/callback
```

Inicie o Next.js em um terminal:

```bash
npm run dev -- --hostname 127.0.0.1 --port 3939
```

Em outro terminal, configure `PYTHON_PATH` no ambiente do processo Node e inicie o servidor auxiliar:

```bash
# Bash (Linux/macOS/Git Bash)
PYTHON_PATH=python node downloads-server.mjs
```

```powershell
# PowerShell
$env:PYTHON_PATH = "python"
node downloads-server.mjs
```

Abra **http://127.0.0.1:3939**.

> O servidor Node auxiliar não carrega `.env.local` automaticamente. Defina `PYTHON_PATH` no terminal dele. Alguns scripts ainda contêm caminhos de fallback específicos do ambiente Windows original; mantenha Python e FFmpeg no PATH e ajuste o ambiente antes de usar em outra máquina. O `Resplice Launcher.bat` existente também precisa ser adaptado ao caminho da instalação.

### Verificações

```bash
npm run build
npm run lint
```

A existência desses comandos não significa que todos os testes ou lint estejam passando. A reprodução de áudio e os fluxos com APIs externas exigem testes manuais e credenciais válidas.

## Limitações e próximos passos

- Refinar scrubbing, pausa/retomada e sincronização do marcador da timeline.
- Validar a prévia do mix de ponta a ponta e tratar bloqueios de reprodução do navegador com feedback visível.
- Tornar o setup independente dos caminhos Windows da máquina original.
- Adicionar testes automatizados para reprodução, permissões de pasta e renderização.
- Melhorar cache, limpeza de arquivos temporários e cancelamento de tarefas.
- Endurecer validação de URLs, autenticação e proteção dos endpoints antes de qualquer exposição pública do backend.
- Spotify fornece metadados e previews quando disponíveis: **não fornece áudio completo para renderização**. O pipeline de mix atual utiliza fontes YouTube suportadas.
- Faixas do catálogo demo podem não ter URLs reais e não são garantia de áudio reproduzível.
- Quotas, permissões, disponibilidade de vídeos e mudanças das APIs podem limitar recursos.
- A permissão de pastas pode precisar ser renovada pelo navegador. A pasta salva não equivale a acesso permanente.

## Aprendizados demonstrados

- Integração entre uma interface React e um pipeline de processamento de áudio em Python.
- OAuth PKCE, persistência local e gestão de permissões do navegador.
- Modelagem de setlists, trechos e transições.
- Tratamento de estados degradados quando integrações externas não estão disponíveis.
- Iteração de produto a partir de problemas reais de reprodução e interação.

## Segurança, direitos e publicação

- `.env.local`, tokens Spotify, mídia gerada e executáveis locais ficam fora do versionamento.
- O armazenamento atual de tokens em arquivos foi feito para uso local individual, não para um SaaS público.
- Utilize somente conteúdo próprio, licenciado ou cujo uso e processamento sejam autorizados. Respeite os direitos dos titulares e os termos de cada plataforma.
- Não há licença de código aberto definida ainda. Um repositório público permite visualizar o código, mas não concede automaticamente permissões amplas de reutilização.

## Apresentação no portfólio

**Resumo sugerido:** “Resplice é um protótipo local de AI DJ Studio que integra descoberta musical, edição de trechos e renderização de mixes, combinando Next.js/TypeScript com Python e FFmpeg.”

Uma demonstração curta com áudio autorizado e capturas da interface é o próximo passo recomendado. Ainda não há demo pública hospedada nem release portátil validada.
