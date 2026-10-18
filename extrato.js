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
