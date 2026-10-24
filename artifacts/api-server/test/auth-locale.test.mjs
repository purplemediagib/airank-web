import test from 'node:test';
import assert from 'node:assert/strict';
import {localizedReturnPath} from '../../airank/src/lib/return-path.ts';

test('selected authentication language overrides stale return locale without losing safe dashboard destination',()=>{
  assert.equal(localizedReturnPath('/fi/dashboard?project=owned','en'),'/en/dashboard?project=owned');
  assert.equal(localizedReturnPath('/en/dashboard/prompts/owned','fi'),'/fi/dashboard/prompts/owned');
  assert.equal(localizedReturnPath('/fi/settings','en'),'/en/settings');
  for(const input of ['https://evil.test','//evil.test','/fi/dashboard\\evil',null])
    assert.equal(localizedReturnPath(input,'en'),'/en/dashboard');
});
