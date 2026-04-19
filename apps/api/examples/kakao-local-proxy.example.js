/**
 * Kakao Local REST Proxy example (Node.js + Express)
 * Client -> Proxy -> Kakao Local REST API
 */

const express = require('express');

const app = express();
const PORT = process.env.PORT || 3001;
const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;

if (!KAKAO_REST_API_KEY) {
  throw new Error('KAKAO_REST_API_KEY is required');
}

function withKakaoAuth() {
  return {
    Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
  };
}

app.get('/kakao-local/search/keyword', async (req, res) => {
  const query = String(req.query.query || '').trim();
  const size = Math.max(1, Math.min(15, Number(req.query.size || 8)));

  if (!query) {
    res.status(400).json({ success: false, message: 'query is required' });
    return;
  }

  const params = new URLSearchParams({ query, size: String(size) });

  try {
    const response = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?${params.toString()}`, {
      headers: withKakaoAuth(),
    });

    if (!response.ok) {
      res.status(response.status).json({ success: false, message: 'kakao keyword request failed' });
      return;
    }

    const payload = await response.json();
    res.json({ success: true, data: { documents: payload.documents || [] } });
  } catch (error) {
    res.status(502).json({
      success: false,
      message: 'proxy failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get('/kakao-local/geo/coord2address', async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({ success: false, message: 'lat/lng must be numbers' });
    return;
  }

  const params = new URLSearchParams({ x: String(lng), y: String(lat) });

  try {
    const response = await fetch(`https://dapi.kakao.com/v2/local/geo/coord2address.json?${params.toString()}`, {
      headers: withKakaoAuth(),
    });

    if (!response.ok) {
      res.status(response.status).json({ success: false, message: 'kakao coord2address request failed' });
      return;
    }

    const payload = await response.json();
    res.json({ success: true, data: { document: payload.documents?.[0] || null } });
  } catch (error) {
    res.status(502).json({
      success: false,
      message: 'proxy failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.listen(PORT, () => {
  console.log(`Kakao proxy listening on http://localhost:${PORT}`);
});
