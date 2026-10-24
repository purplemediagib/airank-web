import {workerConfiguration} from '../src/worker/config-check.mjs';
try{
 const config=workerConfiguration();
 console.log(JSON.stringify(config,null,2));
 if(!config.database_configured||!config.monitoring_enabled||config.providers.some(p=>!p.credential_present))process.exitCode=1;
}catch{console.error('Invalid worker routing configuration. Check ENABLED_PROVIDERS and OPENROUTER_MODELS_JSON.');process.exitCode=1;}
