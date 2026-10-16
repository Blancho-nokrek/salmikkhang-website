/* Public client configuration only. Never put a Supabase service-role key here. */
(function () {
  const SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
  const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
  const configured = !SUPABASE_URL.includes('YOUR_PROJECT_REF') &&
    !SUPABASE_ANON_KEY.includes('YOUR_SUPABASE_ANON_KEY') &&
    !!window.supabase?.createClient;
  const normalizeMemberId = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  const memberEmail = (id) => `${normalizeMemberId(id)}@accounts.salmikkhang.local`;
  window.Salmikkhang = {
    configured,
    client: configured ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null,
    normalizeMemberId,
    memberEmail,
    esc: (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])),
    async accountForUser(userId) {
      if (!this.client || !userId) return null;
      const { data, error } = await this.client.from('community_accounts')
        .select('user_id,member_id,full_name,role_id,role_name,account_type,photo_url,status,must_change_password,created_at')
        .eq('user_id', userId).maybeSingle();
      if (error) throw error;
      return data;
    },
    async loadRoles(includeInactive=false) {
      if (!this.client) return [];
      const { data, error } = await this.client.rpc('get_public_roles');
      if (error) throw error;
      return (data || []).filter(role => includeInactive || role.is_active !== false);
    },
    errorMessage(error) {
      const text = error?.message || error?.details || 'অনুরোধটি সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।';
      return text.replace(/^FunctionsHttpError: /, '').slice(0, 400);
    }
  };
})();
