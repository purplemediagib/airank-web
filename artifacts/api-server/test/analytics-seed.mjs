// Isolated in-memory browser fixture only; never imported by production.
export function seedAnalytics(sqlite){
 const projectId='analytics-fixture',now=Date.now();
 const identity={brandName:'Example',aliases:['Example Oy'],ownedDomains:['example.fi'],categoryFi:'suomalaiset matkapuhelinliittymät'};
 sqlite.prepare('INSERT OR IGNORE INTO app_projects VALUES (?,?,?,?,?)').run(projectId,'alice','active',1,new Date(now).toISOString());
 sqlite.prepare('INSERT OR IGNORE INTO app_identity_versions VALUES (?,?,?,?)').run(projectId,1,JSON.stringify(identity),new Date(now).toISOString());
 sqlite.prepare('INSERT OR IGNORE INTO app_audit_events VALUES (?,?,?,?,?,?)').run('fixture-created','alice',projectId,'project.created',1,new Date(now).toISOString());
 const prompts=[{id:'prompt-fixture',version:1,text:'Mitkä liittymät sopivat pienyritykselle?',topic:'Hinta',tags:[],kind:'neutral',status:'active'}];
 sqlite.prepare('INSERT OR IGNORE INTO mon_prompts VALUES (?,?,?,?,?,?)').run(prompts[0].id,projectId,1,'active','fixture-hash',now);
 sqlite.prepare('INSERT OR IGNORE INTO mon_prompt_versions VALUES (?,?,?,?)').run(prompts[0].id,1,JSON.stringify(prompts[0]),now);
 const routes=[{provider:'openai',model:'fixture-openai',route:'direct'},{provider:'claude',model:'fixture-claude',route:'direct'}];
 for(let i=0;i<5;i++){
  const runId=`analytics-run-${i}`,stamp=now-(i<2?0:i)*86400000-i*60000;
  const snapshot={identity,identityVersion:i===4?2:1,prompts,routes,market:'FI',language:'fi',kind:i===3?'diagnostic':'neutral',methodology:'tracked-fi-evidence-v1'};
  sqlite.prepare('INSERT OR IGNORE INTO mon_runs VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(runId,projectId,'alice',runId,runId,snapshot.kind,i===2?'partial':'completed',JSON.stringify(snapshot),2,stamp,stamp+10000,null);
  for(const [k,r]of routes.entries()){
   const id=`${runId}-${k}`;
   sqlite.prepare('INSERT OR IGNORE INTO mon_tasks VALUES (?,?,?,?,?,?,?,?,?,?)').run(id,runId,prompts[0].id,1,prompts[0].text,r.provider,JSON.stringify(r),'done',null,null);
   const answer=i===1?'Muita vaihtoehtoja Suomessa.':k===0?'Suosittelen Example.':'Example on yksi vaihtoehto.';
   const e={id,runId,promptId:prompts[0].id,promptVersion:1,text:prompts[0].text,provider:r.provider,model:r.model,status:i===2&&k===1?'budget_blocked':'success',answer,citations:[{url:'https://example.fi/fixture'}],observedAt:stamp,kind:snapshot.kind,methodology:snapshot.methodology};
   sqlite.prepare('INSERT OR IGNORE INTO mon_evidence VALUES (?,?,?,?)').run(id,runId,JSON.stringify(e),stamp);
  }
 }
 return {projectId};
}
