require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

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
    'Funk': {
      'Romantico':   'Brazilian melodic funk, emotional synths, modern electronic beat, romantic atmosphere, catchy vocal melody, commercial production, emotional chorus',
      'Alegre':      'Brazilian funk melody, energetic beat, modern synths, danceable groove, positive atmosphere, catchy hooks, radio-ready production',
      'Emocionante': 'Melodic emotional funk, atmospheric synths, deep bass, emotional vocal, touching lyrics, modern Brazilian production, heartfelt chorus',
      'Espiritual':  'Melodic emotional funk, atmospheric synths, deep bass, emotional vocal, touching lyrics, modern Brazilian production, heartfelt chorus'
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

  var prompt = 'Voce e um dos melhores compositores de ' + estilo + ' do Brasil, com decadas de experiencia criando hits. Sua missao e criar uma letra PROFISSIONAL de ' + estilo + ' que soe ' + clima + ', usando as informacoes abaixo APENAS COMO INSPIRACAO — nunca copie os dados literalmente na letra.\n\nINFORMACOES DE INSPIRACAO (use criativamente, nao literalmente):\n- Destinatario: ' + nome + ' (' + relacao + ')\n- Personalidade dela: ' + palavras + '\n- Historia: ' + memoria + '\n- Algo especial entre eles: ' + (frase || especial || 'momentos inesqueciveis') + '\n- Ocasiao: ' + (ocasiao || 'presente especial') + '\n\nCOMO USAR ESSES DADOS:\n- Transforme a personalidade em metaforas poeticas (ex: "teimosa" vira "tem um fogo que nao apaga")\n- Transforme a historia em imagens cinematograficas (ex: "se conheceram num app" vira "foi o destino que digitou nosso encontro")\n- Use o nome ' + nome + ' com carinho no refrao\n- NUNCA escreva frases como "voce e teimosa" ou "nos conhecemos num aplicativo" — poetize!\n\nESTILO MUSICAL: ' + estilo + ' (' + clima + ')\n- Se sertanejo: rimas AABB ou ABAB, linguagem do interior, metaforas do campo/amor\n- Se pop: linguagem moderna, refrão grudan, versos fluidos\n- Se gospel: espiritualidade, fe, bencao divina\n- Se pagode: gingado, saudade, malandragem romantica\n\nFORMATO OBRIGATORIO:\n[Verse 1] - 4 linhas que contam o inicio da historia\n[Pre-Chorus] - 2 linhas de transicao emocional\n[Chorus] - 4 linhas MEMORAVEIS com o nome ' + nome + ', o refrao que gruda\n[Verse 2] - 4 linhas que aprofundam a historia\n[Chorus] - repete\n[Bridge] - 4 linhas de clímax emocional\n[Outro] - 2 linhas de fechamento poetico\n\nQUALIDADE EXIGIDA: Nivel de Henrique & Juliano, Jorge & Mateus, Marilia Mendonca. Rimas ricas, imagens poeticas, emocao genuina. APENAS a letra, sem titulos, sem explicacoes, sem comentarios.';

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
    // Fallback basico
    return '[Verse 1]\n' + nome + ', ' + relacao + ' quer te dizer\nQue voce e ' + palavras.split(',')[0] + ' de um jeito sem igual\n' + (memoria ? memoria.substring(0,80) : 'Cada momento ao seu lado') + '\nFez meu coracao te amar de verdade\n\n[Chorus]\n' + nome + ', essa musica e so sua\nFeita com amor que ' + relacao + ' tem\nQue fique pra sempre na memoria\nVoce e a melhor parte da minha vida';
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
    return res.json({
      status: 'done',
      songs: session.songs.slice(0, 2).map(function(s, i) { return { index: i, title: s.title }; })
    });
  }

  try {
    const headers = { 'X-API-Key': APIFRAME_KEY };
    const allSongs = [];

    for (var i = 0; i < session.taskIds.length; i++) {
      var jobId = session.taskIds[i];
      var r = await axios.get('https://api.apiframe.ai/v2/jobs/' + jobId, { headers: headers });
      if (r.data && r.data.status === 'COMPLETED' && r.data.result && r.data.result.tracks) {
        r.data.result.tracks.forEach(function(track) {
          if (track.audioUrl) allSongs.push({ title: track.title || 'Versao', url: track.audioUrl });
        });
      }
    }

    if (allSongs.length >= 1) {
      session.songs = allSongs.slice(0, 2);
      return res.json({
        status: 'done',
        songs: session.songs.map(function(s, i) { return { index: i, title: s.title }; })
      });
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
      var sid = parts[0];
      var idx = parts[1];
      var session = sessions.get(sid);
      if (session) { session.paid = true; session.chosenIndex = parseInt(idx) || 0; }
    }
  } catch (err) {}
});

app.get('/api/check/:sessionId', function(req, res) {
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

app.get('/api/download/:sessionId', function(req, res) {
  var session = sessions.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Nao encontrado' });
  if (!session.paid) return res.status(403).json({ error: 'Pagamento nao confirmado' });
  var song = session.songs[session.chosenIndex] || session.songs[0];
  if (!song) return res.status(404).json({ error: 'Musica nao encontrada' });
  res.json({ url: song.url, title: song.title });
});

app.get('/sucesso', function(req, res) {
  res.sendFile(path.join(__dirname, 'public', 'sucesso.html'));
});

var PORT = process.env.PORT || 3000;
app.listen(PORT, function() { console.log('Servidor rodando na porta ' + PORT); });
