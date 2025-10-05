export const config = {
  runtime: 'edge',
};

function required(name, val) {
  if (!val) throw new Error(`Missing ${name}. Set it in Vercel Project → Environment Variables.`);
  return val;
}

// Azure OCR (Read) v3.2 endpoint example: https://<resource>.cognitiveservices.azure.com/vision/v3.2/read/analyze
export default async function handler(req) {
  try {
    const endpoint = required('AZURE_VISION_ENDPOINT', process.env.AZURE_VISION_ENDPOINT);
    const key = required('AZURE_VISION_KEY', process.env.AZURE_VISION_KEY);

    const image = await req.arrayBuffer();

    // Start analyze
    const analyzeRes = await fetch(`${endpoint}/vision/v3.2/read/analyze`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/octet-stream',
      },
      body: image,
    });

    if (!analyzeRes.ok) {
      const t = await analyzeRes.text();
      return new Response(JSON.stringify({ error: `Analyze failed: ${analyzeRes.status} ${t}` }), { status: 500 });
    }

    const opLoc = analyzeRes.headers.get('operation-location');
    if (!opLoc) return new Response(JSON.stringify({ error: 'Missing operation-location' }), { status: 500 });

    // Poll result
    let tries = 0, text = '';
    while (tries < 12) {
      await new Promise(r => setTimeout(r, 600));
      const r = await fetch(opLoc, {
        headers: { 'Ocp-Apim-Subscription-Key': key }
      });
      const data = await r.json();
      const status = data.status || data.analyzeResult?.readResults ? 'succeeded' : data.status;
      if (status === 'succeeded') {
        const lines = [];
        const results = data.analyzeResult?.readResults || data.analyzeResult?.pages || [];
        for (const page of results) {
          const lns = page.lines || page.words || [];
          for (const ln of (page.lines || [])) lines.push(ln.text);
        }
        text = lines.join(' ').trim();
        break;
      } else if (status === 'failed') {
        return new Response(JSON.stringify({ error: 'OCR failed' }), { status: 500 });
      }
      tries++;
    }

    return new Response(JSON.stringify({ text }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || String(e) }), { status: 500 });
  }
}