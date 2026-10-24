import type {QueryClient,QueryKey} from '@tanstack/react-query';
import type {AppSession} from '@workspace/api-client-react';

/** Keep the observed session query alive: clearing it can leave mounted observers on stale identity. */
export function markSignedOut(client:QueryClient,key:QueryKey) {
  // Do not let an in-flight session read restore the identity after a protected
  // endpoint rejected it. A new sign-in explicitly refreshes the session.
  void client.cancelQueries({ queryKey: key });
  client.setQueryData<AppSession>(key,old=>({
    authenticated:false,user:null,csrfToken:null,
    loginAvailable:old?.loginAvailable??false,emailLoginAvailable:old?.emailLoginAvailable??false,
  }));
  client.removeQueries({predicate:q=>q.queryKey[0]!==key[0]});
}
