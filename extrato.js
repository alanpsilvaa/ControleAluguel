        // --- STATEMENT & MONTHLY MANAGEMENT ---
        function normalizeTenantSearch(value) {
            return String(value || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLocaleLowerCase('pt-BR')
                .trim();
        }

        function openShareSummary(propertyId) {
            const property = properties.find(item => String(item.id) === String(propertyId));
            if (!property) {
                showToast('Não foi possível localizar este imóvel.', 'error');
                return;
            }

            const record = getMonthRecord(property.id);
            const monthLabel = new Intl.DateTimeFormat('pt-BR', {
                month: 'long',
                year: 'numeric'
            }).format(new Date(`${currentMonth}-01T12:00:00`));
            const formatCurrency = value => `R$ ${Number(value || 0).toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })}`;
            const total = (Number(record.rentValue) || 0)
                + (Number(record.waterValue) || 0)
                + (Number(record.electricityValue) || 0);
            const message = [
                `Olá! Segue o resumo dos valores do imóvel ${property.name} referente a ${monthLabel}:`,
                '',
                `Aluguel: ${formatCurrency(record.rentValue)}`,
                `Água: ${formatCurrency(record.waterValue)}`,
                `Luz: ${formatCurrency(record.electricityValue)}`,
                '',
                `Total: ${formatCurrency(total)}`
            ].join('\n');

            const modal = document.getElementById('share-summary-modal');
            const messageField = document.getElementById('share-summary-message');
            messageField.value = message;
            updateShareWhatsAppLink();
            modal.classList.remove('hidden');
            messageField.focus();
            messageField.select();
        }

        function closeShareSummary() {
            document.getElementById('share-summary-modal').classList.add('hidden');
        }

        function updateShareWhatsAppLink() {
            const message = document.getElementById('share-summary-message').value;
            document.getElementById('share-summary-whatsapp').href =
                `https://wa.me/?text=${encodeURIComponent(message)}`;
        }

        function changeMonth() {
            currentMonth = document.getElementById('select-month').value;
            localStorage.setItem('rental_current_month', currentMonth);
            renderStatement();
        }

        function navigateMonth(direction) {
            let [year, month] = currentMonth.split('-').map(Number);
            month += direction;
            if (month > 12) { month = 1; year++; }
            if (month < 1) { month = 12; year--; }
            currentMonth = `${year}-${String(month).padStart(2, '0')}`;
            localStorage.setItem('rental_current_month', currentMonth);
            document.getElementById('select-month').value = currentMonth;
            renderStatement();
        }

        function getMonthRecord(propId) {
            return getMonthRecordForPeriod(currentMonth, propId);
        }

        function getMonthRecordForPeriod(month, propId) {
            if (!records[month]) records[month] = {};
            if (!records[month][propId]) {
                const property = properties.find(item => String(item.id) === String(propId));
                records[month][propId] = {
                    rentValue: Number(property?.defaultRent) || 0,
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
            return records[month][propId];
        }

        function updateRecordField(propId, field, value) {
            const rec = getMonthRecord(propId);
            rec[field] = value;
            saveData();
            renderStatement();
        }

        function toggleStatus(propId, type) {
            const rec = getMonthRecord(propId);
            const statusField = `${type}Status`;
            const dateField = `${type}Date`;

            if (rec[statusField] === 'paid') {
                rec[statusField] = 'pending';
                rec[dateField] = '';
            } else {
                rec[statusField] = 'paid';
                rec[dateField] = new Date().toISOString().slice(0, 10);
            }
            saveData();
            renderStatement();
        }

        function togglePropertyMonthlyStatus(propId) {
            const rec = getMonthRecord(propId);
            const chargeTypes = ['rent', 'water', 'electricity'];
            const allChargesPaid = chargeTypes.every(type => rec[`${type}Status`] === 'paid');
            const nextStatus = allChargesPaid ? 'pending' : 'paid';
            const paymentDate = nextStatus === 'paid' ? new Date().toISOString().slice(0, 10) : '';

            chargeTypes.forEach(type => {
                rec[`${type}Status`] = nextStatus;
                rec[`${type}Date`] = paymentDate;
            });

            saveData();
            renderProperties();
            renderStatement();
        }

        function renderStatementCharge(prop, rec, type, label, icon, valueField, color) {
            const isPaid = rec[`${type}Status`] === 'paid';
            const value = type === 'rent' ? rec[valueField] : (rec[valueField] || '');
            const valueHandler = type === 'rent'
                ? `parseFloat(this.value)`
                : `parseFloat(this.value) || 0`;
            const date = rec[`${type}Date`];

            return `
                <div class="statement-charge ${isPaid ? 'is-paid' : 'is-pending'} rounded-xl border p-3">
                    <div class="flex items-center justify-between gap-2">
                        <span class="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-${color}-700">
                            <i class="fa-solid ${icon}"></i>${label}
                        </span>
                        <button type="button" onclick="toggleStatus(${Number(prop.id)}, '${type}')" aria-label="${isPaid ? 'Marcar como pendente' : 'Marcar como pago'}: ${label} - ${escapeHtml(prop.name)}" class="shrink-0 rounded-lg px-2 py-1 text-xs font-bold transition ${isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">
                            ${isPaid ? '<i class="fa-solid fa-check mr-1"></i>Pago' : '<i class="fa-solid fa-clock mr-1"></i>Pendente'}
                        </button>
                    </div>
                    <label class="sr-only" for="charge-${type}-${Number(prop.id)}">Valor de ${label} para ${escapeHtml(prop.name)}</label>
                    <div class="relative mt-2">
                        <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs font-medium text-slate-400">R$</span>
                        <input id="charge-${type}-${Number(prop.id)}" type="number" step="0.01" value="${escapeHtml(value)}" placeholder="0,00" onchange="updateRecordField(${Number(prop.id)}, '${valueField}', ${valueHandler})" class="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    </div>
                    ${date ? `<span class="mt-1.5 block text-[11px] text-slate-400">Pago em: ${escapeHtml(date)}</span>` : ''}
                </div>
            `;
        }

        function renderStatement() {
            const listContainer = document.getElementById('statement-list');
            if (!listContainer) return;
            listContainer.innerHTML = '';
            const searchTerm = normalizeTenantSearch(document.getElementById('tenant-filter')?.value);
            const paymentFilter = document.getElementById('payment-status-filter')?.value || 'all';
            const visibleProperties = properties.filter(prop => {
                if (!normalizeTenantSearch(prop.name).includes(searchTerm)) return false;
                if (paymentFilter === 'all') return true;

                const rec = getMonthRecord(prop.id);
                const allPaymentsPaid = ['rent', 'water', 'electricity']
                    .every(type => rec[`${type}Status`] === 'paid');
                return paymentFilter === 'paid' ? allPaymentsPaid : !allPaymentsPaid;
            });

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
                renderStatementSummary([]);
                return;
            }

            if (visibleProperties.length === 0) {
                listContainer.innerHTML = `
                    <div class="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                        <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                            <i class="fa-solid fa-magnifying-glass text-xl"></i>
                        </div>
                        <h3 class="font-bold text-slate-800">Nenhum lançamento encontrado</h3>
                        <p class="mt-1 text-sm text-slate-500">Tente mudar a busca ou o filtro de pagamento.</p>
                    </div>
                `;
                renderStatementSummary([]);
                return;
            }

            visibleProperties.forEach(prop => {
                const rec = getMonthRecord(prop.id);
                const propertyTotal = (Number(rec.rentValue) || 0)
                    + (Number(rec.waterValue) || 0)
                    + (Number(rec.electricityValue) || 0);
                const card = document.createElement('div');
                card.className = "statement-property-card bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 space-y-3";
                card.innerHTML = `
                    <div class="flex items-center justify-between gap-3">
                        <div class="min-w-0 space-y-0.5">
                            <div class="flex min-w-0 items-center gap-2">
                                <i class="fa-solid fa-circle-user w-4 shrink-0 text-center text-indigo-600" aria-hidden="true"></i>
                                <h3 class="min-w-0 truncate text-sm font-bold text-slate-800">${escapeHtml(prop.name)}</h3>
                            </div>
                            <div class="flex min-w-0 items-start gap-2">
                                <i class="fa-solid fa-house mt-0.5 w-4 shrink-0 text-center text-indigo-600" aria-hidden="true"></i>
                                <p class="min-w-0 whitespace-normal break-words text-xs text-slate-600">${escapeHtml(prop.address)}</p>
                            </div>
                        </div>
                        <div class="statement-property-total shrink-0 rounded-lg px-3 py-1.5 text-right">
                            <span class="block text-[10px] font-semibold uppercase tracking-wide text-indigo-500">Total</span>
                            <span class="text-sm font-bold text-indigo-700">R$ ${propertyTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        ${renderStatementCharge(prop, rec, 'rent', 'Aluguel', 'fa-key', 'rentValue', 'indigo')}
                        ${renderStatementCharge(prop, rec, 'water', 'Água', 'fa-droplet', 'waterValue', 'sky')}
                        ${renderStatementCharge(prop, rec, 'electricity', 'Luz', 'fa-bolt', 'electricityValue', 'amber')}
                    </div>
                    <div class="flex justify-end border-t border-slate-200 pt-2">
                        <button type="button" onclick="openShareSummary(${Number(prop.id)})" class="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700">
                            <i class="fa-brands fa-whatsapp" aria-hidden="true"></i>
                            Compartilhar cobrança
                        </button>
                    </div>
                `;
                listContainer.appendChild(card);
            });

            renderStatementSummary(visibleProperties);
        }

        function renderStatementSummary(summaryProperties = properties) {
            let total = 0;
            let received = 0;
            let pending = 0;

            summaryProperties.forEach(prop => {
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
