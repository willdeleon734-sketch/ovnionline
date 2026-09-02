const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');

const PORTA = process.env.PORT || 8080;

// Estado do mundo — FONTE ÚNICA DA VERDADE
const mundo = {
  jogadores: {},
  sois: [],
  planetas: [],
  ouros: [],
  artefatos: { sol: null, buracoNegro: null, fragmento: null },
  buracoNegro: null
};

// Servidor HTTP + WebSocket
const servidor = http.createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end(fs.readFileSync(path.join(__dirname, 'index.html')));
  } else {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({ status: 'online' }));
  }
});

const wss = new WebSocket.Server({ server: servidor });

// Enviar estado completo para todos
function broadcast(excetoId = null) {
  const dados = JSON.stringify({ tipo: 'mundo', dados: mundo });
  wss.clients.forEach(cliente => {
    if (cliente.readyState === WebSocket.OPEN && cliente.id !== excetoId) {
      cliente.send(dados);
    }
  });
}

wss.on('connection', (ws) => {
  const meuId = Math.random().toString(36).substring(2, 10);
  ws.id = meuId;

  console.log(`✅ Jogador conectado: ${meuId}`);

  // Novo jogador entra
  mundo.jogadores[meuId] = {
    id: meuId,
    x: 0, y: 0,
    ouro: 0,
    nome: `Jogador ${meuId.substring(0,4)}`,
    ultimoPing: Date.now()
  };

  // Envia ID próprio + mundo completo
  ws.send(JSON.stringify({ tipo: 'bemvindo', meuId: meuId, mundo: mundo }));
  broadcast(meuId);

  // Recebe dados do jogador
  ws.on('message', (mensagem) => {
    try {
      const msg = JSON.parse(mensagem);
      
      switch(msg.tipo) {
        case 'posicao':
          if (mundo.jogadores[meuId]) {
            mundo.jogadores[meuId].x = msg.x;
            mundo.jogadores[meuId].y = msg.y;
            mundo.jogadores[meuId].ouro = msg.ouro;
            mundo.jogadores[meuId].temArtefatoSol = msg.temArtefatoSol;
            mundo.jogadores[meuId].temArtefatoBN = msg.temArtefatoBN;
            mundo.jogadores[meuId].ultimoPing = Date.now();
          }
          break;
        case 'criarSol':
          mundo.sois.push({
            id: `sol_${Date.now()}`,
            x: msg.x, y: msg.y,
            criadoPor: meuId,
            hp: 500, hpMax: 500
          });
          break;
        case 'criarPlaneta':
          mundo.planetas.push({
            id: `planeta_${Date.now()}`,
            x: msg.x, y: msg.y,
            vx: msg.vx, vy: msg.vy,
            cor: msg.cor,
            nome: msg.nome,
            solOrbitaId: msg.solOrbitaId,
            criadoPor: meuId
          });
          break;
        case 'coletarOuro':
          mundo.ouros = mundo.ouros.filter(o => o.id !== msg.id);
          break;
        case 'criarBuracoNegro':
          mundo.buracoNegro = { x: msg.x, y: msg.y, tempo: 15000, raio: 12 };
          break;
      }

      broadcast(meuId);
    } catch(e) {}
  });

  // Jogador sai
  ws.on('close', () => {
    console.log(`❌ Jogador saiu: ${meuId}`);
    delete mundo.jogadores[meuId];
    broadcast();
  });
});

// Limpa jogadores inativos a cada 15s
setInterval(() => {
  const agora = Date.now();
  for(const id in mundo.jogadores) {
    if (agora - mundo.jogadores[id].ultimoPing > 15000) {
      delete mundo.jogadores[id];
      broadcast();
    }
  }
}, 5000);

servidor.listen(PORTA, () => {
  console.log(`🌍 Servidor rodando na porta ${PORTA}`);
});