#!/usr/bin/env python3
"""Continuum local server (§9): serves this folder AND a tiny status relay for
the few status pages a browser can't read directly (mistral sends no CORS,
x.ai is bot-walled). Stdlib only — zero third-party deps.

GET /relay?u=<url>  fetches an ALLOWLISTED https status endpoint server-side
with a browser UA and returns the JSON with Access-Control-Allow-Origin: *.
Hard allowlist, 15s timeout, no query passthrough beyond `u`."""
import http.server, socketserver, urllib.request, urllib.parse, os, sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8787
ALLOW = {'status.mistral.ai', 'status.x.ai', 'status.deepseek.com'}  # the only hosts the relay will proxy
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if urllib.parse.urlparse(self.path).path == '/relay':
            return self.relay()
        return super().do_GET()

    def relay(self):
        params = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        parts = urllib.parse.urlparse((params.get('u') or [''])[0])
        if parts.scheme != 'https' or parts.hostname not in ALLOW:
            return self.deny(403, 'host not on the relay allowlist')
        # rebuild from allowlisted scheme+host+path only — nothing passed through beyond `u`
        safe = urllib.parse.urlunparse(('https', parts.hostname, parts.path, '', '', ''))
        try:
            req = urllib.request.Request(safe, headers={'User-Agent': 'Mozilla/5.0 (Continuum wire relay)'})
            with urllib.request.urlopen(req, timeout=15) as resp:
                body = resp.read()
        except Exception:
            return self.deny(502, 'relay upstream failed')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def deny(self, code, msg):
        self.send_response(code)
        self.send_header('Content-Type', 'text/plain')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(msg.encode())


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True  # so a restart doesn't hit "address already in use"


if __name__ == '__main__':
    with Server(('', PORT), Handler) as httpd:
        print('Continuum on http://localhost:%d   relay allowlist: %s' % (PORT, ', '.join(sorted(ALLOW))))
        httpd.serve_forever()
