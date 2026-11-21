import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
import threading
import unittest
from jsonschema.exceptions import SchemaError

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from mcp_smoke import VERSION, local_exchange, probe


def reply(message):
    method=message['method']
    if method=='notifications/initialized': return None
    if method=='initialize': result={'protocolVersion':VERSION,'serverInfo':{'name':'synthetic','version':'1'},'capabilities':{'tools':{}}}
    elif method=='tools/list':
        later=bool(message['params'].get('cursor'))
        result={'tools':[{'name':'second' if later else 'first','inputSchema':{'type':'object'}}]}
        if not later: result['nextCursor']='page2'
    else: raise AssertionError('unexpected RPC method')
    return {'jsonrpc':'2.0','id':message['id'],'result':result}

class Smoke(unittest.TestCase):
    def test_only_local_fixture_can_be_contacted(self):
        for url in ['https://example.invalid','http://example.invalid','http://192.0.2.1','http://user@127.0.0.1:8000','http://127.0.0.1/?token=x']:
            with self.subTest(url=url), self.assertRaises(ValueError): local_exchange(url,VERSION)

    def test_json_transport_handshake_and_pagination(self):
        seen=[]; headers=[]
        class Handler(BaseHTTPRequestHandler):
            def log_message(self,*args): pass
            def do_POST(self):
                request=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
                seen.append(request['method']); headers.append((self.headers.get('Mcp-Session-Id'),self.headers.get('MCP-Protocol-Version')))
                data=reply(request); self.send_response(202 if data is None else 200)
                self.send_header('Content-Type','application/json')
                if request['method']=='initialize': self.send_header('Mcp-Session-Id','fixture')
                self.end_headers()
                if data is not None: self.wfile.write(json.dumps(data).encode())
        with ThreadingHTTPServer(('127.0.0.1',0),Handler) as server:
            thread=threading.Thread(target=server.serve_forever,daemon=True); thread.start()
            try: self.assertEqual(probe(local_exchange(f'http://127.0.0.1:{server.server_port}/mcp',VERSION)),2)
            finally: server.shutdown(); thread.join()
        self.assertEqual(seen,['initialize','notifications/initialized','tools/list','tools/list'])
        self.assertEqual(headers,[(None,None)]+[('fixture',VERSION)]*3)

    def test_malformed_tool_schema_fails(self):
        def exchange(message):
            data=reply(message)
            if message['method']=='tools/list': data['result']['tools'][0]['inputSchema']['properties']=42
            return data
        with self.assertRaises(SchemaError): probe(exchange)

    def test_duplicate_tools_fail(self):
        def exchange(message):
            data=reply(message)
            if message['method']=='tools/list': data['result']['tools'][0]['name']='repeated'
            return data
        with self.assertRaises(ValueError): probe(exchange)

if __name__=='__main__': unittest.main()
