require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const APIFRAME_KEY = process.env.APIFRAME_KEY;
const MP_TOKEN = process.env.MP_ACCESS_TOKEN;
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const PRECO = 27;

if (!APIFRAME_KEY) console.warn('⚠️ APIFRAME_KEY não configurada.');
if (!MP_TOKEN) console.warn('⚠️ MP_ACCESS_TOKEN não configurado.');

const mpClient = new MercadoPagoConfig({ accessToken: MP_TOKEN });

const sessions = new Map();

function buildLyrics(d) {
  const sentir = Array.isArray(d.sentir) ? d.sentir.join(', ') : (d.sentir || '');

  return `[Verso 1]
${d.nome_p || 'Meu amor'}, você é ${d.palavras || 'especial'}
${d.frase ? d.frase + '\n' : ''}${d.memoria ? d.memoria.substring(0, 300) : ''}

[Refrão]
Esta música é pra você, ${d.nome_p || 'meu amor'}
Feita com carinho e emoção
${d.ocasiao || 'Esse momento'} vai ficar
Guardado dentro do coração

[Verso 2]
${d.especial || 'Cada detalhe que vivemos juntos'}
Faz parte dessa história especial
${sentir ? 'Que você possa sentir ' + sentir.split(',')[0].toLowerCase() : 'Com amor, de coração'}
Esse presente não tem igual

[Refrão]
Esta música é pra você, ${d.nome_p || 'meu amor'}
Feita com carinho e emoção
${d.ocasiao || 'Esse momento'} vai ficar
Guardado dentro do coração

[Outro]
${d.nome_p || 'Meu amor'}, essa canção é só sua
Criada com amor, do fundo do coração`;
}

function buildSunoPayload({ lyrics, title, styleText }) {
  return {
    model: 'suno',
    prompt: lyrics,
    sunoParams: {
      custom_mode: true,
      title,
      style: styleText,
      model_version: 'V4_5PLUS'
    }
  };
}

app.post('/api/generate', async (req, res) => {
  try {
    if (!APIFRAME_KEY) {
      return res.status(500).json({ error: 'APIFRAME_KEY não configurada no Railway.' });
    }

    const formData = req.body;
    const sessionId = uuidv4();

    sessions.set(sessionId, {
      formData,
      taskIds: [],
      songs: [],
      paid: false,
      chosenIndex: 0
    });

    const lyrics = buildLyrics(formData);
    const style = (formData.estilo || 'pop').split(' ')[0].toLowerCase();
    const mood = (formData.clima || 'emotional').split(' ')[0].toLowerCase();
    const title = `Música para ${formData.nome_p || 'Você'}`;

    const headers = {
      'X-API-Key': APIFRAME_KEY,
      'Content-Type': 'application/json'
    };

    const payload1 = buildSunoPayload({
      lyrics,
      title,
      styleText: `${style}, ${mood}, portuguese, brazil, personalized song`
    });

    const payload2 = buildSunoPayload({
      lyrics,
      title: `${title} alternativa`,
      styleText: `${style}, ${mood}, portuguese, brazil, emotional ballad, alternative`
    });

    const [r1, r2] = await Promise.all([
      axios.post('https://api.apiframe.ai/v2/music/generate', payload1, { headers }),
      axios.post('https://api.apiframe.ai/v2/music/generate', payload2, { headers })
    ]);

    console.log('APIFRAME R1:', r1.data);
    console.log('APIFRAME R2:', r2.data);

    const taskIds = [
      r1.data?.jobId || r1.data?.id || r1.data?.taskId,
      r2.data?.jobId || r2.data?.id || r2.data?.taskId
    ].filter(Boolean);

    if (!taskIds.length) {
      throw new Error('Nenhum jobId retornado pela APIFRAME');
    }

    sessions.get(sessionId).taskIds = taskIds;

    res.json({ sessionId, taskIds });
  } catch (err) {
    console.error('Erro generate:', err.response?.data || err.message);
    res.status(500).json({
      error: 'Erro ao iniciar geração. Verifique APIFRAME_KEY, créditos e formato da API.'
    });
  }
});

