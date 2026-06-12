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

const mpClient = new MercadoPagoConfig({ accessToken: MP_TOKEN });
const sessions = new Map();

function buildLyrics(d) {
  const sentir = Array.isArray(d.sentir) ? d.sentir.join(', ') : (d.sentir || '');
  const estilo = (d.estilo || 'Pop').split(' ')[0];
  const clima = (d.clima || 'Romantico').split(' ')[0];
  return '[Estilo: ' + estilo + ', ' + clima + ']\n\n[Verso 1]\n' +
    d.nome_p + ', voce e ' + (d.palavras || 'especial') + '\n' +
    (d.frase ? '"' + d.frase + '"\n' : '') +
    (d.memoria ? d.memoria.substring(0, 80) : 'Cada momento ao seu lado') + '\n\n' +
    '[Pre-refrao]\n' +
    (d.especial ? d.especial.substring(0, 60) : 'Essa historia que construimos') + '\n' +
    'E o que me faz ter certeza\n\n' +
    '[Refrao]\n' +
    d.nome_p + ', essa musica e pra voce\n' +
    'Feita com amor de ' + (d.relacao || 'alguem especial') + '\n' +
    (d.ocasiao ? d.ocasiao.split(' ')[0] + ' -- ' : '') + 'Que fique pra sempre\n' +
    'No coracao, na memoria\n\n' +
    '[Verso 2]\n' +
    (sentir ? 'Quero que voce possa ' + sentir.split(',')[0].toLowerCase() : 'Cada nota guarda um pedaco nosso') + '\n' +
    'Essa cancao nasceu do fundo da alma\n' +
    'Um presente que nao tem igual\n\n' +
    '[Refrao]\n' +
    d.nome_p + ', essa musica e pra voce\n' +
    'Feita com amor de ' + (d.relacao || 'alguem especial') + '\n' +
    'Que fique pra sempre no coracao\n\n' +
    '[Outro]\n' +
    d.nome_p + '... essa cancao e so sua';
}

app.post('/api/generate', async (req, res) => {
  try {
    const formData = req.body;
    const sessionId = uuidv4();
    sessions.set(sessionId, { formData, taskIds: [], songs: [], paid: false, chosenIndex: 0 });

    const lyrics = buildLyrics(formData);
    const headers = { 'X-API-Key': APIFRAME_KEY, 'Content-Type': 'application/json' };

    const body1 = { model: 'suno', prompt: lyrics, sunoParams: { custom_mode: true } };
    const body2 = { model: 'suno', prompt: lyrics, sunoParams: { custom_mode: true } };

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
