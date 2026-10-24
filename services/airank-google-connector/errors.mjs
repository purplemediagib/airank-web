// Never persist Google's free-text message, ErrorInfo metadata or OAuth payload.
const reasons=new Set(['SERVICE_DISABLED','ACCESS_TOKEN_SCOPE_INSUFFICIENT','RATE_LIMIT_EXCEEDED','QUOTA_EXCEEDED','USER_PROJECT_DENIED']);
const statuses=new Set(['INVALID_ARGUMENT','UNAUTHENTICATED','PERMISSION_DENIED','RESOURCE_EXHAUSTED','NOT_FOUND','INTERNAL','UNAVAILABLE','DEADLINE_EXCEEDED']);
export function googleFailure(status,body){
 const error=body?.error;
 const reason=(Array.isArray(error?.details)?error.details:[]).find(d=>d?.['@type']==='type.googleapis.com/google.rpc.ErrorInfo'&&reasons.has(d.reason))?.reason??null;
 const googleStatus=statuses.has(error?.status)?error.status:null;
 const reconnect=error==='invalid_grant'||status===401;
 const category=reconnect?'GOOGLE_RECONNECT_REQUIRED':
  reason==='SERVICE_DISABLED'?'GOOGLE_API_DISABLED':
  reason==='ACCESS_TOKEN_SCOPE_INSUFFICIENT'?'GOOGLE_SCOPE_REQUIRED':
  status===429||googleStatus==='RESOURCE_EXHAUSTED'?'GOOGLE_QUOTA_LIMIT':
  status===403?'GOOGLE_ACCESS_DENIED':
  status===400?'GOOGLE_REPORT_INVALID':
  status===404?'GOOGLE_PROPERTY_NOT_FOUND':
  status>=500?'GOOGLE_TEMPORARILY_UNAVAILABLE':'GOOGLE_IMPORT_FAILED';
 return {category,httpStatus:status,googleStatus,reason,reconnect,retryable:status===429||status>=500};
}
