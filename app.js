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
