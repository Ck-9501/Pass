import QRCode from 'qrcode';import {jsPDF} from 'jspdf';import type {EventRow,Guest} from './supabase';
const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const rnd=(n:number)=>Array.from(crypto.getRandomValues(new Uint8Array(n)),b=>A[b%A.length]).join('');
export const newPassId=()=>`PP-${rnd(4)}-${rnd(4)}`;
export const newToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,'0')).join('');
export const verifyUrl=(t:string)=>`${import.meta.env.VITE_PUBLIC_URL||location.origin}/verify/${t}`;
export const qrDataUrl=(t:string)=>QRCode.toDataURL(verifyUrl(t),{width:600,margin:1});
export async function downloadPdf(g:Guest,ev:EventRow){
 const d=new jsPDF({unit:'mm',format:[100,160]});d.setFillColor(15,15,25);d.rect(0,0,100,160,'F');d.setTextColor(255);d.setFontSize(16);
 d.text(ev.name,50,18,{align:'center'});d.setFontSize(24);d.text(g.name.toUpperCase(),50,38,{align:'center'});d.setFontSize(12);d.setTextColor(200,170,255);d.text(`${g.pass_type.toUpperCase()} PASS`,50,47,{align:'center'});
 d.setTextColor(180);d.setFontSize(9);d.text('PASS ID',50,57,{align:'center'});d.setTextColor(255);d.setFontSize(14);d.text(g.pass_id,50,63,{align:'center'});
 d.setFillColor(255,255,255);d.roundedRect(20,69,60,60,3,3,'F');d.addImage(await qrDataUrl(g.qr_token),'PNG',23,72,54,54);
 d.setTextColor(200);d.setFontSize(9);d.text(`${ev.date??''}  ${ev.time??''}`,50,138,{align:'center'});d.text(ev.venue??'',50,144,{align:'center'});
 d.save(`${g.name.replace(/\s+/g,'_')}_PartyPass_${g.pass_id}.pdf`);
}
export const waLink=(g:Guest,ev:EventRow)=>`https://wa.me/${(g.phone||'').replace(/\D/g,'')}?text=${encodeURIComponent(`Hey ${g.name}! 🎉\nHere's your pass for ${ev.name}.\nPlease keep this QR pass ready at the entrance.`)}`;
