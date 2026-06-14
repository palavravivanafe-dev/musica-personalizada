require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const APIFRAME_KEY = process.env.APIFRAME_KEY;
const MP_TOKEN = process.env.MP_ACCESS_TOKEN;
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const PRECO = 27;
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;

const mpClient = new MercadoPagoConfig({ accessToken: MP_TOKEN });
const sessions = new Map();

// ── FIX PERMANENTE: reescreve index.html correto a cada restart ──
const INDEX_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Criar Minha Música Personalizada</title>
  <meta name="description" content="Transforme sua história em uma música inesquecível. 100% original, ouça antes de pagar." />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #0a0a0f; color: #f0f0f0; min-height: 100vh; }

    .header { background: linear-gradient(135deg, #1a0a2e 0%, #0d0d1a 100%); border-bottom: 1px solid #2a1a4a; padding: 14px 20px; text-align: center; }
    .header-badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(139,92,246,0.15); border: 1px solid rgba(139,92,246,0.3); border-radius: 20px; padding: 6px 14px; font-size: 13px; color: #c4b5fd; }

    .hero { background: linear-gradient(135deg, #1a0a2e 0%, #0d1a2e 50%, #0a0a0f 100%); padding: 50px 20px 40px; text-align: center; }
    .hero h1 { font-size: clamp(26px, 5vw, 42px); font-weight: 800; line-height: 1.2; margin-bottom: 16px; background: linear-gradient(135deg, #fff 30%, #c4b5fd); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .hero p { font-size: 16px; color: #a0a0c0; max-width: 520px; margin: 0 auto 28px; line-height: 1.6; }
    .hero-badges { display: flex; justify-content: center; flex-wrap: wrap; gap: 10px; }
    .hero-badge { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 20px; padding: 6px 14px; font-size: 13px; color: #d0d0e8; }

    .depoimentos { background: #0f0f1a; padding: 40px 20px; }
    .depoimentos h2 { text-align: center; font-size: 22px; color: #c4b5fd; margin-bottom: 24px; }
    .depoimentos-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; max-width: 900px; margin: 0 auto; }
    .depoimento-card { background: rgba(139,92,246,0.08); border: 1px solid rgba(139,92,246,0.2); border-radius: 14px; padding: 20px; }
    .depoimento-stars { color: #f59e0b; font-size: 15px; margin-bottom: 10px; }
    .depoimento-texto { font-size: 14px; color: #c0c0d8; line-height: 1.6; margin-bottom: 12px; }
    .depoimento-autor { font-size: 13px; color: #8b5cf6; font-weight: 600; }

    .form-section { padding: 40px 20px 60px; max-width: 620px; margin: 0 auto; }
    .form-title { text-align: center; font-size: 22px; font-weight: 700; margin-bottom: 28px; color: #e0e0ff; }

    .progress-bar { display: flex; justify-content: center; gap: 8px; margin-bottom: 32px; }
    .progress-step { width: 36px; height: 36px; border-radius: 50%; border: 2px solid #2a1a4a; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: #555; transition: all 0.3s; }
    .progress-step.active { border-color: #8b5cf6; background: #8b5cf6; color: #fff; }
    .progress-step.done { border-color: #6d28d9; background: #6d28d9; color: #fff; }

    .step { display: none; }
    .step.active { display: block; }
    .step-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #8b5cf6; margin-bottom: 6px; }
    .step h2 { font-size: 24px; font-weight: 700; margin-bottom: 24px; color: #f0f0ff; }

    label { display: block; font-size: 14px; color: #b0b0c8; margin-bottom: 6px; font-weight: 500; }
    label span.req { color: #f87171; }
    .field { margin-bottom: 20px; }
    input[type="text"], textarea, select { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; padding: 12px 14px; font-size: 15px; color: #f0f0f0; outline: none; transition: border-color 0.2s; }
    input[type="text"]:focus, textarea:focus, select:focus { border-color: #8b5cf6; }
    textarea { resize: vertical; min-height: 90px; }
    select option { background: #1a1a2e; }

    .opcoes { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; margin-bottom: 8px; }
    .opcao { border: 2px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 12px 8px; text-align: center; font-size: 14px; color: #c0c0d8; cursor: pointer; transition: all 0.2s; user-select: none; }
    .opcao:hover { border-color: #8b5cf6; color: #e0e0ff; }
    .opcao.selected { border-color: #8b5cf6; background: rgba(139,92,246,0.15); color: #fff; }
    .opcao .emoji { display: block; font-size: 22px; margin-bottom: 4px; }

    .opcoes-sentimento { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
    .opcao-sentimento { border: 2px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 8px 16px; font-size: 13px; color: #c0c0d8; cursor: pointer; transition: all 0.2s; user-select: none; }
    .opcao-sentimento:hover { border-color: #8b5cf6; }
    .opcao-sentimento.selected { border-color: #8b5cf6; background: rgba(139,92,246,0.15); color: #fff; }

    .btn-row { display: flex; gap: 12px; margin-top: 32px; }
    .btn-back { flex: 0 0 auto; background: transparent; border: 1px solid rgba(255,255,255,0.15); border-radius: 10px; padding: 14px 20px; font-size: 15px; color: #a0a0c0; cursor: pointer; transition: all 0.2s; }
    .btn-back:hover { border-color: rgba(255,255,255,0.3); color: #e0e0ff; }
    .btn-next { flex: 1; background: linear-gradient(135deg, #7c3aed, #6d28d9); border: none; border-radius: 10px; padding: 14px 24px; font-size: 16px; font-weight: 700; color: #fff; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 20px rgba(109,40,217,0.4); }
    .btn-next:hover { background: linear-gradient(135deg, #8b5cf6, #7c3aed); transform: translateY(-1px); }
    .btn-next:active { transform: translateY(0); }

    .preco-box { background: rgba(139,92,246,0.08); border: 1px solid rgba(139,92,246,0.3); border-radius: 14px; padding: 20px; text-align: center; margin-bottom: 24px; }
    .preco-de { font-size: 14px; color: #888; text-decoration: line-through; }
    .preco-por { font-size: 36px; font-weight: 800; color: #c4b5fd; }
    .preco-desc { font-size: 13px; color: #888; }
    .preco-features { margin-top: 14px; text-align: left; }
    .preco-features li { font-size: 14px; color: #c0c0d8; padding: 4px 0; list-style: none; }
    .preco-features li::before { content: '✅ '; }

    #loading-section { display: none; text-align: center; padding: 60px 20px; }
    .spinner { width: 56px; height: 56px; border: 4px solid rgba(139,92,246,0.2); border-top-color: #8b5cf6; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 24px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    #loading-section h2 { font-size: 22px; color: #c4b5fd; margin-bottom: 10px; }
    #loading-section p { color: #888; font-size: 15px; }
    .loading-dots span { display: inline-block; width: 8px; height: 8px; background: #8b5cf6; border-radius: 50%; margin: 0 3px; animation: bounce 1.2s infinite ease-in-out; }
    .loading-dots span:nth-child(2) { animation-delay: 0.2s; }
    .loading-dots span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }

    #musicas-section { display: none; padding: 20px; max-width: 620px; margin: 0 auto 60px; }
    #musicas-section h2 { font-size: 22px; color: #c4b5fd; text-align: center; margin-bottom: 20px; }
    .musica-card { background: rgba(139,92,246,0.08); border: 1px solid rgba(139,92,246,0.2); border-radius: 14px; padding: 20px; margin-bottom: 16px; transition: border-color 0.2s; }
    .musica-card.selecionada { border-color: #8b5cf6; background: rgba(139,92,246,0.15); }
    .musica-card h3 { font-size: 16px; color: #e0e0ff; margin-bottom: 12px; }
    .player-protegido { position: relative; width: 100%; }
    .player-protegido audio { width: 100%; }

    .btn-escolher { width: 100%; margin-top: 14px; background: linear-gradient(135deg, #7c3aed, #6d28d9); border: none; border-radius: 10px; padding: 12px; font-size: 15px; font-weight: 700; color: #fff; cursor: pointer; transition: all 0.2s; }
    .btn-escolher:hover { background: linear-gradient(135deg, #8b5cf6, #7c3aed); }
    .btn-escolher.chosen { background: linear-gradient(135deg, #059669, #047857); }

    .btn-pagar { display: inline-block; background: linear-gradient(135deg, #059669, #047857); color: #fff; text-decoration: none; border-radius: 12px; padding: 16px 32px; font-size: 18px; font-weight: 700; cursor: pointer; border: none; width: 100%; max-width: 400px; box-shadow: 0 4px 20px rgba(5,150,105,0.4); transition: all 0.2s; }
    .btn-pagar:hover { transform: translateY(-2px); }
    .pagamento-info { margin-top: 14px; font-size: 13px; color: #666; }

    .erro-box { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 10px; padding: 16px; color: #fca5a5; font-size: 14px; margin-top: 12px; display: none; }

    footer { text-align: center; padding: 30px 20px; border-top: 1px solid rgba(255,255,255,0.06); color: #444; font-size: 13px; }

    @media (max-width: 480px) {
      .opcoes { grid-template-columns: repeat(2, 1fr); }
      .btn-row { flex-direction: column-reverse; }
      .btn-back { width: 100%; }
    }
  </style>
</head>
<body>

<div class="header">
  <div class="header-badge">♪ +500 músicas entregues · 4.9★</div>
</div>

<div class="hero">
  <h1>Transforme sua história em uma música inesquecível</h1>
  <p>Criamos uma música personalizada com nomes, memórias e sentimentos reais — perfeita para emocionar quem você ama.</p>
  <div class="hero-badges">
    <span class="hero-badge">🎵 100% original</span>
    <span class="hero-badge">🎧 Ouça antes de pagar</span>
    <span class="hero-badge">🔒 Mercado Pago seguro</span>
  </div>
</div>

<div class="depoimentos">
  <h2>💬 O que nossos clientes dizem</h2>
  <div class="depoimentos-grid">
    <div class="depoimento-card">
      <div class="depoimento-stars">⭐⭐⭐⭐⭐</div>
      <div class="depoimento-texto">"Presentei minha mãe no aniversário de 60 anos com a música personalizada. Ela chorou tanto! Colocou nosso apelido, a cidade onde crescemos... ficou perfeito demais."</div>
      <div class="depoimento-autor">— Camila R., São Paulo</div>
    </div>
    <div class="depoimento-card">
      <div class="depoimento-stars">⭐⭐⭐⭐⭐</div>
      <div class="depoimento-texto">"Pedi uma música sertaneja para o pedido de namoro. Quando ela ouviu com o nome dela e a história do nosso primeiro encontro, disse sim na hora! 🥰"</div>
      <div class="depoimento-autor">— Lucas M., Belo Horizonte</div>
    </div>
    <div class="depoimento-card">
      <div class="depoimento-stars">⭐⭐⭐⭐⭐</div>
      <div class="depoimento-texto">"Fiz uma homenagem gospel para o pastor da nossa igreja. A congregação inteira emocionou. Vale muito mais do que R$27 — é uma lembrança para sempre."</div>
      <div class="depoimento-autor">— Fernanda L., Curitiba</div>
    </div>
  </div>
</div>

<div class="form-section">
  <div class="form-title">🎵 Criar Minha Música Personalizada</div>

  <div class="progress-bar">
    <div class="progress-step active" id="ps1">1</div>
    <div class="progress-step" id="ps2">2</div>
    <div class="progress-step" id="ps3">3</div>
    <div class="progress-step" id="ps4">4</div>
    <div class="progress-step" id="ps5">5</div>
  </div>

  <!-- PASSO 1 -->
  <div class="step active" id="step1">
    <div class="step-label">Passo 1 de 5</div>
    <h2>A Ocasião</h2>
    <div class="field">
      <label>Para qual momento especial é essa música? <span class="req">*</span></label>
      <div class="opcoes" id="ocasiao-opcoes">
        <div class="opcao" data-value="Casamento"><span class="emoji">💍</span>Casamento</div>
        <div class="opcao" data-value="Aniversário"><span class="emoji">🎂</span>Aniversário</div>
        <div class="opcao" data-value="Namoro"><span class="emoji">💑</span>Namoro</div>
        <div class="opcao" data-value="Dia das Mães"><span class="emoji">👩</span>Dia das Mães</div>
        <div class="opcao" data-value="Dia dos Pais"><span class="emoji">👨</span>Dia dos Pais</div>
        <div class="opcao" data-value="Formatura"><span class="emoji">🎓</span>Formatura</div>
        <div class="opcao" data-value="Homenagem"><span class="emoji">🙏</span>Homenagem</div>
        <div class="opcao" data-value="Outro"><span class="emoji">🎵</span>Outro</div>
      </div>
    </div>
    <div class="erro-box" id="erro1">Por favor, selecione a ocasião.</div>
    <div class="btn-row">
      <button class="btn-next" onclick="irPara(2)">Próximo →</button>
    </div>
  </div>

  <!-- PASSO 2 -->
  <div class="step" id="step2">
    <div class="step-label">Passo 2 de 5</div>
    <h2>Para quem é?</h2>
    <div class="field">
      <label>Nome da pessoa <span class="req">*</span></label>
      <input type="text" id="nome_p" placeholder="Ex: Maria, João..." maxlength="60" />
    </div>
    <div class="field">
      <label>Qual sua relação com ela? <span class="req">*</span></label>
      <input type="text" id="relacao" placeholder="Ex: minha mãe, minha namorada, meu filho..." maxlength="80" />
    </div>
    <div class="field">
      <label>Como descreveria essa pessoa em 3 palavras? <span class="req">*</span></label>
      <input type="text" id="palavras" placeholder="Ex: carinhosa, forte, alegre..." maxlength="100" />
    </div>
    <div class="field">
      <label>Qual a memória mais especial que têm juntos? <span class="req">*</span></label>
      <textarea id="memoria" placeholder="Conte com detalhes — quanto mais específico, mais emocionante fica a música!"></textarea>
    </div>
    <div class="erro-box" id="erro2">Por favor, preencha todos os campos obrigatórios.</div>
    <div class="btn-row">
      <button class="btn-back" onclick="irPara(1)">← Voltar</button>
      <button class="btn-next" onclick="irPara(3)">Próximo →</button>
    </div>
  </div>

  <!-- PASSO 3 -->
  <div class="step" id="step3">
    <div class="step-label">Passo 3 de 5</div>
    <h2>Estilo da Música</h2>
    <div class="field">
      <label>Gênero musical <span class="req">*</span></label>
      <div class="opcoes" id="estilo-opcoes">
        <div class="opcao" data-value="Pop"><span class="emoji">🎵</span>Pop</div>
        <div class="opcao" data-value="Sertanejo"><span class="emoji">🤠</span>Sertanejo</div>
        <div class="opcao" data-value="Gospel"><span class="emoji">✝️</span>Gospel</div>
        <div class="opcao" data-value="Pagode"><span class="emoji">🥁</span>Pagode</div>
        <div class="opcao" data-value="MPB"><span class="emoji">🎸</span>MPB</div>
        <div class="opcao" data-value="Reggae"><span class="emoji">🌿</span>Reggae</div>
        <div class="opcao" data-value="Rock"><span class="emoji">🎸</span>Rock</div>
        <div class="opcao" data-value="Balada"><span class="emoji">🎹</span>Balada</div>
      </div>
    </div>
    <div class="field">
      <label>Clima da música <span class="req">*</span></label>
      <div class="opcoes" id="clima-opcoes">
        <div class="opcao" data-value="Alegre"><span class="emoji">😄</span>Alegre</div>
        <div class="opcao" data-value="Emocionante"><span class="emoji">😢</span>Emocionante</div>
        <div class="opcao" data-value="Romantico"><span class="emoji">🥰</span>Romântico</div>
        <div class="opcao" data-value="Espiritual"><span class="emoji">🙏</span>Espiritual</div>
      </div>
    </div>
    <div class="field">
      <label>Algum cantor ou música de referência? <small style="color:#666">(opcional)</small></label>
      <input type="text" id="ref" placeholder="Opcional — ajuda a acertar o tom." maxlength="100" />
    </div>
    <div class="erro-box" id="erro3">Por favor, selecione gênero e clima.</div>
    <div class="btn-row">
      <button class="btn-back" onclick="irPara(2)">← Voltar</button>
      <button class="btn-next" onclick="irPara(4)">Próximo →</button>
    </div>
  </div>

  <!-- PASSO 4 -->
  <div class="step" id="step4">
    <div class="step-label">Passo 4 de 5</div>
    <h2>Detalhes Especiais</h2>
    <div class="field">
      <label>Frase, apelido ou expressão especial de vocês? <small style="color:#666">(opcional)</small></label>
      <input type="text" id="frase" placeholder="Ex: 'minha vida toda', apelido carinhoso..." maxlength="120" />
    </div>
    <div class="field">
      <label>Algum lugar, música ou coisa especial para vocês? <small style="color:#666">(opcional)</small></label>
      <input type="text" id="especial" placeholder="Ex: a praia onde se conheceram, uma música favorita..." maxlength="150" />
    </div>
    <div class="field">
      <label>O que você quer que ela sinta ao ouvir? <small style="color:#666">(opcional)</small></label>
      <div class="opcoes-sentimento" id="sentir-opcoes">
        <div class="opcao-sentimento" data-value="Chorar de emoção">Chorar de emoção</div>
        <div class="opcao-sentimento" data-value="Sentir-se amada">Sentir-se amada</div>
        <div class="opcao-sentimento" data-value="Sorrir e lembrar">Sorrir e lembrar</div>
        <div class="opcao-sentimento" data-value="Sentir Deus perto">Sentir Deus perto</div>
        <div class="opcao-sentimento" data-value="Dançar e celebrar">Dançar e celebrar</div>
        <div class="opcao-sentimento" data-value="Ser homenageada">Ser homenageada</div>
      </div>
    </div>
    <div class="btn-row">
      <button class="btn-back" onclick="irPara(3)">← Voltar</button>
      <button class="btn-next" onclick="irPara(5)">Próximo →</button>
    </div>
  </div>

  <!-- PASSO 5 -->
  <div class="step" id="step5">
    <div class="step-label">Passo 5 de 5</div>
    <h2>Sua Música</h2>
    <p style="color:#888; margin-bottom:20px; font-size:14px;">Geramos 2 versões exclusivas para você escolher a favorita.</p>
    <div class="preco-box">
      <div class="preco-de">R$54</div>
      <div class="preco-por">R$27</div>
      <div class="preco-desc">pagamento único · 50% OFF hoje</div>
      <ul class="preco-features">
        <li>Receba 2 versões para escolher</li>
        <li>Ouça antes de pagar — sem risco</li>
        <li>Escolha a favorita e pague só por ela</li>
        <li>Download liberado na hora após pagamento</li>
      </ul>
    </div>
    <div class="btn-row">
      <button class="btn-back" onclick="irPara(4)">← Voltar</button>
      <button class="btn-next" onclick="gerarMusica()">🎵 Criar minha música agora</button>
    </div>
  </div>
</div>

<!-- LOADING -->
<div id="loading-section">
  <div class="spinner"></div>
  <h2>Criando suas músicas</h2>
  <p>Estamos compondo sua música personalizada.<br>Isso leva cerca de <strong>1 a 2 minutos</strong>.</p>
  <p style="margin-top:12px; color:#666; font-size:13px;">Não feche essa página! 🎵</p>
  <div class="loading-dots" style="margin-top:24px;"><span></span><span></span><span></span></div>
</div>

<!-- MÚSICAS -->
<div id="musicas-section">
  <h2>🎧 Ouça as versões e escolha a sua favorita:</h2>
  <div id="musicas-lista"></div>
  <div style="text-align:center; margin-top:8px;">
    <div class="preco-de" style="font-size:14px; color:#666;">R$54</div>
    <div class="preco-por" style="font-size:28px; color:#c4b5fd;">R$27</div>
    <div style="font-size:13px; color:#666; margin-bottom:16px;">pagamento único · 50% OFF hoje</div>
  </div>
  <div id="btn-pagar-container" style="display:none; text-align:center;">
    <button class="btn-pagar" id="btn-pagar-final" onclick="iniciarPagamento()">🔒 Pagar R$27 e baixar a versão escolhida</button>
    <p class="pagamento-info">🔒 PIX, cartão de crédito e débito</p>
  </div>
  <div class="erro-box" id="erro-musicas" style="display:none; margin-top:12px;">Selecione uma versão para continuar.</div>
</div>

<footer>
  <p>© 2025 Música Personalizada · Feito com ❤️ para momentos especiais</p>
</footer>

<script>
  const dados = { ocasiao:'', nome_p:'', relacao:'', palavras:'', memoria:'', estilo:'', clima:'', ref:'', frase:'', especial:'', sentir:[] };
  let sessionId = null;
  let musicaSelecionada = null;
  let songs = [];
  let pollingTimer = null;

  function irPara(passo) {
    if (passo > 1 && !validarPasso(passo - 1)) return;
    coletarDados(passo - 1);
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.progress-step').forEach((ps, i) => {
      ps.classList.remove('active','done');
      if (i < passo-1) ps.classList.add('done');
      else if (i === passo-1) ps.classList.add('active');
    });
    const el = document.getElementById('step'+passo);
    if (el) el.classList.add('active');
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function validarPasso(passo) {
    document.querySelectorAll('.erro-box').forEach(e => e.style.display='none');
    if (passo===1 && !dados.ocasiao) { document.getElementById('erro1').style.display='block'; return false; }
    if (passo===2) {
      const n=document.getElementById('nome_p').value.trim();
      const r=document.getElementById('relacao').value.trim();
      const p=document.getElementById('palavras').value.trim();
      const m=document.getElementById('memoria').value.trim();
      if (!n||!r||!p||!m) { document.getElementById('erro2').style.display='block'; return false; }
    }
    if (passo===3 && (!dados.estilo||!dados.clima)) { document.getElementById('erro3').style.display='block'; return false; }
    return true;
  }

  function coletarDados(passo) {
    if (passo===2) {
      dados.nome_p=document.getElementById('nome_p').value.trim();
      dados.relacao=document.getElementById('relacao').value.trim();
      dados.palavras=document.getElementById('palavras').value.trim();
      dados.memoria=document.getElementById('memoria').value.trim();
    }
    if (passo===3) { dados.ref=document.getElementById('ref').value.trim(); }
    if (passo===4) {
      dados.frase=document.getElementById('frase').value.trim();
      dados.especial=document.getElementById('especial').value.trim();
    }
  }

  function setupOpcoes(containerId, campo, multiple) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll('.opcao,.opcao-sentimento').forEach(el => {
      el.addEventListener('click', () => {
        if (multiple) {
          el.classList.toggle('selected');
          dados[campo] = [...container.querySelectorAll('.selected')].map(e => e.dataset.value);
        } else {
          container.querySelectorAll('.opcao,.opcao-sentimento').forEach(o => o.classList.remove('selected'));
          el.classList.add('selected');
          dados[campo] = el.dataset.value;
        }
      });
    });
  }

  setupOpcoes('ocasiao-opcoes','ocasiao',false);
  setupOpcoes('estilo-opcoes','estilo',false);
  setupOpcoes('clima-opcoes','clima',false);
  setupOpcoes('sentir-opcoes','sentir',true);

  async function gerarMusica() {
    dados.nome_p=document.getElementById('nome_p').value.trim();
    dados.relacao=document.getElementById('relacao').value.trim();
    dados.palavras=document.getElementById('palavras').value.trim();
    dados.memoria=document.getElementById('memoria').value.trim();
    dados.ref=document.getElementById('ref').value.trim();
    dados.frase=document.getElementById('frase').value.trim();
    dados.especial=document.getElementById('especial').value.trim();

    if (!dados.ocasiao||!dados.nome_p||!dados.relacao||!dados.estilo||!dados.clima) {
      alert('Por favor, volte e preencha todos os campos obrigatórios.');
      return;
    }

    document.querySelector('.form-section').style.display='none';
    document.getElementById('loading-section').style.display='block';
    window.scrollTo({top:0,behavior:'smooth'});

    try {
      const res = await fetch('/api/generate', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(dados)
      });
      if (!res.ok) throw new Error('Erro ao iniciar geração');
      const json = await res.json();
      sessionId = json.sessionId;
      if (!sessionId) throw new Error('Sem sessionId');
      aguardarMusicas();
    } catch(err) {
      console.error(err);
      mostrarErroGeral('Ocorreu um erro ao gerar a música. Por favor, tente novamente.');
    }
  }

  function aguardarMusicas() {
    let tentativas = 0;
    pollingTimer = setInterval(async () => {
      tentativas++;
      if (tentativas > 60) {
        clearInterval(pollingTimer);
        mostrarErroGeral('A geração demorou mais que o esperado. Tente novamente.');
        return;
      }
      try {
        const res = await fetch('/api/status/' + sessionId);
        if (!res.ok) return;
        const json = await res.json();
        if (json.status === 'done' && json.songs && json.songs.length >= 1) {
          clearInterval(pollingTimer);
          songs = json.songs;
          mostrarMusicas(json.songs);
        }
      } catch(e) { console.error(e); }
    }, 2000);
  }

  function mostrarMusicas(songList) {
    document.getElementById('loading-section').style.display='none';
    const sec = document.getElementById('musicas-section');
    sec.style.display='block';
    const lista = document.getElementById('musicas-lista');
    lista.innerHTML='';
    songList.slice(0,2).forEach((s,i) => {
      const card = document.createElement('div');
      card.className='musica-card';
      card.id='musica-card-'+i;
      card.innerHTML=\`
        <h3>🎵 Versão \${i+1}\${s.title ? ' — '+s.title : ''}</h3>
        <div class="player-protegido">
          <audio controls controlsList="nodownload" preload="metadata">
            <source src="/api/stream/\${sessionId}/\${i}" type="audio/mpeg" />
          </audio>
        </div>
        <button class="btn-escolher" id="btn-escolher-\${i}" onclick="escolherMusica(\${i})">✅ Escolher esta versão</button>
      \`;
      lista.appendChild(card);
    });
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function escolherMusica(index) {
    musicaSelecionada = index;
    document.querySelectorAll('.musica-card').forEach((c,i) => c.classList.toggle('selecionada', i===index));
    document.querySelectorAll('[id^="btn-escolher-"]').forEach((b,i) => {
      b.textContent = i===index ? '✅ Versão escolhida!' : '✅ Escolher esta versão';
      b.classList.toggle('chosen', i===index);
    });
    document.getElementById('btn-pagar-container').style.display='block';
    document.getElementById('erro-musicas').style.display='none';
    setTimeout(() => document.getElementById('btn-pagar-container').scrollIntoView({behavior:'smooth',block:'center'}), 300);
  }

  async function iniciarPagamento() {
    if (musicaSelecionada === null) { document.getElementById('erro-musicas').style.display='block'; return; }
    const btn = document.getElementById('btn-pagar-final');
    btn.textContent='⏳ Gerando pagamento...';
    btn.disabled=true;
    try {
      const res = await fetch('/api/payment', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ sessionId, chosenIndex: musicaSelecionada })
      });
      if (!res.ok) throw new Error('Erro ao criar pagamento');
      const json = await res.json();
      if (json.checkoutUrl) {
        window.location.href = json.checkoutUrl;
      } else throw new Error('Link não encontrado');
    } catch(err) {
      console.error(err);
      btn.textContent='🔒 Pagar R$27 e baixar a versão escolhida';
      btn.disabled=false;
      alert('Erro ao gerar pagamento. Tente novamente.');
    }
  }

  function mostrarErroGeral(msg) {
    document.getElementById('loading-section').style.display='none';
    document.querySelector('.form-section').style.display='block';
    document.getElementById('step5').classList.add('active');
    alert(msg);
  }
</script>
</body>
</html>
`;
try {
  fs.writeFileSync(path.join(__dirname, 'public', 'index.html'), INDEX_HTML, 'utf8');
  console.log('[OK] index.html atualizado');
} catch(e) {
  console.error('[ERRO] index.html:', e.message);
}
// ─────────────────────────────────────────────────────────────────

function getStyleTags(d) {
  var estilo = (d.estilo || 'Pop').split(' ')[0];
  var clima = (d.clima || 'Romantico').split(' ')[0];
  var ref = d.ref || '';
  var prompts = {
    'Sertanejo': {
      'Alegre':      'Modern Brazilian sertanejo, acoustic guitar, steel guitar, upbeat rhythm, 78 BPM, joyful male vocal, romantic countryside atmosphere, catchy chorus, radio-quality production, Jorge & Mateus inspired energy',
      'Emocionante': 'Brazilian sertanejo ballad, acoustic guitar, emotional steel guitar, piano accents, 72 BPM, raspy emotional male vocal, heartfelt performance, romantic and touching atmosphere, powerful chorus',
      'Romantico':   'Romantic Brazilian sertanejo, warm acoustic guitar, soft piano, emotional vocal, 74 BPM, love song atmosphere, intimate storytelling, memorable chorus, wedding proposal feeling',
      'Espiritual':  'Romantic Brazilian sertanejo, warm acoustic guitar, soft piano, emotional vocal, 74 BPM, love song atmosphere, intimate storytelling, memorable chorus, wedding proposal feeling'
    },
    'Pop': {
      'Alegre':      'Modern Brazilian pop, bright piano, uplifting synths, commercial drums, catchy melody, joyful atmosphere, radio-ready production, contemporary hit song, energetic and positive',
      'Emocionante': 'Emotional pop ballad, piano driven, atmospheric synths, cinematic build-up, heartfelt vocal, emotional chorus, modern production, touching and inspiring mood',
      'Romantico':   'Romantic pop ballad, emotional piano, warm synth pads, intimate vocals, heartfelt lyrics, cinematic atmosphere, beautiful chorus, radio-quality production',
      'Espiritual':  'Emotional pop ballad, piano driven, atmospheric synths, cinematic build-up, heartfelt vocal, emotional chorus, modern production, touching and inspiring mood'
    },
    'Gospel': {
      'Espiritual':  'Brazilian gospel worship, emotional piano, choir harmonies, cinematic strings, powerful spiritual atmosphere, heartfelt male vocal, worship chorus, church worship style',
      'Emocionante': 'Inspirational gospel ballad, piano and strings, emotional choir, powerful worship vocals, faith-filled atmosphere, touching lyrics, cinematic production',
      'Alegre':      'Joyful gospel praise song, uplifting choir, piano, acoustic guitar, positive energy, celebration atmosphere, inspiring vocals, church praise style',
      'Romantico':   'Inspirational gospel ballad, piano and strings, emotional choir, powerful worship vocals, faith-filled atmosphere, touching lyrics, cinematic production'
    },
    'Pagode': {
      'Romantico':   'Romantic Brazilian pagode, cavaquinho, pandeiro, smooth percussion, warm vocals, joyful romantic atmosphere, catchy chorus, authentic samba pagode groove',
      'Alegre':      'Brazilian pagode, cavaquinho, tamborim, pandeiro, festive atmosphere, happy vocals, dancing groove, authentic roda de samba feeling',
      'Emocionante': 'Emotional pagode ballad, cavaquinho, soft percussion, heartfelt vocal performance, romantic atmosphere, touching chorus, authentic Brazilian pagode',
      'Espiritual':  'Emotional pagode ballad, cavaquinho, soft percussion, heartfelt vocal performance, romantic atmosphere, touching chorus, authentic Brazilian pagode'
    },
    'MPB': {
      'Romantico':   'Brazilian MPB, acoustic guitar, soft piano, poetic lyrics, intimate atmosphere, emotional vocal, sophisticated harmony, timeless Brazilian music style',
      'Emocionante': 'Emotional MPB ballad, acoustic guitar, piano, cinematic strings, heartfelt storytelling, poetic atmosphere, deep emotional vocal performance',
      'Alegre':      'Light Brazilian MPB, acoustic guitar, gentle percussion, sunny atmosphere, positive mood, warm vocals, sophisticated and elegant arrangement',
      'Espiritual':  'Emotional MPB ballad, acoustic guitar, piano, cinematic strings, heartfelt storytelling, poetic atmosphere, deep emotional vocal performance'
    },
    'Reggae': {
      'Romantico':   'Brazilian reggae roots, romantic and smooth, reggae rhythm guitar, bass-driven groove, warm vocals, laid-back atmosphere, love song feeling, roots reggae style',
      'Alegre':      'Upbeat Brazilian reggae, positive reggae vibes, dancehall influence, energetic rhythm guitar, happy atmosphere, feel-good vocals, summer feeling',
      'Emocionante': 'Emotional reggae ballad, deep roots reggae, soulful vocals, heavy bass, touching lyrics, spiritual and emotional atmosphere, reggae romantico brasileiro',
      'Espiritual':  'Spiritual reggae roots, rastafari influence, gospel reggae, uplifting message, warm bass, choir harmonies, faith and love combined'
    },
    'Rock': {
      'Emocionante': 'Emotional rock ballad, electric guitars, live drums, cinematic atmosphere, passionate male vocal, soaring chorus, powerful emotional performance',
      'Romantico':   'Romantic rock ballad, clean electric guitar, piano, emotional vocals, powerful chorus, cinematic production, heartfelt love song',
      'Alegre':      'Uplifting rock anthem, energetic guitars, live drums, positive atmosphere, powerful vocals, stadium-ready chorus, modern rock production',
      'Espiritual':  'Emotional rock ballad, electric guitars, live drums, cinematic atmosphere, passionate male vocal, soaring chorus, powerful emotional performance'
    },
    'Balada': {
      'Romantico':   'Cinematic romantic ballad, emotional piano, orchestral strings, heartfelt vocal, intimate atmosphere, wedding song feeling, powerful emotional chorus',
      'Emocionante': 'Emotional cinematic ballad, piano, strings, touching vocal performance, deep emotional atmosphere, movie soundtrack quality, heartfelt lyrics',
      'Espiritual':  'Inspirational piano ballad, cinematic strings, uplifting atmosphere, emotional vocal, spiritual feeling, powerful and moving arrangement',
      'Alegre':      'Cinematic romantic ballad, emotional piano, orchestral strings, heartfelt vocal, intimate atmosphere, wedding song feeling, powerful emotional chorus'
    }
  };
  var estiloPrompts = prompts[estilo] || prompts['Pop'];
  var prompt = estiloPrompts[clima] || estiloPrompts['Romantico'] || Object.values(estiloPrompts)[0];
  if (ref) prompt += ', inspired by ' + ref;
  return prompt;
}

async function buildLyrics(d) {
  var nome = d.nome_p || 'voce';
  var relacao = d.relacao || 'alguem especial';
  var palavras = d.palavras || 'especial';
  var memoria = d.memoria || '';
  var frase = d.frase || '';
  var especial = d.especial || '';
  var ocasiao = d.ocasiao || '';
  var estilo = (d.estilo || 'Pop').split(' ')[0];
  var clima = (d.clima || 'Romantico').split(' ')[0];
  var sentir = Array.isArray(d.sentir) ? d.sentir.join(', ') : (d.sentir || '');

  var prompt = 'Voce e um compositor GENIO de ' + estilo + ' brasileiro, nivel Marilia Mendonca, Henrique & Juliano, Legiao Urbana. Sua tarefa e criar uma letra POETICA, PROFISSIONAL e EMOCIONANTE.\n\nINFORMACOES DO CLIENTE (use como INSPIRACAO, NUNCA copie literalmente):\n- Destinatario: ' + nome + '\n- Quem envia: ' + relacao + '\n- Como ela e: ' + palavras + '\n- Como se conheceram / historia: ' + memoria + '\n- Algo especial: ' + (frase || especial || '') + '\n- Ocasiao: ' + (ocasiao || '') + '\n- Sentimento desejado: ' + (sentir || '') + '\n\nREGRA DE OURO - TRANSFORMACAO POETICA:\nCada dado DEVE ser transformado em metafora ou imagem poetica.\n\nESTILO: ' + estilo + ' | CLIMA: ' + clima + '\n\nFORMATO OBRIGATORIO:\n[Verse 1]\n(4 linhas)\n\n[Pre-Chorus]\n(2 linhas)\n\n[Chorus]\n(4 linhas - menciona ' + nome + ')\n\n[Verse 2]\n(4 linhas)\n\n[Chorus]\n(repete)\n\n[Bridge]\n(4 linhas)\n\n[Outro]\n(2 linhas)\n\nAPENAS a letra, zero explicacoes.';

  try {
    var resp = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    }, {
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      }
    });
    return resp.data.content[0].text;
  } catch(e) {
    console.error('Claude erro:', e.response && e.response.data || e.message);
    return '[Verse 1]\n' + nome + ', ' + relacao + ' quer te dizer\nQue voce e ' + palavras.split(',')[0] + ' de um jeito sem igual\nCada momento ao seu lado\nFez meu coracao te amar de verdade\n\n[Chorus]\n' + nome + ', essa musica e so sua\nFeita com amor que ' + relacao + ' tem\nQue fique pra sempre na memoria\nVoce e a melhor parte da minha vida';
  }
}

app.post('/api/generate', async (req, res) => {
  try {
    const formData = req.body;
    const sessionId = uuidv4();
    sessions.set(sessionId, { formData, taskIds: [], songs: [], paid: false, chosenIndex: 0 });
    const lyrics = await buildLyrics(formData);
    const styleTags = getStyleTags(formData);
    const songTitle = 'Musica para ' + (formData.nome_p || 'voce');
    const headers = { 'X-API-Key': APIFRAME_KEY, 'Content-Type': 'application/json' };
    var vocalGender = formData.clima && formData.clima.includes('Espiritual') ? 'f' : 'm';
    const body1 = { model: 'suno', prompt: lyrics, sunoParams: { custom_mode: true, model_version: 'V5_5', style: styleTags, title: songTitle, vocal_gender: vocalGender, negative_tags: 'low quality, amateur, noise, distortion' } };
    const body2 = { model: 'suno', prompt: lyrics, sunoParams: { custom_mode: true, model_version: 'V5_5', style: styleTags, title: songTitle + ' v2', vocal_gender: vocalGender, negative_tags: 'low quality, amateur, noise, distortion' } };
    const [r1, r2] = await Promise.all([
      axios.post('https://api.apiframe.ai/v2/music/generate', body1, { headers }),
      axios.post('https://api.apiframe.ai/v2/music/generate', body2, { headers })
    ]);
    const taskIds = [r1.data && r1.data.jobId, r2.data && r2.data.jobId].filter(Boolean);
    sessions.get(sessionId).taskIds = taskIds;
    res.json({ sessionId: sessionId, taskIds: taskIds });
  } catch (err) {
    console.error('Erro generate:', err.response && err.response.data || err.message);
    res.status(500).json({ error: 'Erro ao iniciar geracao.' });
  }
});

app.get('/api/status/:sessionId', async (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Sessao nao encontrada' });
  if (session.songs.length >= 1) {
    return res.json({ status: 'done', songs: session.songs.slice(0,2).map((s,i) => ({ index:i, title:s.title })) });
  }
  try {
    const headers = { 'X-API-Key': APIFRAME_KEY };
    const allSongs = [];
    for (var i = 0; i < session.taskIds.length; i++) {
      var jobId = session.taskIds[i];
      var r = await axios.get('https://api.apiframe.ai/v2/jobs/' + jobId, { headers });
      if (r.data && r.data.status === 'COMPLETED' && r.data.result && r.data.result.tracks) {
        r.data.result.tracks.forEach(track => { if (track.audioUrl) allSongs.push({ title: track.title || 'Versao', url: track.audioUrl }); });
      }
    }
    if (allSongs.length >= 1) {
      session.songs = allSongs.slice(0,2);
      return res.json({ status: 'done', songs: session.songs.map((s,i) => ({ index:i, title:s.title })) });
    }
    res.json({ status: 'processing' });
  } catch (err) {
    res.json({ status: 'processing' });
  }
});

app.post('/api/payment', async (req, res) => {
  const sessionId = req.body.sessionId;
  const chosenIndex = req.body.chosenIndex;
  const session = sessions.get(sessionId);
  if (!session) return res.status(404).json({ error: 'Sessao nao encontrada' });
  session.chosenIndex = chosenIndex;
  try {
    const preference = new Preference(mpClient);
    const result = await preference.create({
      body: {
        items: [{ id: sessionId, title: 'Musica Personalizada', quantity: 1, unit_price: PRECO, currency_id: 'BRL' }],
        back_urls: {
          success: BASE_URL + '/sucesso?session=' + sessionId,
          failure: BASE_URL + '/?erro=1',
          pending: BASE_URL + '/sucesso?session=' + sessionId
        },
        auto_approve: true,
        payment_methods: { excluded_payment_types: [{id:'ticket'},{id:'atm'}], installments: 1 },
        notification_url: BASE_URL + '/api/webhook',
        external_reference: sessionId + ':' + chosenIndex
      }
    });
    res.json({ checkoutUrl: result.init_point });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar pagamento.' });
  }
});

app.post('/api/webhook', async (req, res) => {
  res.sendStatus(200);
  var type = req.body.type;
  var data = req.body.data;
  if (type !== 'payment' || !data || !data.id) return;
  try {
    const payment = new Payment(mpClient);
    const paymentData = await payment.get({ id: data.id });
    if (paymentData.status === 'approved' && paymentData.external_reference) {
      var parts = paymentData.external_reference.split(':');
      var session = sessions.get(parts[0]);
      if (session) { session.paid = true; session.chosenIndex = parseInt(parts[1]) || 0; }
    }
  } catch(err) {}
});

app.get('/api/check/:sessionId', (req, res) => {
  var session = sessions.get(req.params.sessionId);
  res.json({ paid: session ? session.paid : false });
});

app.get('/api/stream/:sessionId/:index', async (req, res) => {
  var session = sessions.get(req.params.sessionId);
  if (!session || !session.songs.length) return res.status(404).end();
  var song = session.songs[parseInt(req.params.index) || 0];
  if (!song || !song.url) return res.status(404).end();
  try {
    var response = await axios.get(song.url, { responseType: 'stream' });
    res.setHeader('Content-Type', 'audio/mpeg');
    response.data.pipe(res);
  } catch(err) { res.status(500).end(); }
});

app.get('/api/download/:sessionId', (req, res) => {
  var session = sessions.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Nao encontrado' });
  if (!session.paid) return res.status(403).json({ error: 'Pagamento nao confirmado' });
  var song = session.songs[session.chosenIndex] || session.songs[0];
  if (!song) return res.status(404).json({ error: 'Musica nao encontrada' });
  res.json({ url: song.url, title: song.title });
});

app.get('/sucesso', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sucesso.html'));
});

var PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log('Servidor rodando na porta ' + PORT); });
