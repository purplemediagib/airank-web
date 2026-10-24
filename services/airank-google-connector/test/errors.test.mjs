import test from 'node:test';
import assert from 'node:assert/strict';
import {googleFailure} from '../errors.mjs';
test('structured Google errors retain only allowlisted diagnostic fields',()=>{
 const result=googleFailure(403,{error:{status:'PERMISSION_DENIED',message:'secret',details:[{'@type':'type.googleapis.com/google.rpc.ErrorInfo',reason:'SERVICE_DISABLED',metadata:{token:'secret'}}]}});
 assert.equal(result.category,'GOOGLE_API_DISABLED');
 assert.equal(result.reason,'SERVICE_DISABLED');
 assert.ok(!JSON.stringify(result).includes('secret'));
 assert.equal(result.retryable,false);
});
test('HTTP status does not invent an API-disabled or scope diagnosis',()=>{
 assert.equal(googleFailure(403,{}).category,'GOOGLE_ACCESS_DENIED');
 assert.equal(googleFailure(400,{}).category,'GOOGLE_REPORT_INVALID');
 assert.equal(googleFailure(400,{error:'invalid_grant'}).reconnect,true);
 assert.equal(googleFailure(429,{}).retryable,true);
 assert.equal(googleFailure(503,{}).category,'GOOGLE_TEMPORARILY_UNAVAILABLE');
});
