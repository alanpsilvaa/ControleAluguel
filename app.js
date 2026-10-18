// Default initial 8 properties if empty
        const defaultProperties = [
            { id: 1, name: "Casa 01", address: "Rua Principal, 100", defaultRent: 800 },
            { id: 2, name: "Casa 02", address: "Rua Principal, 102", defaultRent: 850 },
            { id: 3, name: "Casa 03", address: "Rua das Flores, 45", defaultRent: 900 },
            { id: 4, name: "Casa 04", address: "Rua das Flores, 47", defaultRent: 750 },
            { id: 5, name: "Casa 05", address: "Av. Central, 500", defaultRent: 1000 },
            { id: 6, name: "Casa 06", address: "Av. Central, 502", defaultRent: 950 },
            { id: 7, name: "Casa 07", address: "Travessa do Sol, 12", defaultRent: 700 },
            { id: 8, name: "Casa 08", address: "Travessa do Sol, 15", defaultRent: 820 }
        ];

        let properties = JSON.parse(localStorage.getItem('rental_properties')) || defaultProperties;
        let records = JSON.parse(localStorage.getItem('rental_records')) || {}; 

        // Current selected month in YYYY-MM
        let currentMonth = new Date().toISOString().slice(0, 7);

        // Supabase client instance (if configured)
        let supabaseClient = null;
        let cloudReady = false;
        let supabaseSession = null;

        window.onload = async function() {
            document.getElementById('select-month').value = currentMonth;
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
                    if (!await loadFromSupabase()) {
                        showAuthScreen('Não foi possível carregar os dados privados. Verifique o acesso da conta.');
                        return;
                    }
                } catch (error) {
                    showAuthScreen(`Não foi possível verificar o login: ${error.message}`);
                    return;
                }
            }
            showApplication();
            renderProperties();
            renderStatement();
        };

        // Tab Switching
        function switchTab(tabName) {
            document.getElementById('tab-properties').classList.add('hidden');
            document.getElementById('tab-statement').classList.add('hidden');
            document.getElementById('tab-settings').classList.add('hidden');

            document.getElementById('btn-tab-properties').className = "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center space-x-2 text-indigo-100 hover:text-white";
            document.getElementById('btn-tab-statement').className = "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center space-x-2 text-indigo-100 hover:text-white";
            document.getElementById('btn-tab-settings').className = "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center space-x-2 text-indigo-100 hover:text-white";

            if (tabName === 'properties') {
                document.getElementById('tab-properties').classList.remove('hidden');
                document.getElementById('btn-tab-properties').className = "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center space-x-2 bg-white text-indigo-700 shadow-sm";
                renderProperties();
            } else if (tabName === 'statement') {
                document.getElementById('tab-statement').classList.remove('hidden');
                document.getElementById('btn-tab-statement').className = "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center space-x-2 bg-white text-indigo-700 shadow-sm";
                renderStatement();
            } else if (tabName === 'settings') {
                document.getElementById('tab-settings').classList.remove('hidden');
                document.getElementById('btn-tab-settings').className = "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center space-x-2 bg-white text-indigo-700 shadow-sm";
                loadSupabaseConfigUI();
            }
        }

        // Toast Notification Helper
        function showToast(message, type = 'success') {
            const toast = document.getElementById('toast');
            const msg = document.getElementById('toast-message');
            const icon = document.getElementById('toast-icon');

            msg.textContent = message;
            if (type === 'success') {
                icon.className = "fa-solid fa-circle-check text-emerald-400 text-lg";
            } else {
                icon.className = "fa-solid fa-triangle-exclamation text-amber-400 text-lg";
            }

            toast.classList.remove('translate-y-20', 'opacity-0');
            setTimeout(() => {
                toast.classList.add('translate-y-20', 'opacity-0');
            }, 3500);
        }

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
                renderProperties();
                renderStatement();
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

        // --- PROPERTIES MANAGEMENT ---
        function renderProperties() {
            const grid = document.getElementById('properties-grid');
            grid.innerHTML = '';

            properties.forEach(prop => {
                const card = document.createElement('div');
                const rent = Number(prop.defaultRent) || 0;
                const water = Number(prop.defaultWater) || 0;
                const electricity = Number(prop.defaultElectricity) || 0;
                const total = rent + water + electricity;
                card.className = "bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:shadow-md transition";
                card.innerHTML = `
                    <div class="flex-1 min-w-0 space-y-2">
                        <div class="flex justify-between items-start">
                            <span class="bg-indigo-50 text-indigo-700 text-xs font-semibold px-2.5 py-1 rounded-lg">${prop.name}</span>
                            <div class="flex space-x-1">
                                <button onclick="openEditPropertyModal(${prop.id})" class="p-1.5 text-slate-400 hover:text-indigo-600 transition"><i class="fa-solid fa-pen text-xs"></i></button>
                                <button onclick="deleteProperty(${prop.id})" class="p-1.5 text-slate-400 hover:text-rose-600 transition"><i class="fa-solid fa-trash text-xs"></i></button>
                            </div>
                        </div>
                        <h3 class="font-bold text-slate-800 text-base">${prop.address}</h3>
                    </div>
                    <div class="border-t border-slate-100 pt-3 flex justify-between items-center sm:border-t-0 sm:border-l sm:pt-0 sm:pl-5 sm:gap-6">
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-5 text-right">
                            <div>
                                <span class="block text-xs text-slate-400 font-medium">Aluguel</span>
                                <span class="font-bold text-indigo-600 text-sm">R$ ${rent.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                            </div>
                            <div>
                                <span class="block text-xs text-slate-400 font-medium">Água</span>
                                <span class="font-bold text-sky-600 text-sm">R$ ${water.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                            </div>
                            <div>
                                <span class="block text-xs text-slate-400 font-medium">Luz</span>
                                <span class="font-bold text-amber-600 text-sm">R$ ${electricity.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                            </div>
                            <div>
                                <span class="block text-xs text-slate-500 font-semibold">Total</span>
                                <span class="font-bold text-slate-900 text-sm">R$ ${total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                            </div>
                        </div>
                    </div>
                `;
                grid.appendChild(card);
            });
        }

        function openAddPropertyModal() {
            document.getElementById('property-modal-title').textContent = "Cadastrar Nova Casa";
            document.getElementById('prop-id').value = "";
            document.getElementById('prop-name').value = "";
            document.getElementById('prop-address').value = "";
            document.getElementById('prop-rent').value = "";
            document.getElementById('prop-water').value = "";
            document.getElementById('prop-electricity').value = "";
            document.getElementById('property-modal').classList.remove('hidden');
        }

        function openEditPropertyModal(id) {
            const prop = properties.find(p => p.id === id);
            if (!prop) return;
            document.getElementById('property-modal-title').textContent = "Editar Casa";
            document.getElementById('prop-id').value = prop.id;
            document.getElementById('prop-name').value = prop.name;
            document.getElementById('prop-address').value = prop.address;
            document.getElementById('prop-rent').value = prop.defaultRent;
            document.getElementById('prop-water').value = prop.defaultWater || 0;
            document.getElementById('prop-electricity').value = prop.defaultElectricity || 0;
            document.getElementById('property-modal').classList.remove('hidden');
        }

        function closePropertyModal() {
            document.getElementById('property-modal').classList.add('hidden');
        }

        function saveProperty(event) {
            event.preventDefault();
            const id = document.getElementById('prop-id').value;
            const name = document.getElementById('prop-name').value;
            const address = document.getElementById('prop-address').value;
            const defaultRent = parseFloat(document.getElementById('prop-rent').value);
            const defaultWater = parseFloat(document.getElementById('prop-water').value) || 0;
            const defaultElectricity = parseFloat(document.getElementById('prop-electricity').value) || 0;

            if (id) {
                const index = properties.findIndex(p => p.id == id);
                if (index !== -1) {
                    properties[index] = { id: Number(id), name, address, defaultRent, defaultWater, defaultElectricity };
                }
                showToast("Casa atualizada com sucesso!");
            } else {
                const newId = properties.length > 0 ? Math.max(...properties.map(p => p.id)) + 1 : 1;
                properties.push({ id: newId, name, address, defaultRent, defaultWater, defaultElectricity });
                showToast("Casa cadastrada com sucesso!");
            }

            saveData();
            closePropertyModal();
            renderProperties();
        }

        function deleteProperty(id) {
            if (confirm("Tem certeza que deseja excluir esta casa?")) {
                properties = properties.filter(p => p.id !== id);
                saveData();
                renderProperties();
                showToast("Casa removida com sucesso!");
            }
        }

        // --- STATEMENT & MONTHLY MANAGEMENT ---
        function changeMonth() {
            currentMonth = document.getElementById('select-month').value;
            renderStatement();
        }

        function navigateMonth(direction) {
            let [year, month] = currentMonth.split('-').map(Number);
            month += direction;
            if (month > 12) { month = 1; year++; }
            if (month < 1) { month = 12; year--; }
            currentMonth = `${year}-${String(month).padStart(2, '0')}`;
            document.getElementById('select-month').value = currentMonth;
            renderStatement();
        }

        function getMonthRecord(propId) {
            if (!records[currentMonth]) records[currentMonth] = {};
            if (!records[currentMonth][propId]) {
                records[currentMonth][propId] = {
                    rentValue: 0,
                    rentStatus: 'pending',
                    rentDate: '',
                    waterValue: 0,
                    waterStatus: 'pending',
                    waterDate: '',
                    electricityValue: 0,
                    electricityStatus: 'pending',
                    electricityDate: ''
                };
            }
            return records[currentMonth][propId];
        }

        function updateRecordField(propId, field, value) {
            const rec = getMonthRecord(propId);
            rec[field] = value;
            saveData();
            renderStatementSummary();
            const propertyTotal = (Number(rec.rentValue) || 0)
                + (Number(rec.waterValue) || 0)
                + (Number(rec.electricityValue) || 0);
            const totalElement = document.getElementById(`property-total-${propId}`);
            if (totalElement) {
                totalElement.textContent = `R$ ${propertyTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
            }
        }

        function toggleStatus(propId, type) {
            const rec = getMonthRecord(propId);
            const statusField = `${type}Status`;
            const dateField = `${type}Date`;

            if (rec[statusField] === 'paid') {
                rec[statusField] = 'pending';
                rec[statusField + 'Date'] = '';
            } else {
                rec[statusField] = 'paid';
                rec[statusField + 'Date'] = new Date().toISOString().slice(0, 10);
            }
            saveData();
            renderStatement();
        }

        function renderStatement() {
            const listContainer = document.getElementById('statement-list');
            listContainer.innerHTML = '';

            if (properties.length === 0) {
                listContainer.innerHTML = `
                    <div class="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center">
                        <div class="mx-auto mb-3 w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                            <i class="fa-solid fa-house text-xl"></i>
                        </div>
                        <h3 class="font-bold text-slate-800">Nenhuma casa cadastrada</h3>
                        <p class="text-sm text-slate-500 mt-1">Cadastre uma casa para acompanhar os valores deste mês.</p>
                        <button onclick="switchTab('properties')" class="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition">
                            Cadastrar casa
                        </button>
                    </div>
                `;
                renderStatementSummary();
                return;
            }

            properties.forEach(prop => {
                const rec = getMonthRecord(prop.id);
                const propertyTotal = (Number(rec.rentValue) || 0)
                    + (Number(rec.waterValue) || 0)
                    + (Number(rec.electricityValue) || 0);

                const card = document.createElement('div');
                card.className = "bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-100 space-y-5 hover:shadow-md transition";
                
                card.innerHTML = `
                    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
                        <div class="flex items-start gap-3">
                            <div class="w-10 h-10 shrink-0 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                <i class="fa-solid fa-house"></i>
                            </div>
                            <div>
                                <span class="text-xs font-bold text-indigo-600 uppercase tracking-wide">${prop.name}</span>
                                <h3 class="font-semibold text-slate-700 text-sm mt-0.5">${prop.address}</h3>
                            </div>
                        </div>
                        <div class="sm:text-right rounded-xl bg-indigo-50/70 px-4 py-2">
                            <span class="block text-[11px] font-semibold text-indigo-500 uppercase tracking-wider">Total da casa</span>
                            <span id="property-total-${prop.id}" class="font-bold text-indigo-700 text-base">R$ ${propertyTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <!-- Aluguel -->
                        <div class="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 space-y-3">
                            <div class="flex justify-between items-center">
                                <span class="flex items-center gap-2 text-xs font-bold text-indigo-700 uppercase tracking-wide"><i class="fa-solid fa-key"></i> Aluguel</span>
                                <button onclick="toggleStatus(${prop.id}, 'rent')" class="px-2.5 py-1 rounded-lg text-xs font-bold transition ${rec.rentStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">
                                    ${rec.rentStatus === 'paid' ? '<i class="fa-solid fa-check mr-1"></i> Pago' : '<i class="fa-solid fa-clock mr-1"></i> Pendente'}
                                </button>
                            </div>
                            <div>
                                <label class="text-xs text-slate-400 block mb-1">Valor (R$)</label>
                                <input type="number" step="0.01" value="${rec.rentValue}" onchange="updateRecordField(${prop.id}, 'rentValue', parseFloat(this.value))" class="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            </div>
                            ${rec.rentDate ? `<span class="text-xs text-slate-400 block">Pago em: ${rec.rentDate}</span>` : ''}
                        </div>

                        <!-- Água -->
                        <div class="bg-sky-50/50 p-4 rounded-xl border border-sky-100 space-y-3">
                            <div class="flex justify-between items-center">
                                <span class="flex items-center gap-2 text-xs font-bold text-sky-700 uppercase tracking-wide"><i class="fa-solid fa-droplet"></i> Água</span>
                                <button onclick="toggleStatus(${prop.id}, 'water')" class="px-2.5 py-1 rounded-lg text-xs font-bold transition ${rec.waterStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">
                                    ${rec.waterStatus === 'paid' ? '<i class="fa-solid fa-check mr-1"></i> Pago' : '<i class="fa-solid fa-clock mr-1"></i> Pendente'}
                                </button>
                            </div>
                            <div>
                                <label class="text-xs text-slate-400 block mb-1">Valor Informado (R$)</label>
                                <input type="number" step="0.01" value="${rec.waterValue || ''}" placeholder="0.00" onchange="updateRecordField(${prop.id}, 'waterValue', parseFloat(this.value) || 0)" class="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            </div>
                            ${rec.waterDate ? `<span class="text-xs text-slate-400 block">Pago em: ${rec.waterDate}</span>` : ''}
                        </div>

                        <!-- Luz -->
                        <div class="bg-amber-50/50 p-4 rounded-xl border border-amber-100 space-y-3">
                            <div class="flex justify-between items-center">
                                <span class="flex items-center gap-2 text-xs font-bold text-amber-700 uppercase tracking-wide"><i class="fa-solid fa-bolt"></i> Luz</span>
                                <button onclick="toggleStatus(${prop.id}, 'electricity')" class="px-2.5 py-1 rounded-lg text-xs font-bold transition ${rec.electricityStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">
                                    ${rec.electricityStatus === 'paid' ? '<i class="fa-solid fa-check mr-1"></i> Pago' : '<i class="fa-solid fa-clock mr-1"></i> Pendente'}
                                </button>
                            </div>
                            <div>
                                <label class="text-xs text-slate-400 block mb-1">Valor Informado (R$)</label>
                                <input type="number" step="0.01" value="${rec.electricityValue || ''}" placeholder="0.00" onchange="updateRecordField(${prop.id}, 'electricityValue', parseFloat(this.value) || 0)" class="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            </div>
                            ${rec.electricityDate ? `<span class="text-xs text-slate-400 block">Pago em: ${rec.electricityDate}</span>` : ''}
                        </div>
                    </div>
                `;
                listContainer.appendChild(card);
            });

            renderStatementSummary();
        }

        function renderStatementSummary() {
            let total = 0;
            let received = 0;
            let pending = 0;

            properties.forEach(prop => {
                const rec = getMonthRecord(prop.id);
                const rVal = Number(rec.rentValue) || 0;
                const wVal = Number(rec.waterValue) || 0;
                const eVal = Number(rec.electricityValue) || 0;

                total += rVal + wVal + eVal;

                if (rec.rentStatus === 'paid') received += rVal; else pending += rVal;
                if (rec.waterStatus === 'paid') received += wVal; else pending += wVal;
                if (rec.electricityStatus === 'paid') received += eVal; else pending += eVal;
            });

            document.getElementById('summary-total').textContent = `R$ ${total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
            document.getElementById('summary-received').textContent = `R$ ${received.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
            document.getElementById('summary-pending').textContent = `R$ ${pending.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
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
                        renderProperties();
                        renderStatement();
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
