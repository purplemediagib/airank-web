import {isIP} from 'node:net';
/** Server-side request-boundary function. Destination is always the configured Bunny API, never this URL. */
export function normalizeWebsiteAtEdge(raw:unknown):string{
 if(typeof raw!=='string'||raw.length>2048||!raw.trim()||/[\u0000-\u0020\u007f\\]/.test(raw.trim()))throw Error('INVALID_WEBSITE');
 let value=raw.trim();if(value.startsWith('//'))value='https:'+value;
 if(/^[a-z][a-z0-9+.-]*:/i.test(value)&&!/^https?:\/\//i.test(value))throw Error('INVALID_WEBSITE');
 const u=new URL(/^https?:\/\//i.test(value)?value:'https://'+value),host=u.hostname.toLowerCase().replace(/\.$/,'');
 if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.port||isIP(host)||host.length>253||!host.includes('.')||/\.(local|localhost|internal|test|invalid|example|onion)$/.test(host)||host.split('.').some(s=>!s||s.length>63||!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(s)))throw Error('INVALID_WEBSITE');
 return `${u.protocol}//${host}/`;
}
