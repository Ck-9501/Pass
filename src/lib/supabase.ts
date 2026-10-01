import {createClient} from '@supabase/supabase-js';
export const supabase=createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY);
export type Status='valid'|'checked_in'|'revoked';
export interface EventRow{id:string;name:string;date:string|null;time:string|null;venue:string|null;organizer:string|null}
export interface Guest{id:string;event_id:string;name:string;phone:string|null;pass_type:string;pass_id:string;qr_token:string;status:Status;notes:string|null;created_at:string;checked_in_at:string|null}
