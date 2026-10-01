import {useState} from 'react';
import toast from 'react-hot-toast';
import {supabase} from '../lib/supabase';
import Icon from '../components/Icon';

export default function Login(){
 const [email,setE]=useState('');const [pw,setP]=useState('');const [busy,setB]=useState(false);
 async function go(e:React.FormEvent){e.preventDefault();setB(true);const {error}=await supabase.auth.signInWithPassword({email,password:pw});setB(false);if(error)toast.error('Incorrect email or password.');}
 return <div className="min-h-screen grid place-items-center p-5 md:p-8">
   <div className="w-full max-w-md">
    <div className="mb-7 flex justify-center"><img src="/vyra-logo.jpg" alt="VYRA Entertainment" className="w-56 mix-blend-screen opacity-95"/></div>
    <form onSubmit={go} className="glass page-in rounded-[28px] p-7 md:p-9">
      <div className="mb-7 flex items-start justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[.34em] text-amber-200/65">Private access</p><h1 className="font-display mt-2 text-4xl md:text-5xl">PartyPass</h1><p className="mt-2 text-sm text-zinc-400">Event management for VYRA Entertainment.</p></div><div className="rounded-2xl border border-amber-300/15 bg-amber-300/[.04] p-3 text-amber-200"><Icon name="spark" size={22}/></div></div>
      <div className="space-y-4">
       <div><label className="mb-2 block text-[11px] uppercase tracking-[.2em] text-zinc-400">Email</label><input required type="email" placeholder="admin@vyra.com" value={email} onChange={e=>setE(e.target.value)} className="w-full rounded-2xl px-4 py-3.5"/></div>
       <div><label className="mb-2 block text-[11px] uppercase tracking-[.2em] text-zinc-400">Password</label><input required type="password" placeholder="••••••••" value={pw} onChange={e=>setP(e.target.value)} className="w-full rounded-2xl px-4 py-3.5"/></div>
       <button disabled={busy} className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-300 px-4 py-3.5 font-semibold text-black shadow-[0_10px_30px_rgba(222,171,86,.16)] transition hover:brightness-105 disabled:opacity-50">{busy?'SIGNING IN…':'SIGN IN'}<Icon name="chevron" size={18}/></button>
      </div>
      <div className="mt-6 flex items-center gap-3 text-[10px] uppercase tracking-[.24em] text-zinc-500"><span className="h-px flex-1 bg-white/[.08]"/><span>Beyond the ordinary</span><span className="h-px flex-1 bg-white/[.08]"/></div>
    </form>
   </div>
 </div>;
}
