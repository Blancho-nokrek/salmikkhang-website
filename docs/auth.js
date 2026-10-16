(() => {
  const $ = (s) => document.querySelector(s);
  const errorEl = $('#authError');
  const showError = (message) => { errorEl.classList.remove('success'); errorEl.textContent = message; errorEl.hidden = false; };
  const clearError = () => { errorEl.textContent = ''; errorEl.hidden = true; };
  async function request(url, options = {}) {
    const response = await fetch(url, { credentials: 'same-origin', ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
    let data = {}; try { data = await response.json(); } catch {}
    if (!response.ok) throw new Error(data.error || 'Request failed. Please try again.');
    return data;
  }
  async function initLogin() {
    const status = await request('/api/setup-status');
    if (status.setupRequired) { location.replace('/setup.html'); return; }
    const { roles } = await request('/api/roles');
    const select = $('#roleSelect');
    select.replaceChildren(...roles.map(role => { const option = document.createElement('option'); option.value = role; option.textContent = role; return option; }));
    const query = new URLSearchParams(location.search);
    const requestedRole = query.get('role') || (query.get('next') && query.get('next').startsWith('/admin') ? 'Admin' : 'Member');
    if (roles.includes(requestedRole)) select.value = requestedRole;
    else if (roles.find(role => role !== 'Admin')) select.value = roles.find(role => role !== 'Admin');
    const updateFields = () => {
      const isAdmin = select.value.toLowerCase() === 'admin';
      $('#adminFields').hidden = !isAdmin; $('#memberFields').hidden = isAdmin;
      $('#adminName').required = isAdmin; $('#adminPasscode').required = isAdmin;
      $('#memberId').required = !isAdmin; $('#memberPassword').required = !isAdmin;
      $('#loginSubmit').innerHTML = isAdmin ? 'Admin sign in <span>→</span>' : 'Enter community <span>→</span>';
      clearError();
    };
    select.addEventListener('change', updateFields); updateFields();
    const form = $('#loginForm');
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); clearError();
      const isAdmin = select.value.toLowerCase() === 'admin';
      const button = $('#loginSubmit'); button.disabled = true; button.textContent = 'Signing in…';
      try {
        if (isAdmin) await request('/api/login/admin', { method: 'POST', body: JSON.stringify({ name: $('#adminName').value.trim(), role: select.value, passcode: $('#adminPasscode').value }) });
        else await request('/api/login/member', { method: 'POST', body: JSON.stringify({ memberId: $('#memberId').value.trim(), role: select.value, password: $('#memberPassword').value }) });
        const next = new URLSearchParams(location.search).get('next');
        const allowed = next && next.startsWith('/') && !next.startsWith('//') && !next.includes('\\') ? next : (isAdmin ? '/admin/index.html' : '/community.html');
        location.replace(allowed);
      } catch (error) { button.disabled = false; updateFields(); showError(error.message); }
    });
  }
  async function initSetup() {
    const status = await request('/api/setup-status');
    if (!status.setupRequired) { location.replace('/login.html'); return; }
    $('#setupForm').addEventListener('submit', async (event) => {
      event.preventDefault(); clearError();
      const name = $('#setupName').value.trim(), passcode = $('#setupPasscode').value, confirm = $('#setupConfirm').value;
      if (passcode.length < 10) { showError('Use at least 10 characters for the admin passcode.'); return; }
      if (passcode !== confirm) { showError('The two passcodes do not match.'); return; }
      const button = $('#setupSubmit'); button.disabled = true; button.textContent = 'Creating admin…';
      try { await request('/api/setup-admin', { method: 'POST', body: JSON.stringify({ name, passcode }) }); location.replace('/login.html?created=1&role=Admin'); }
      catch (error) { showError(error.message); button.disabled = false; button.innerHTML = 'Create administrator <span>→</span>'; }
    });
  }
  (async () => {
    try { if ($('#loginForm')) await initLogin(); else if ($('#setupForm')) await initSetup(); }
    catch (error) { showError(`Could not connect to the website server. Start it with python3 server.py, then reload this page. Details: ${error.message}`); }
    if (new URLSearchParams(location.search).get('created') === '1') { showError('Admin created successfully. Sign in with the name and passcode you just set up.'); errorEl.classList.add('success'); }
  })();
})();
