// Deploy as: supabase functions deploy admin-create-account
// Required secret stays in Supabase Edge Functions, never in browser JavaScript.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const reply = (status:number, body:Record<string,unknown>) => new Response(JSON.stringify(body), {status,headers:cors});
Deno.serve(async (req) => {
  if(req.method === "OPTIONS") return new Response("ok",{headers:cors});
  if(req.method !== "POST") return reply(405,{error:"POST required"});
  const url=Deno.env.get("SUPABASE_URL")!, anon=Deno.env.get("SUPABASE_ANON_KEY")!, service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authorization=req.headers.get("Authorization"); if(!authorization) return reply(401,{error:"Sign in as an admin first."});
  const caller=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:userError}=await caller.auth.getUser();
  if(userError || !user) return reply(401,{error:"Your session is invalid. Sign in again."});
  const {data:isAdmin,error:permissionError}=await caller.rpc("is_community_admin");
  if(permissionError || isAdmin!==true) return reply(403,{error:"Admin permission required."});
  let body:Record<string,unknown>;
  try { body=await req.json(); } catch { return reply(400,{error:"Invalid JSON body."}); }
  const fullName=String(body.full_name||"").trim();
  const memberId=String(body.member_id||"").trim().toUpperCase();
  const normalized=memberId.toLowerCase().replace(/[^a-z0-9-]/g,"");
  const roleName=String(body.role_name||"").trim();
  const accountType=body.account_type === "admin" ? "admin" : "member";
  const password=String(body.temporary_password||"");
  const photo=String(body.photo_url||"").trim();
  if(fullName.length<2 || fullName.length>100) return reply(400,{error:"Name must be 2–100 characters."});
  if(!/^[a-z0-9][a-z0-9-]{2,39}$/.test(normalized)) return reply(400,{error:"Member ID must be 3–40 letters, numbers or hyphens."});
  if(password.length<8 || password.length>72) return reply(400,{error:"Temporary password must be 8–72 characters."});
  if(photo && !/^https:\/\//i.test(photo)) return reply(400,{error:"Photo URL must start with https://"});
  if(accountType==="admin" && roleName.toLowerCase()!=="admin") return reply(400,{error:"Admin accounts must use the Admin role."});
  if(accountType==="member" && roleName.toLowerCase()==="admin") return reply(400,{error:"Admin role can only be assigned to an admin account."});
  const serviceClient=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:role,error:roleError}=await serviceClient.from("community_roles").select("id,name,is_active").ilike("name",roleName).maybeSingle();
  if(roleError || !role || !role.is_active) return reply(400,{error:"Choose an active role from the role list."});
  const email=`${normalized}@accounts.salmikkhang.local`;
  const {data:created,error:createError}=await serviceClient.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{member_id:memberId,full_name:fullName}});
  if(createError || !created.user) return reply(400,{error:createError?.message||"Could not create the login account."});
  const {error:insertError}=await serviceClient.from("community_accounts").insert({user_id:created.user.id,member_id:memberId,full_name:fullName,role_id:role.id,role_name:role.name,account_type:accountType,photo_url:photo||null,status:"active",must_change_password:true});
  if(insertError) { await serviceClient.auth.admin.deleteUser(created.user.id); return reply(400,{error:insertError.message||"Could not save the member profile."}); }
  return reply(200,{ok:true,member_id:memberId,full_name:fullName,role_name:role.name,account_type:accountType,must_change_password:true});
});
