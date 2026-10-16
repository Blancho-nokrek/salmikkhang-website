(() => {
  const gate=document.getElementById('adminAuthGate');
  const form=document.getElementById('adminAuthForm');
  const msg=document.getElementById('adminAuthStatus');
  const roleSelect=document.getElementById('adminAuthRole');
  const $=s=>document.querySelector(s);
  const show=(text,bad=false)=>{msg.textContent=text;msg.hidden=false;msg.classList.toggle('bad',bad);};
  const normal=e=>window.Salmikkhang?.errorMessage(e)||e?.message||'Could not sign in.';
  function fillRoles(roles){roleSelect.innerHTML='<option value="">Choose role…</option>'+roles.map(r=>`<option value="${Salmikkhang.esc(r.name)}">${Salmikkhang.esc(r.name)}</option>`).join('');}
  async function checkSession(){
    if(!Salmikkhang?.configured){gate.classList.add('visible');show('Supabase setup required. Configure ../community-config.js and run supabase/community_setup.sql first.',true);form.querySelector('button[type=submit]').disabled=true;return;}
    try{
      const {data:{session}}=await Salmikkhang.client.auth.getSession();
      if(session){const a=await Salmikkhang.accountForUser(session.user.id);if(a?.status==='active'&&a.account_type==='admin'&&!a.must_change_password){window.salmikkhangAdminAccount=a;document.body.classList.remove('admin-auth-pending');gate.classList.remove('visible');return;}await Salmikkhang.client.auth.signOut();}
      gate.classList.add('visible');
      fillRoles(await Salmikkhang.loadRoles());
    }catch(e){gate.classList.add('visible');show(normal(e),true);}
  }
  form.addEventListener('submit',async e=>{e.preventDefault();msg.hidden=true;const btn=form.querySelector('button[type=submit]');btn.disabled=true;const old=btn.textContent;btn.textContent='Checking…';try{
    const name=$('#adminAuthName').value.trim(),id=$('#adminAuthId').value.trim(),password=$('#adminAuthPassword').value,role=roleSelect.value;
    if(role!=='Admin')throw new Error('Admin Panel-এ ঢুকতে Role হিসেবে Admin নির্বাচন করুন।');
    const {data,error}=await Salmikkhang.client.auth.signInWithPassword({email:Salmikkhang.memberEmail(id),password});if(error)throw error;
    const account=await Salmikkhang.accountForUser(data.user.id);
    if(!account||account.status!=='active'||account.account_type!=='admin'||account.role_name!=='Admin'||account.full_name.trim().toLowerCase()!==name.toLowerCase()){
      await Salmikkhang.client.auth.signOut();throw new Error('এই নাম ও ID-তে সক্রিয় Admin অনুমতি নেই।');
    }
    if(account.must_change_password){await Salmikkhang.client.auth.signOut();throw new Error('Admin পাসওয়ার্ড পরিবর্তন করতে হবে। Community পেজে সাইন ইন করে নতুন পাসওয়ার্ড সেট করুন।');}
    window.salmikkhangAdminAccount=account;document.body.classList.remove('admin-auth-pending');gate.classList.remove('visible');location.reload();
  }catch(err){show(normal(err),true);}finally{btn.disabled=false;btn.textContent=old;}});
  const logout=document.getElementById('adminLogout');logout?.addEventListener('click',async()=>{await Salmikkhang?.client?.auth.signOut();location.href='../community.html';});
  checkSession();
})();
