#!/usr/bin/env python3
"""Continuum local server (§9 + §11): serves this folder, a tiny status relay,
and a guarded page reader. Stdlib only — zero third-party deps.

GET /relay?u=<url>  (§9) fetches an ALLOWLISTED https status endpoint
server-side with a browser UA and returns the JSON with ACAO: *. Hard
allowlist, 15s timeout, no query passthrough beyond `u`. Its posture is
never loosened (§10 ruling 5) — /read below is a separate door.

GET /search?q=<query>  (§12) real web search. Provider-agnostic: bill's key
lives in search_key.json (gitignored) as {"tavily": "<key>"} or
{"brave": "<key>"} — tavily preferred (free tier: 1000 searches/month, no
card; brave now charges). Read fresh per request, so pasting the key needs
no restart. No key file → 404 and the terrarium quietly falls back to
wikipedia+hn. Query only; nothing else passes through.

GET /read?u=<url>   (§11) reads ONE public https page for the terrarium's
"read <url>" command and returns extracted text as JSON. Its own posture:
https only, port 443 only, no userinfo; every resolved address must be
public/global (loopback, private, link-local, reserved → 403) and redirects
are re-checked hop by hop; 15s timeout, 600KB read cap, text/* only;
script/style stripped, 20k chars max. Known TOCTOU: the public-host check
resolves DNS separately from urllib's connect — accepted for a personal
local tool."""
import http.server, socketserver, urllib.request, urllib.parse, urllib.error, os, sys, socket, ipaddress, json, re
from html.parser import HTMLParser

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8787
ALLOW = {'status.mistral.ai', 'status.x.ai', 'status.deepseek.com'}  # the only hosts the relay will proxy
UA = 'Mozilla/5.0 (Continuum page reader)'
READ_MAX = 600_000   # bytes read off the wire
TEXT_CAP = 20_000    # chars of extracted text returned
os.chdir(os.path.dirname(os.path.abspath(__file__)))


def host_is_public(host):
    """Every address the name resolves to must be global — one private A/AAAA record fails it."""
    if not host:
        return False
    try:
        infos = socket.getaddrinfo(host, 443, proto=socket.IPPROTO_TCP)
    except Exception:
        return False
    if not infos:
        return False
    try:
        return all(ipaddress.ip_address(i[4][0]).is_global for i in infos)
    except Exception:
        return False


class SafeRedirect(urllib.request.HTTPRedirectHandler):
    """Redirects must stay on the public https web — a hop to localhost/private space is refused."""
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        p = urllib.parse.urlparse(newurl)
        if p.scheme != 'https' or p.port not in (None, 443) or not host_is_public(p.hostname):
            raise urllib.error.HTTPError(newurl, 403, 'redirect off the public https web', headers, fp)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


class TextExtract(HTMLParser):
    """Page → plain text: scripts, styles, and markup dropped; the <title> kept."""
    SKIP = {'script', 'style', 'noscript', 'template', 'svg', 'head'}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts, self.title, self._skip, self._title = [], '', 0, False

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self._skip += 1
        if tag == 'title':
            self._title = True

    def handle_endtag(self, tag):
        if tag in self.SKIP and self._skip:
            self._skip -= 1
        if tag == 'title':
            self._title = False

    def handle_data(self, data):
        if self._title and len(self.title) < 300:
            self.title += data
        elif not self._skip:
            self.parts.append(data)


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        route = urllib.parse.urlparse(self.path).path
        if route == '/relay':
            return self.relay()
        if route == '/read':
            return self.read_page()
        if route == '/search':
            return self.search()
        return super().do_GET()

    def search(self):
        try:
            with open('search_key.json') as f:
                keys = json.load(f) or {}
        except Exception:
            keys = {}
        if not (keys.get('tavily') or keys.get('brave')):
            return self.deny(404, 'no search key configured (search_key.json)')
        params = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        q = (params.get('q') or [''])[0].strip()
        if not q or len(q) > 200:
            return self.deny(400, 'bad query')
        try:
            if keys.get('tavily'):
                req = urllib.request.Request(
                    'https://api.tavily.com/search',
                    data=json.dumps({'query': q, 'max_results': 5}).encode(),
                    headers={'Authorization': 'Bearer ' + keys['tavily'],
                             'Content-Type': 'application/json', 'User-Agent': UA})
                with urllib.request.urlopen(req, timeout=15) as resp:
                    j = json.loads(resp.read(READ_MAX))
                results = [{'title': r.get('title', ''), 'url': r.get('url', ''),
                            'desc': (r.get('content') or '')[:300]}
                           for r in (j.get('results') or [])[:5]]
            else:
                req = urllib.request.Request(
                    'https://api.search.brave.com/res/v1/web/search?count=5&q=' + urllib.parse.quote(q),
                    headers={'X-Subscription-Token': keys['brave'], 'Accept': 'application/json', 'User-Agent': UA})
                with urllib.request.urlopen(req, timeout=15) as resp:
                    j = json.loads(resp.read(READ_MAX))
                results = [{'title': r.get('title', ''), 'url': r.get('url', ''),
                            'desc': re.sub(r'<[^>]+>', '', r.get('description', ''))}
                           for r in (j.get('web', {}).get('results') or [])[:5]]
        except Exception:
            return self.deny(502, 'search upstream failed')
        payload = json.dumps({'q': q, 'results': results}).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def read_page(self):
        params = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        raw = (params.get('u') or [''])[0]
        parts = urllib.parse.urlparse(raw)
        if (parts.scheme != 'https' or '@' in (parts.netloc or '') or parts.port not in (None, 443)
                or not host_is_public(parts.hostname)):
            return self.deny(403, 'read is https-only, port 443, public hosts only')
        safe = urllib.parse.urlunparse(('https', parts.hostname, parts.path or '/', '', parts.query, ''))
        opener = urllib.request.build_opener(SafeRedirect)
        req = urllib.request.Request(safe, headers={'User-Agent': UA, 'Accept': 'text/html,text/plain;q=0.9,*/*;q=0.5'})
        try:
            with opener.open(req, timeout=15) as resp:
                ctype = resp.headers.get('Content-Type', '')
                if not re.match(r'\s*(text/|application/(xhtml\+xml|xml))', ctype):
                    return self.deny(415, 'not a text page')
                body = resp.read(READ_MAX)
                final = resp.geturl()
        except Exception:
            return self.deny(502, 'the page could not be read')
        m = re.search(r'charset=([-\w]+)', ctype)
        text = body.decode(m.group(1) if m else 'utf-8', 'replace')
        if 'html' in ctype or text.lstrip()[:1] == '<':
            p = TextExtract()
            try:
                p.feed(text)
            except Exception:
                pass
            title = ' '.join(p.title.split())
            content = ' '.join(' '.join(p.parts).split())[:TEXT_CAP]
        else:
            title, content = '', ' '.join(text.split())[:TEXT_CAP]
        payload = json.dumps({'url': raw, 'final_url': final, 'title': title, 'text': content}).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

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
