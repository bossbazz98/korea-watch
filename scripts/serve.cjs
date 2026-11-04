// Static development server: no production writes or dependencies.
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../public');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png'};
const server=http.createServer((q,s)=>{
  let file;
  try { const pathname=decodeURIComponent(new URL(q.url,'http://localhost').pathname);file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep)) throw Error(); }
  catch {s.writeHead(400);s.end();return;}
  fs.readFile(file,(e,b)=>{if(e){s.writeHead(404);s.end();return;}s.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream','cache-control':'no-cache'});s.end(b);});
});
server.listen(Number(process.env.PORT||8080),'127.0.0.1',()=>console.log('Static development server started on port '+(process.env.PORT||8080)));
