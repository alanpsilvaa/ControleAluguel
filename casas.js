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
