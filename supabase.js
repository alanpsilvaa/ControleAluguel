        function showApplication() {
            document.getElementById('supabase-auth-screen').classList.add('hidden');
            document.getElementById('signout-button').classList.toggle('hidden', !supabaseSession);
        }

        function showAuthScreen(message = '') {
            document.getElementById('supabase-auth-screen').classList.remove('hidden');
            document.getElementById('signout-button').classList.add('hidden');
            const errorMessage = document.getElementById('supabase-auth-error');
            errorMessage.textContent = message;
            errorMessage.classList.toggle('hidden', !message);
        }

        function backToSupabaseSettings() {
            document.getElementById('supabase-auth-screen').classList.add('hidden');
            switchTab('settings');
        }

        async function signInToSupabase(event) {
            event.preventDefault();
            const errorMessage = document.getElementById('supabase-auth-error');
            const submitButton = document.getElementById('auth-submit');
            errorMessage.textContent = '';
            errorMessage.classList.add('hidden');
            submitButton.disabled = true;
            submitButton.textContent = 'Entrando...';

            try {
                const { data, error } = await supabaseClient.auth.signInWithPassword({
                    email: document.getElementById('auth-email').value.trim(),
                    password: document.getElementById('auth-password').value
                });
                if (error) throw error;

                supabaseSession = data.session;
                if (!await loadFromSupabase()) {
                    await supabaseClient.auth.signOut();
                    supabaseSession = null;
                    errorMessage.textContent = 'A conta não tem permissão para acessar os dados.';
                    errorMessage.classList.remove('hidden');
                    return;
                }

                showApplication();
                renderCurrentPage();
            } catch (error) {
                errorMessage.textContent = `Não foi possível entrar: ${error.message}`;
                errorMessage.classList.remove('hidden');
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'Entrar';
            }
        }

        async function signOutFromSupabase() {
            const { error } = await supabaseClient.auth.signOut();
            if (error) {
                showToast(`Não foi possível sair: ${error.message}`, 'error');
                return;
            }

            supabaseSession = null;
            cloudReady = false;
            showAuthScreen();
        }

        // --- STORAGE & SUPABASE SYNC ---
        function saveData() {
            localStorage.setItem('rental_properties', JSON.stringify(properties));
            localStorage.setItem('rental_records', JSON.stringify(records));
            syncToSupabase();
        }

        function loadSupabaseConfigUI() {
            const url = localStorage.getItem('supabase_url') || '';
            const key = localStorage.getItem('supabase_key') || '';
            document.getElementById('supabase-url').value = url;
            document.getElementById('supabase-key').value = key;
        }

        async function saveSupabaseConfig() {
            const url = document.getElementById('supabase-url').value.trim();
            const key = document.getElementById('supabase-key').value.trim();
            localStorage.setItem('supabase_url', url);
            localStorage.setItem('supabase_key', key);
            initSupabase();
            if (supabaseClient) {
                try {
                    const { data, error } = await supabaseClient.auth.getSession();
                    if (error) throw error;
                    supabaseSession = data.session;
                    if (!supabaseSession) {
                        showAuthScreen();
                        return;
                    }
                    if (await loadFromSupabase()) {
                        showApplication();
                        renderCurrentPage();
                    }
                } catch (error) {
                    showAuthScreen(`Não foi possível verificar o login: ${error.message}`);
                }
            }
        }

        function initSupabase() {
            cloudReady = false;
            const url = localStorage.getItem('supabase_url');
            const key = localStorage.getItem('supabase_key');
            if (url && key && window.supabase) {
                try {
                    supabaseClient = window.supabase.createClient(url, key);
                } catch (e) {
                    supabaseClient = null;
                    document.getElementById('supabase-status').textContent = "Status: Erro na Conexão";
                    document.getElementById('supabase-status').className = "text-xs font-medium text-rose-600";
                    showToast(`Não foi possível configurar o Supabase: ${e.message}`, 'error');
                }
            } else {
                supabaseClient = null;
                document.getElementById('supabase-status').textContent = "Status: LocalStorage Ativo";
                document.getElementById('supabase-status').className = "text-xs font-medium text-slate-500";
            }
        }

        async function loadFromSupabase() {
            if (!supabaseSession) return false;
            const status = document.getElementById('supabase-status');
            status.textContent = "Status: Carregando dados da nuvem...";
            status.className = "text-xs font-medium text-indigo-600";

            let data;
            let error;
            try {
                ({ data, error } = await supabaseClient
                    .from('rental_data')
                    .select('properties, records')
                    .eq('id', 'default')
                    .maybeSingle());
            } catch (requestError) {
                status.textContent = "Status: Erro ao carregar da nuvem";
                status.className = "text-xs font-medium text-rose-600";
                showToast(`Erro ao carregar do Supabase: ${requestError.message}`, 'error');
                return false;
            }

            if (error) {
                status.textContent = "Status: Erro ao carregar da nuvem";
                status.className = "text-xs font-medium text-rose-600";
                showToast(`Erro ao carregar do Supabase: ${error.message}`, 'error');
                return false;
            }

            if (data) {
                properties = data.properties;
                records = data.records;
                localStorage.setItem('rental_properties', JSON.stringify(properties));
                localStorage.setItem('rental_records', JSON.stringify(records));
                cloudReady = true;
            } else {
                const synced = await syncToSupabase(true);
                cloudReady = synced;
                return synced;
            }

            status.textContent = "Status: Supabase sincronizado (Nuvem)";
            status.className = "text-xs font-medium text-emerald-600";
            return true;
        }

        async function syncToSupabase(force = false) {
            if (!supabaseClient || !supabaseSession || (!cloudReady && !force)) return false;

            const status = document.getElementById('supabase-status');
            let error;
            try {
                ({ error } = await supabaseClient
                    .from('rental_data')
                    .upsert({
                        id: 'default',
                        properties,
                        records,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'id' }));
            } catch (requestError) {
                status.textContent = "Status: Erro ao salvar na nuvem";
                status.className = "text-xs font-medium text-rose-600";
                showToast(`Erro ao salvar no Supabase: ${requestError.message}`, 'error');
                return false;
            }

            if (error) {
                status.textContent = "Status: Erro ao salvar na nuvem";
                status.className = "text-xs font-medium text-rose-600";
                showToast(`Erro ao salvar no Supabase: ${error.message}`, 'error');
                return false;
            }

            status.textContent = "Status: Supabase sincronizado (Nuvem)";
            status.className = "text-xs font-medium text-emerald-600";
            cloudReady = true;
            return true;
        }
