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
        const savedMonth = localStorage.getItem('rental_current_month');
        let currentMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(savedMonth || '')
            ? savedMonth
            : new Date().toISOString().slice(0, 7);

        // Supabase client instance (if configured)
        let supabaseClient = null;
        let cloudReady = false;
        let supabaseSession = null;

        window.onload = async function() {
            const monthSelector = document.getElementById('select-month');
            if (monthSelector) monthSelector.value = currentMonth;
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
            renderCurrentPage();
        };

        function renderCurrentPage() {
            if (document.getElementById('properties-grid')) renderProperties();
            if (document.getElementById('statement-list')) renderStatement();
        }

        // Tab Switching
        function switchTab(tabName) {
            const targetSection = document.getElementById(`tab-${tabName}`);
            if (!targetSection && tabName !== 'settings') {
                window.location.href = tabName === 'statement' ? 'extrato.html' : 'casas.html';
                return;
            }

            ['properties', 'statement', 'settings'].forEach(name => {
                const section = document.getElementById(`tab-${name}`);
                const button = document.getElementById(`btn-tab-${name}`);
                if (section) section.classList.toggle('hidden', name !== tabName);
                if (button) {
                    button.className = name === tabName
                        ? "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center space-x-2 bg-white text-indigo-700 shadow-sm"
                        : "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center space-x-2 text-indigo-100 hover:text-white";
                }
            });

            if (tabName === 'properties') {
                renderProperties();
            } else if (tabName === 'statement') {
                renderStatement();
            } else if (tabName === 'settings') {
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