app.get('/api/status/:sessionId', async (req, res) => {
  const session = sessions.get(req.params.sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Sessão não encontrada' });
  }

  if (session.songs.length >= 2) {
    return res.json({
      status: 'done',
      songs: session.songs.slice(0, 3).map((s, i) => ({
        index: i,
        title: s.title
      }))
    });
  }

  try {
    const headers = {
      'X-API-Key': APIFRAME_KEY,
      'Content-Type': 'application/json'
    };

    const allSongs = [];

    for (const jobId of session.taskIds) {
      const r = await axios.get(`https://api.apiframe.ai/v2/jobs/${jobId}`, { headers });

      console.log(`STATUS JOB ${jobId}:`, r.data);

      const tracks =
        r.data?.result?.tracks ||
        r.data?.tracks ||
        r.data?.data?.tracks ||
        [];

      const status = String(r.data?.status || '').toUpperCase();

      if (status === 'COMPLETED' || status === 'DONE' || tracks.length) {
        tracks.forEach(track => {
          const audioUrl =
            track.audioUrl ||
            track.audio_url ||
            track.url ||
            track.source_audio_url;

          if (audioUrl) {
            allSongs.push({
              title: track.title || 'Versão',
              url: audioUrl
            });
          }
        });
      }
    }

    if (allSongs.length >= 2) {
      session.songs = allSongs.slice(0, 3);

      return res.json({
        status: 'done',
        songs: session.songs.map((s, i) => ({
          index: i,
          title: s.title
        }))
      });
    }

    res.json({ status: 'processing' });
  } catch (err) {
    console.error('Erro status:', err.response?.data || err.message);
    res.json({ status: 'processing' });
  }
});

app.post('/api/payment', async (req, res) => {
  const { sessionId, chosenIndex } = req.body;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Sessão não encontrada' });
  }

  session.chosenIndex = chosenIndex || 0;

  try {
    if (!MP_TOKEN) {
      return res.status(500).json({ error: 'MP_ACCESS_TOKEN não configurado.' });
    }

    const preference = new Preference(mpClient);

    const result = await preference.create({
      body: {
        items: [
          {
            id: sessionId,
            title: `Música Personalizada — ${session.formData.nome_p || 'Cliente'}`,
            quantity: 1,
            unit_price: PRECO,
            currency_id: 'BRL'
          }
        ],
        back_urls: {
          success: `${BASE_URL}/sucesso?session=${sessionId}`,
          failure: `${BASE_URL}/?erro=1`,
          pending: `${BASE_URL}/sucesso?session=${sessionId}`
        },
        notification_url: `${BASE_URL}/api/webhook`,
        external_reference: `${sessionId}:${session.chosenIndex}`
      }
    });

    res.json({ checkoutUrl: result.init_point });
  } catch (err) {
    console.error('Erro payment:', err.response?.data || err.message);
    res.status(500).json({ error: 'Erro ao criar pagamento.' });
  }
});

app.post('/api/webhook', async (req, res) => {
  res.sendStatus(200);

  const { type, data } = req.body;

  if (type !== 'payment' || !data?.id) return;

  try {
    const payment = new Payment(mpClient);
    const paymentData = await payment.get({ id: data.id });

    if (paymentData.status === 'approved' && paymentData.external_reference) {
      const [sessionId, idx] = paymentData.external_reference.split(':');
      const session = sessions.get(sessionId);

      if (session) {
        session.paid = true;
        session.chosenIndex = parseInt(idx, 10) || 0;
        console.log(`✅ Pagamento aprovado — sessão ${sessionId}`);
      }
    }
  } catch (err) {
    console.error('Erro webhook:', err.response?.data || err.message);
  }
});

app.get('/api/check/:sessionId', (req, res) => {
  const session = sessions.get(req.params.sessionId);

  if (!session) {
    return res.json({ paid: false });
  }

  res.json({ paid: session.paid });
});

app.get('/api/stream/:sessionId/:index', async (req, res) => {
  const session = sessions.get(req.params.sessionId);

  if (!session || !session.songs.length) {
    return res.status(404).end();
  }

  const idx = parseInt(req.params.index, 10) || 0;
  const song = session.songs[idx];

  if (!song?.url) {
    return res.status(404).end();
  }

  try {
    const response = await axios.get(song.url, { responseType: 'stream' });

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Accept-Ranges', 'bytes');

    response.data.pipe(res);
  } catch (err) {
    console.error('Erro stream:', err.response?.data || err.message);
    res.status(500).end();
  }
});

app.get('/api/download/:sessionId', (req, res) => {
  const session = sessions.get(req.params.sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Sessão não encontrada' });
  }

  if (!session.paid) {
    return res.status(403).json({ error: 'Pagamento não confirmado' });
  }

  const song = session.songs[session.chosenIndex] || session.songs[0];

  if (!song) {
    return res.status(404).json({ error: 'Música não encontrada' });
  }

  res.json({
    url: song.url,
    title: song.title
  });
});

app.get('/sucesso', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sucesso.html'));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🎵 Servidor rodando na porta ${PORT}`);
});
