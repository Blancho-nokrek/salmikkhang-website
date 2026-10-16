(() => {
  const $ = (selector) => document.querySelector(selector);
  const list = $('#messages'), input = $('#messageInput'), sendButton = $('#sendButton');
  let me = null, lastId = 0, polling = null, loading = false;
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function api(url, options = {}) {
    const response = await fetch(url, { credentials: 'same-origin', ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
    let data = {}; try { data = await response.json(); } catch {}
    if (response.status === 401) { location.replace('/login.html?next=%2Fcommunity.html'); throw new Error('Please sign in again.'); }
    if (!response.ok) throw new Error(data.error || 'Request failed.');
    return data;
  }
  function toast(message) { const el = $('#chatToast'); el.textContent = message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 2900); }
  function setStatus(message = '') { $('#chatStatus').textContent = message; }
  function timeLabel(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }
  function dateLabel(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString([], {month:'short',day:'numeric'}); }
  function createMessage(message) {
    const row = document.createElement('article'); row.className = 'message' + (me && message.userId === me.id ? ' own' : ''); row.dataset.messageId = message.id;
    const meta = document.createElement('div'); meta.className = 'message-meta';
    const sender = document.createElement('strong'); sender.textContent = message.senderName; meta.append(sender);
    const role = document.createElement('span'); role.className = 'role-pill'; role.textContent = message.senderRole; meta.append(role);
    const time = document.createElement('time'); time.dateTime = message.createdAt; time.textContent = timeLabel(message.createdAt); meta.append(time);
    const content = document.createElement('div'); content.className = 'message-content'; content.textContent = message.content;
    row.append(meta, content);
    if (me && me.isAdmin) { const actions = document.createElement('div'); actions.className = 'message-actions'; const del = document.createElement('button'); del.className = 'delete-message'; del.type = 'button'; del.textContent = 'Delete message'; del.addEventListener('click', () => deleteMessage(message.id)); actions.append(del); row.append(actions); }
    return row;
  }
  function appendMessage(message) {
    if (document.querySelector(`[data-message-id="${Number(message.id)}"]`)) return;
    $('#chatEmpty').hidden = true;
    list.append(createMessage(message));
    lastId = Math.max(lastId, Number(message.id));
    $('#roomPreview').textContent = `${message.senderName}: ${message.content.replace(/\s+/g, ' ').slice(0, 62)}`;
    $('#roomTime').textContent = timeLabel(message.createdAt) || 'Now';
    $('#chatSearch').dispatchEvent(new Event('input'));
    $('#chatWall').scrollTop = $('#chatWall').scrollHeight;
  }
  async function loadMessages(initial = false) {
    if (loading) return; loading = true;
    try {
      // Refresh the latest window each time so admin deletions also disappear for everyone.
      const data = await api('/api/community/messages?after=0');
      if (!initial) {
        const visibleIds = new Set(data.messages.map(message => String(message.id)));
        list.querySelectorAll('[data-message-id]').forEach(node => { if (!visibleIds.has(node.dataset.messageId)) node.remove(); });
      }
      data.messages.forEach(appendMessage);
      $('#chatEmpty').hidden = list.children.length > 0;
    } catch (error) { if (error.message !== 'Please sign in again.') setStatus(error.message); }
    finally { loading = false; }
  }
  async function deleteMessage(id) {
    if (!confirm('Delete this message for everyone?')) return;
    try { await api(`/api/community/messages/${id}`, {method:'DELETE'}); document.querySelector(`[data-message-id="${Number(id)}"]`)?.remove(); toast('Message deleted.'); $('#chatEmpty').hidden = list.children.length > 0; }
    catch (error) { toast(error.message); }
  }
  function openPassword() { $('#passwordModal').hidden = false; $('#currentPassword').focus(); $('#passwordError').hidden = true; }
  function closePassword() { $('#passwordModal').hidden = true; $('#passwordForm').reset(); $('#passwordError').hidden = true; }
  async function boot() {
    const { user } = await api('/api/me'); me = user;
    $('#profileName').textContent = me.name; $('#profileRole').textContent = me.isAdmin ? 'Administrator' : me.role;
    $('#profileAvatar').textContent = (me.name || 'S').trim().charAt(0).toUpperCase();
    $('#memberStatus').textContent = `${me.isAdmin ? 'Administrator' : me.role} · members only`;
    document.title = `Community Chat | ${me.name} · Salmikkhang`;
    await loadMessages(true);
    polling = setInterval(() => loadMessages(false), 2700);
  }
  $('#messageForm').addEventListener('submit', async (event) => {
    event.preventDefault(); const content = input.value.trim(); if (!content) return;
    sendButton.disabled = true; setStatus('Sending message…');
    try { const data = await api('/api/community/messages', {method:'POST', body:JSON.stringify({content})}); appendMessage(data.message); input.value = ''; input.style.height = 'auto'; $('#charCount').textContent = '0/2000'; setStatus(''); }
    catch (error) { setStatus(error.message); }
    finally { sendButton.disabled = false; input.focus(); }
  });
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight,130)}px`; $('#charCount').textContent = `${input.value.length}/2000`; });
  input.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); $('#messageForm').requestSubmit(); } });
  $('#emojiBtn').addEventListener('click', () => { const start = input.selectionStart, end = input.selectionEnd; input.setRangeText('🙂', start, end, 'end'); input.dispatchEvent(new Event('input')); input.focus(); });
  $('#chatSearch').addEventListener('input', () => { const query = $('#chatSearch').value.trim().toLocaleLowerCase(); document.querySelectorAll('.message').forEach(el => el.hidden = !!query && !el.innerText.toLocaleLowerCase().includes(query)); });
  $('#passwordBtn').addEventListener('click', openPassword); $('#headerPasswordBtn').addEventListener('click', openPassword);
  $('#passwordClose').addEventListener('click', closePassword); $('#passwordCancel').addEventListener('click', closePassword);
  $('#passwordModal').addEventListener('click', (event) => { if (event.target === $('#passwordModal')) closePassword(); });
  $('#passwordForm').addEventListener('submit', async (event) => {
    event.preventDefault(); const currentPassword = $('#currentPassword').value, newPassword = $('#newPassword').value;
    const error = $('#passwordError'); error.hidden = true;
    if (newPassword.length < 8) { error.textContent = 'Use at least 8 characters for the new password.'; error.hidden = false; return; }
    if (newPassword !== $('#confirmPassword').value) { error.textContent = 'The new passwords do not match.'; error.hidden = false; return; }
    const button = $('#passwordSave'); button.disabled = true; button.textContent = 'Saving…';
    try { await api('/api/account/password', {method:'POST', body:JSON.stringify({currentPassword,newPassword})}); closePassword(); toast('Your password was changed.'); }
    catch (err) { error.textContent = err.message; error.hidden = false; }
    finally { button.disabled = false; button.textContent = 'Save password'; }
  });
  $('#logoutBtn').addEventListener('click', async () => { try { await api('/api/logout', {method:'POST', body:'{}'}); } catch {} location.replace('/login.html'); });
  window.addEventListener('beforeunload', () => { if (polling) clearInterval(polling); });
  boot().catch(error => { if (!/sign in/i.test(error.message)) setStatus(`Could not connect: ${error.message}`); });
})();
