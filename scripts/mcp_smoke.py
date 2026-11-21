#!/usr/bin/env python3
"""Opt-in JSON-response Streamable HTTP smoke check, for an already-running local test server only."""
import argparse
import http.client
import ipaddress
import json
from urllib.parse import urlsplit
from jsonschema.validators import validator_for

VERSION = '2025-03-26'
LIMIT = 1024 * 1024


def probe(exchange, version=VERSION):
    def request(num, method, params):
        data = exchange({'jsonrpc':'2.0','id':num,'method':method,'params':params})
        if not isinstance(data, dict) or data.get('jsonrpc') != '2.0' or type(data.get('id')) is not int or data['id'] != num or 'error' in data or not isinstance(data.get('result'),dict):
            raise ValueError('invalid RPC response')
        return data['result']
    info=request(1,'initialize',{'protocolVersion':version,'capabilities':{},'clientInfo':{'name':'orplex-catalog-smoke','version':'1.0'}})
    if info.get('protocolVersion')!=version or not isinstance(info.get('serverInfo'),dict) or not all(isinstance(info['serverInfo'].get(k),str) and info['serverInfo'][k] for k in ('name','version')) or not isinstance(info.get('capabilities',{}).get('tools'),dict):
        raise ValueError('incompatible handshake or missing tools capability')
    exchange({'jsonrpc':'2.0','method':'notifications/initialized'})
    names=set(); cursor=None; cursors=set()
    for page in range(10):
        result=request(2+page,'tools/list',{'cursor':cursor} if cursor else {})
        if not isinstance(result.get('tools'),list): raise ValueError('invalid tool list')
        for tool in result['tools']:
            name=tool.get('name'); schema=tool.get('inputSchema')
            if not isinstance(name,str) or not name.strip() or name in names or not isinstance(schema,dict) or schema.get('type')!='object': raise ValueError('invalid or duplicate tool')
            # Schema checking only; never resolve instance-data refs or execute the tool.
            validator_for(schema).check_schema(schema); names.add(name)
        cursor=result.get('nextCursor')
        if cursor is None:
            if not names: raise ValueError('no tools advertised')
            return len(names)
        if not isinstance(cursor,str) or not cursor or cursor in cursors: raise ValueError('invalid cursor')
        cursors.add(cursor)
    raise ValueError('page limit exceeded')


def local_exchange(endpoint,version):
    u=urlsplit(endpoint)
    if u.scheme!='http' or not u.hostname or not ipaddress.ip_address(u.hostname).is_loopback or u.username is not None or u.password is not None or u.query or u.fragment: raise ValueError('expected literal loopback HTTP address without credentials or query')
    session=None
    def exchange(message):
        nonlocal session
        conn=http.client.HTTPConnection(u.hostname,u.port or 80,timeout=4)
        headers={'Content-Type':'application/json','Accept':'application/json, text/event-stream'}
        if message['method']!='initialize': headers['MCP-Protocol-Version']=version
        if session: headers['Mcp-Session-Id']=session
        try:
            conn.request('POST',u.path or '/',body=json.dumps(message),headers=headers)
            res=conn.getresponse()
            if 'id' not in message:
                if res.status!=202: raise ValueError('notification not accepted')
                return None
            if res.status!=200 or res.getheader('Content-Type','').split(';')[0].strip().lower()!='application/json': raise ValueError('expected a JSON response; SSE-only responses not supported by this check')
            if message['method']=='initialize': session=res.getheader('Mcp-Session-Id')
            buf=res.read(LIMIT+1)
            if len(buf)>LIMIT: raise ValueError('response too large')
            return json.loads(buf)
        finally:
            conn.close()
    return exchange

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__); parser.add_argument('endpoint'); parser.add_argument('--protocol-version',default=VERSION)
    args=parser.parse_args()
    try:
        count=probe(local_exchange(args.endpoint,args.protocol_version),args.protocol_version)
    except Exception as exc:
        raise SystemExit('Smoke check not verified ('+type(exc).__name__+'). Check local setup, protocol version and JSON response support; no payload logged.') from None
    print(f'Handshake and schema listing passed for {count} tools. No tool called; operation permissions and behavior remain unverified.')
