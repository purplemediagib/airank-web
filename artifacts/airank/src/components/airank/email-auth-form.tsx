import { track } from '@/lib/analytics';
import {useRef,useState,type FormEvent} from 'react';
import {useLocation} from 'wouter';
import {useQueryClient} from '@tanstack/react-query';
import {useI18n} from '@/i18n';
import {useAccount,SESSION_KEY} from '@/lib/account';
import {appBase} from '@/lib/return-path';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';

type Mode = 'sign-in' | 'sign-up' | 'verify' | 'reset-request' | 'reset';
const copy = {
  en:{signIn:'Sign in with email',signUp:'Create an account',name:'Full name',email:'Email',password:'Password',newPassword:'New password',hint:'12–128 characters. Use a unique password.',forgot:'Forgot password?',reset:'Reset password',send:'Send reset code',code:'Verification code',verify:'Verify email and continue',sent:'Check your email for a 6-digit code. It expires in 15 minutes.',resetSent:'If this email has a password account, we sent a reset code. Google accounts should use Continue with Google.',back:'Back to sign in',wait:'Please wait…',show:'Show password',hide:'Hide password',unavailable:'Email sign-in needs the new API release, email sender and account migration to be enabled. Google sign-in remains available.',success:'Password updated. Sign in with your new password.',or:'Or continue with Google',invalid:'The email or password is incorrect.',validation:'Check your email, name and password. Passwords must be 12–128 characters.',exists:'This email already has an account. Use its original sign-in method, or reset the password for an email account.',expired:'This code is incorrect or expired. Request a new one.',limited:'Too many attempts. Please wait before trying again.',mail:'We could not send the email. Please try again later.',busy:'The sign-in service is busy. Please try again shortly.',failed:'The request failed. Please try again. It was not retried automatically.'},
  fi:{signIn:'Kirjaudu sähköpostilla',signUp:'Luo tili',name:'Koko nimi',email:'Sähköposti',password:'Salasana',newPassword:'Uusi salasana',hint:'12–128 merkkiä. Käytä yksilöllistä salasanaa.',forgot:'Unohditko salasanasi?',reset:'Palauta salasana',send:'Lähetä palautuskoodi',code:'Vahvistuskoodi',verify:'Vahvista sähköposti ja jatka',sent:'Tarkista sähköpostisi: lähetimme kuusinumeroisen koodin. Se on voimassa 15 minuuttia.',resetSent:'Jos sähköpostilla on salasanatili, lähetimme palautuskoodin. Google-tilillä kirjaudu Google-painikkeesta.',back:'Takaisin kirjautumiseen',wait:'Odota hetki…',show:'Näytä salasana',hide:'Piilota salasana',unavailable:'Sähköpostikirjautuminen edellyttää uutta API-versiota, sähköpostilähettäjää ja tilimigraatiota. Google-kirjautuminen on käytettävissä.',success:'Salasana päivitetty. Kirjaudu uudella salasanallasi.',or:'Tai jatka Google-tilillä',invalid:'Sähköposti tai salasana on virheellinen.',validation:'Tarkista sähköposti, nimi ja salasana. Salasanan on oltava 12–128 merkkiä.',exists:'Sähköpostilla on jo tili. Käytä alkuperäistä kirjautumistapaa tai palauta sähköpostitilin salasana.',expired:'Koodi on virheellinen tai vanhentunut. Pyydä uusi koodi.',limited:'Liian monta yritystä. Odota ennen uutta yritystä.',mail:'Sähköpostin lähetys epäonnistui. Yritä myöhemmin uudelleen.',busy:'Kirjautumispalvelu on varattu. Yritä pian uudelleen.',failed:'Pyyntö epäonnistui. Yritä uudelleen. Pyyntöä ei toistettu automaattisesti.'},
};
export function EmailAuthForm({available,returnTo}:{available:boolean;returnTo:string}) {
  const {locale}=useI18n(),c={...copy[locale],unavailable:locale==='fi'
    ?'Sähköpostikirjautuminen ei ole vielä käytössä palvelimella. Google-kirjautuminen on edelleen käytettävissä.'
    :'Email sign-in is not enabled on the server yet. Google sign-in remains available.'};
  const [location,navigate]=useLocation();
  const [mode,setMode]=useState<Mode>(location.endsWith('/sign-up')?'sign-up':'sign-in');
  const [email,setEmail]=useState(''),[name,setName]=useState(''),[password,setPassword]=useState('');
  const [code,setCode]=useState(''),[challengeId,setChallengeId]=useState('');
  const [busy,setBusy]=useState(false),[show,setShow]=useState(false),[error,setError]=useState<string|null>(null),[success,setSuccess]=useState(false);
  const busyRef=useRef(false),target=useRef(returnTo); target.current=returnTo;
  const qc=useQueryClient(),{resetAccountCache}=useAccount();
  const change=(next:Mode)=>{if(busyRef.current)return;setMode(next);setError(null);setPassword('');setCode('');setShow(false);setSuccess(false);};
  const errorText = error==='INVALID_CREDENTIALS'?c.invalid:error==='AUTH_VALIDATION_FAILED'?c.validation:error==='EMAIL_IN_USE'?c.exists:error==='INVALID_OR_EXPIRED_CODE'?c.expired:error==='AUTH_RATE_LIMITED'?c.limited:error==='AUTH_MAIL_UNAVAILABLE'?c.mail:error==='AUTH_BUSY'?c.busy:error==='EMAIL_AUTH_NOT_CONFIGURED'?c.unavailable:c.failed;
  async function submit(e:FormEvent) {
    e.preventDefault();
    if(busyRef.current||!available)return;
    busyRef.current=true;setBusy(true);setError(null);setSuccess(false);
    const payload=mode==='sign-up'?{email,name,password,locale}:mode==='sign-in'?{email,password,locale}:mode==='verify'?{challengeId,code,locale}:mode==='reset-request'?{email,locale}:{challengeId,code,password};
    try {
      const response=await fetch(`${appBase()}/api/airank/v1/app/email/${mode}`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});
      const data=await response.json();
      if(!response.ok)throw new Error(data?.error?.code||'FAILED');
      setPassword('');
      if(mode==='sign-up'||mode==='reset-request'){setChallengeId(data.challengeId);setMode(mode==='sign-up'?'verify':'reset');setCode('');}
      else if(mode==='reset'){setMode('sign-in');setSuccess(true);setCode('');}
      else {
        if(mode==='verify')track('account_signup',locale as 'fi'|'en');
        resetAccountCache();
        qc.setQueryData(SESSION_KEY,data);
        navigate(target.current,{replace:true});
      }
    } catch (err) {setError(err instanceof Error?err.message:'FAILED');}
    finally {busyRef.current=false;setBusy(false);}
  }
  const codeMode=mode==='verify'||mode==='reset',passwordMode=mode==='sign-in'||mode==='sign-up'||mode==='reset';
  return <div className="space-y-4">
    <div className="flex gap-2" role="group" aria-label={locale==='fi'?'Kirjautuminen tai rekisteröityminen':'Sign in or sign up'}>
      <Button type="button" variant={mode==='sign-in'?'default':'secondary'} disabled={busy} onClick={()=>change('sign-in')} data-testid="tab-email-sign-in">{c.signIn}</Button>
      <Button type="button" variant={mode==='sign-up'?'default':'secondary'} disabled={busy} onClick={()=>change('sign-up')} data-testid="tab-email-sign-up">{c.signUp}</Button>
    </div>
    {!available&&<p role="status" className="text-sm text-muted-ink">{c.unavailable}</p>}
    <form onSubmit={submit} className="space-y-4" aria-busy={busy}>
      <fieldset disabled={busy||!available} className="space-y-4">
        {mode==='sign-up'&&<label className="block space-y-1 text-sm" htmlFor="auth-name"><span>{c.name}</span><Input id="auth-name" name="name" value={name} onChange={e=>setName(e.target.value)} required minLength={2} maxLength={100} autoComplete="name" /></label>}
        {!codeMode&&<label className="block space-y-1 text-sm" htmlFor="auth-email"><span>{c.email}</span><Input id="auth-email" name="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} required maxLength={254} autoComplete="email" /></label>}
        {codeMode&&<><p role="status" className="text-sm text-muted-ink">{mode==='reset'?c.resetSent:c.sent}</p><label className="block space-y-1 text-sm" htmlFor="auth-code"><span>{c.code}</span><Input id="auth-code" name="code" value={code} onChange={e=>setCode(e.target.value)} required pattern="[0-9]{6}" maxLength={6} inputMode="numeric" autoComplete="one-time-code" /></label></>}
        {passwordMode&&<label className="block space-y-1 text-sm" htmlFor="auth-password"><span>{mode==='reset'?c.newPassword:c.password}</span><div className="flex gap-2"><Input id="auth-password" name="password" type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} required minLength={mode==='sign-in'?1:12} maxLength={128} autoComplete={mode==='sign-in'?'current-password':'new-password'} aria-describedby={mode!=='sign-in'?'auth-password-hint':undefined} /><Button type="button" variant="secondary" onClick={()=>setShow(!show)} aria-pressed={show}>{show?c.hide:c.show}</Button></div>{mode!=='sign-in'&&<span id="auth-password-hint" className="text-xs text-muted-ink">{c.hint}</span>}</label>}
        {error&&<p role="alert" className="rounded-lg bg-danger-bg p-3 text-sm text-danger">{errorText}</p>}
        {success&&<p role="status" className="text-sm text-success">{c.success}</p>}
        <Button type="submit" className="w-full" data-testid="button-email-auth">{busy?c.wait:mode==='sign-up'?c.signUp:mode==='verify'?c.verify:mode==='reset-request'?c.send:mode==='reset'?c.reset:c.signIn}</Button>
      </fieldset>
    </form>
    {mode==='sign-in'?<Button type="button" variant="link" disabled={busy||!available} onClick={()=>change('reset-request')}>{c.forgot}</Button>:<Button type="button" variant="link" disabled={busy} onClick={()=>change('sign-in')}>{c.back}</Button>}
    <div className="border-t border-line pt-4 text-center text-xs text-muted-ink">{c.or}</div>
  </div>;
}
