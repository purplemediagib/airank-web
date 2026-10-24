import test from 'node:test';
import assert from 'node:assert/strict';
import {QueryClient,QueryObserver} from '@tanstack/react-query';
import {markSignedOut} from '../src/lib/session-state.ts';

test('logout updates the live session observer and removes protected data without clearing login capabilities',()=>{
  const client=new QueryClient(),key=['session-fixture'];
  client.setQueryData(key,{authenticated:true,user:{id:'fixture',name:'Fixture',email:'fixture@example.test'},csrfToken:'fixture',loginAvailable:true,emailLoginAvailable:true});
  client.setQueryData(['private-project','fixture'],{brandName:'Private'});
  const observer=new QueryObserver(client,{queryKey:key,enabled:false});
  const observed=[];const unsubscribe=observer.subscribe(result=>observed.push(result.data));
  markSignedOut(client,key);
  assert.equal(observer.getCurrentResult().data.authenticated,false);
  assert.equal(observer.getCurrentResult().data.user,null);
  assert.equal(observer.getCurrentResult().data.emailLoginAvailable,true);
  assert.equal(client.getQueryData(['private-project','fixture']),undefined);
  assert.ok(observed.some(s=>s?.authenticated===false));
  unsubscribe();client.clear();
});

test('a late session response cannot restore the rejected identity',async()=>{
  const client=new QueryClient(),key=['session-race'];
  client.setQueryData(key,{authenticated:true,user:{id:'fixture'},csrfToken:'fixture',loginAvailable:true});
  let finish;
  const request=client.fetchQuery({queryKey:key,queryFn:()=>new Promise(resolve=>{finish=resolve;})}).catch(()=>undefined);
  markSignedOut(client,key);
  finish({authenticated:true,user:{id:'fixture'},csrfToken:'fixture'});
  await request;
  assert.equal(client.getQueryData(key).authenticated,false);
  assert.equal(client.getQueryData(key).user,null);
  client.clear();
});
