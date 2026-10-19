        // --- PROPERTIES MANAGEMENT ---
        function renderProperties() {
            const grid = document.getElementById('properties-grid');
            if (!grid) return;
            grid.innerHTML = '';

            properties.forEach(prop => {
                const propertyId = Number(prop.id);
                const card = document.createElement('div');
                const rent = Number(prop.defaultRent) || 0;
                card.className = "bg-slate-200 p-4 rounded-2xl shadow-sm border border-slate-300 flex flex-col gap-3 hover:shadow-md transition";
                card.innerHTML = `
                    <div class="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-between">
                        <div class="min-w-0 space-y-2">
                            <span class="inline-flex rounded-lg bg-indigo-50 px-2.5 py-1 text-base font-semibold text-indigo-700">${escapeHtml(prop.name)}</span>
                            <h3 class="font-bold text-slate-800 text-base">${escapeHtml(prop.address)}</h3>
                            <div class="flex flex-col gap-1 text-xs text-slate-500 sm:flex-row sm:flex-wrap sm:gap-x-5">
                                <span><span class="font-semibold text-sky-700">Fornecimento Sabesp:</span> <span class="font-mono">${escapeHtml(prop.sabespCustomerCode || 'Não cadastrado')}</span></span>
                                <span><span class="font-semibold text-amber-700">UC Enel:</span> <span class="font-mono">${escapeHtml(prop.enelInstallationCode || 'Não cadastrada')}</span></span>
                            </div>
                        </div>
                        <div class="flex w-full items-center justify-between gap-4 border-t border-slate-100 pt-3 sm:w-48 sm:shrink-0 sm:flex-col sm:items-stretch sm:justify-center sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
                            <div class="text-left sm:text-right">
                                <span class="block text-xs font-medium uppercase tracking-wide text-slate-500">Aluguel</span>
                                <span class="text-base font-bold text-indigo-600">R$ ${rent.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                            </div>
                            <div class="flex items-center justify-end gap-1">
                                <button type="button" onclick="openEditPropertyModal(${propertyId})" aria-label="Editar ${escapeHtml(prop.name)}" class="rounded-lg p-2 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600"><i class="fa-solid fa-pen text-xs"></i></button>
                                <button type="button" onclick="deleteProperty(${propertyId})" aria-label="Excluir ${escapeHtml(prop.name)}" class="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"><i class="fa-solid fa-trash text-xs"></i></button>
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
            document.getElementById('prop-sabesp-code').value = "";
            document.getElementById('prop-enel-code').value = "";
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
            document.getElementById('prop-sabesp-code').value = prop.sabespCustomerCode || "";
            document.getElementById('prop-enel-code').value = prop.enelInstallationCode || "";
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
            const sabespCustomerCode = document.getElementById('prop-sabesp-code').value.trim();
            const enelInstallationCode = document.getElementById('prop-enel-code').value.trim();
            const normalizeCode = value => String(value || '').replace(/\D/g, '');
            const existingProperty = property => String(property.id) !== String(id);
            const duplicateSabesp = normalizeCode(sabespCustomerCode) && properties.find(property =>
                existingProperty(property)
                && normalizeCode(property.sabespCustomerCode) === normalizeCode(sabespCustomerCode)
            );
            const duplicateEnel = normalizeCode(enelInstallationCode) && properties.find(property =>
                existingProperty(property)
                && normalizeCode(property.enelInstallationCode) === normalizeCode(enelInstallationCode)
            );
            if (duplicateSabesp || duplicateEnel) {
                const company = duplicateSabesp ? 'Sabesp' : 'Enel';
                showToast(`Este código de conta já está associado a outra casa na ${company}.`, 'error');
                return;
            }

            if (id) {
                const index = properties.findIndex(p => p.id == id);
                if (index !== -1) {
                    properties[index] = {
                        ...properties[index],
                        name,
                        address,
                        defaultRent,
                        sabespCustomerCode,
                        enelInstallationCode
                    };
                }
                showToast("Casa atualizada com sucesso!");
            } else {
                const newId = properties.length > 0 ? Math.max(...properties.map(p => p.id)) + 1 : 1;
                properties.push({
                    id: newId,
                    name,
                    address,
                    defaultRent,
                    sabespCustomerCode,
                    enelInstallationCode
                });
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
