import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeWebsiteAtEdge} from '../src/routes/website-edge.ts';
import {normalizeWebsite} from '../../../services/bunny-api/src/common/website-url.mjs';
test('edge and worker agree on accepted normalized URLs and reject unsafe inputs',()=>{
 for(const url of ['website.fi','www.website.fi','HTTPS://WWW.WEBSITE.FI/path?q=x','//ääkköset.fi',' http://website.fi:80/ ','https://website.fi./']){
  assert.equal(normalizeWebsiteAtEdge(url),normalizeWebsite(url).website);
 }
 for(const url of ['http://127.0.0.1','https://[::1]/','https://a.internal','file://site.fi','https://site.fi:8080','https://user:secret@site.fi','https://site.fi\\@evil.fi']){
  assert.throws(()=>normalizeWebsiteAtEdge(url));assert.throws(()=>normalizeWebsite(url));
 }
});
