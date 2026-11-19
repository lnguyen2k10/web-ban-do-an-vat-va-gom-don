let application;

export default async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const route = url.searchParams.get('__lees_route');
  if (route) {
    url.searchParams.delete('__lees_route');
    req.url = '/api/' + route + url.search;
  }
  let handler;
  try {
    application ??= import('../server.mjs');
    handler = (await application).handleRequest;
  } catch (error) {
    console.error('Lee’s Shop API chưa sẵn sàng:', error.code || error.name);
    res.writeHead(503, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'});
    res.end(JSON.stringify({error: 'Chưa kết nối được cơ sở dữ liệu. Vui lòng thử lại sau.'}));
    return;
  }
  return handler(req, res);
}
