const MAX_BODY = 1500000;
async function readBytes(response, maxBytes = MAX_BODY) {
  if (response.headers?.get && Number(response.headers.get('content-length')) > maxBytes) throw new Error('response too large');
  if (response.body?.getReader) {
    const reader = response.body.getReader(), chunks=[]; let size=0;
    try { while (true) { const {done,value}=await reader.read(); if(done) break; size+=value.byteLength; if(size>maxBytes) throw new Error('response too large'); chunks.push(Buffer.from(value)); } }
    finally { await reader.cancel().catch(()=>{}); }
    return Buffer.concat(chunks);
  }
  const b=Buffer.from(await response.arrayBuffer()); if(b.length>maxBytes) throw new Error('response too large'); return b;
}
async function readText(response,maxBytes=MAX_BODY) {
  if(response.body?.getReader || response.arrayBuffer) return (await readBytes(response,maxBytes)).toString('utf8');
  const text=await response.text(); if(Buffer.byteLength(text)>maxBytes) throw new Error('response too large'); return text;
}
module.exports={readBytes,readText};
