# Salmikkhang Community — সেটআপ নির্দেশিকা

এই আপডেটটি পুরোনো হোমপেজের মূল ডিজাইন ও সেকশন রেখে ডান পাশের `Join Our Community` বাটনকে `Community` করেছে। নতুন `community.html`-এ নাম/Role/Member ID/পাসওয়ার্ড দিয়ে লগইন, invitation passcode দিয়ে join request, WhatsApp-ধাঁচের group chat, এবং আলাদা `members.html` ডিরেক্টরি আছে। পুরোনো Admin Panel রাখা হয়েছে; নতুন `Community Control` অংশে role, invitation, account, join request ও chat moderation আছে।

## Live করার আগে (একবারের কাজ)

1. Supabase-এ একটি project তৈরি করো।
2. Supabase → SQL Editor-এ `supabase/community_setup.sql` পুরোটা চালাও।
3. `community-config.js`-এ `SUPABASE_URL`-এ project URL এবং `SUPABASE_ANON_KEY`-এ project-এর **public anon/publishable key** বসাও। `service_role` key কখনো এই ফাইলে বা GitHub Pages-এ বসাবে না।
4. Supabase → Authentication settings-এ email/password sign-in চালু রাখো। এই সাইটে member ID-র জন্য `memberid@accounts.salmikkhang.local` ধরনের internal auth email ব্যবহার করা হয়েছে; email confirmation-এর মাধ্যমে mail পাঠানো হয় না, Admin/Edge Function user-কে confirmed করে তৈরি করে।
5. প্রথম Admin account তৈরি করতে Supabase Dashboard → Authentication → Users → Add user ব্যবহার করো। Email হবে `admin-001@accounts.salmikkhang.local` (অথবা পছন্দের admin ID-র একই format), একটি শক্তিশালী passcode/password সেট করে email confirmed হিসেবে তৈরি করো। এরপর নিচের SQL চালিয়ে তাকে Admin profile দাও; `full_name`-এ Admin-এর আসল প্রদর্শিত নাম লিখে দাও:

```sql
insert into public.community_accounts
  (user_id, member_id, full_name, role_id, role_name, account_type, status, must_change_password)
select u.id, 'ADMIN-001', 'Community Admin', r.id, 'Admin', 'admin', 'active', false
from auth.users u
join public.community_roles r on lower(r.name)='admin'
where lower(u.email)='admin-001@accounts.salmikkhang.local'
on conflict (user_id) do update set
  member_id=excluded.member_id, full_name=excluded.full_name,
  role_id=excluded.role_id, role_name=excluded.role_name,
  account_type='admin', status='active', must_change_password=false;
```

`admin-001`/`ADMIN-001`-এর জায়গায় একই Member/Admin ID ব্যবহার করবে। Auth user-এর Email-এ ID ছোট হাতের (lowercase) হবে।

6. Supabase CLI দিয়ে account creation Edge Function deploy করো, একই প্রজেক্টে:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy admin-create-account
```

Supabase project-এর function environment-এ `SUPABASE_URL`, `SUPABASE_ANON_KEY` এবং `SUPABASE_SERVICE_ROLE_KEY` থাকতে হবে। এগুলো local CLI দিয়ে deploy করলে সাধারণত Supabase-এর managed Edge Function environment-এর URL/keys পাওয়া যায়; `SUPABASE_SERVICE_ROLE_KEY` শুধু Edge Function environment-এ থাকবে। কোনো HTML/JS ফাইলে নয়।

7. GitHub Pages-এর বর্তমান `main /docs` source-ই ব্যবহার করো। ZIP থেকে `salmikkhang-website/`-এর ভেতরের ফাইলগুলো তোমার repository-তে আপলোড/commit করো; `.git` ফোল্ডার ZIP-এ নেই।

## কীভাবে ব্যবহার করবে

- Admin প্রথমে `/community.html`-এ নিজের নাম, Role `Admin`, `ADMIN-001` ID ও পাসওয়ার্ড দিয়ে লগইন করবে। সফল হলে Admin Panel-এ যাবে। `/admin/index.html` সরাসরি খুললেও একই admin অনুমতি পরীক্ষা হবে।
- Admin Panel → Community Control → Invitation passcodes থেকে সীমিত ব্যবহার ও মেয়াদসহ code তৈরি করবে. তৈরি হওয়া code ওই মুহূর্তে একবার দেখানো হয়; কপি করে ব্যক্তিকে দেবে।
- Community → Request to join-এ ব্যক্তি নাম, Admin-তৈরি Role ও passcode দিয়ে আবেদন করবে। Admin panel থেকে approve/reject করবে। Approved হলে Admin একই Community Control অংশের Create member login থেকে Member ID ও temporary password তৈরি করবে। এগুলো ব্যক্তিকে ব্যক্তিগতভাবে দেবে।
- সদস্য Member ID ও temporary password দিয়ে লগইন করে প্রথমবার নিজস্ব password সেট করবে। তারপর group chat ব্যবহার করতে পারবে। Member chat দেখতে/বার্তা পাঠাতে পারবে; Admin যেকোনো বার্তা মুছতে, role বদলাতে, code/account পরিচালনা করতে পারবে। Disabled account লগইন/চ্যাট করতে পারবে না।
- Public `members.html` পেজে শুধু full name, role ও HTTPS photo URL দেখানো হয়; Member ID/পাসওয়ার্ড দেখানো হয় না।

## গুরুত্বপূর্ণ সীমা

- Backend credentials না দিয়ে এই ZIP থেকে live chat/login বাস্তবে চালু করা সম্ভব নয়. ZIP-এ client-side UI, SQL schema/policies/RPCs এবং Edge Function source உள்ளது; Supabase configuration/deploy না হওয়া পর্যন্ত Community-তে setup warning দেখাবে।
- বিদ্যমান Admin Panel-এর পুরোনো website content editor (news/events/projects/gallery) আগের মতোই browser-local demo mode-এ আছে; সেটিকে shared database-এ রূপান্তর করা হয়নি যাতে তোমার পুরোনো ফিচার ও আচরণ বদলে না যায়। নতুন Community Control, member authentication and chat Supabase-backend ব্যবহার করে।
- Admin passcode বা member password কখনো source code, role dropdown বা invitation code-এ রাখা হয়নি। Role label নির্বাচন access privilege দেয় না; server-side account `account_type`-ই নির্ধারণ করে।
