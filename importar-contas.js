        let utilityBillDrafts = [];
        let pdfLibraryPromise = null;

        function normalizeBillText(value) {
            return value.normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toUpperCase()
                .replace(/[°º]/g, 'O')
                .replace(/\s+/g, ' ')
                .trim();
        }

        function normalizeUtilityCode(value) {
            return String(value || '').replace(/\D/g, '');
        }

        function parseBrazilianDate(value) {
            const match = String(value || '').match(/\b(\d{2})[/.](\d{2})[/.](\d{4})\b/);
            if (!match) return '';
            return `${match[3]}-${match[2]}-${match[1]}`;
        }

        function parseBrazilianAmount(value) {
            if (!value) return null;
            const match = value.replace(/\*/g, '').match(/(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/);
            if (!match) return null;
            return Number(match[1].replace(/\./g, '').replace(',', '.'));
        }

        function findPdfTextItem(items, expression) {
            return items.find(item => expression.test(normalizeBillText(item.str)));
        }

        function findNearbyPdfDate(items, label) {
            if (!label) return '';
            const labelY = label.transform[5];
            const candidates = items
                .map(item => ({
                    item,
                    value: parseBrazilianDate(item.str),
                    verticalDistance: Math.abs(item.transform[5] - labelY),
                    horizontalDistance: Math.abs(item.transform[4] - label.transform[4])
                }))
                .filter(candidate =>
                    candidate.value
                    && candidate.item.page === label.page
                    && candidate.verticalDistance <= 18
                );
            candidates.sort((left, right) =>
                left.verticalDistance - right.verticalDistance
                || left.horizontalDistance - right.horizontalDistance
            );
            return candidates[0]?.value || '';
        }

        function findNearbyPdfAmount(items, label, sameRowOnly = false) {
            if (!label) return null;
            const candidates = items
                .map(item => ({
                    item,
                    value: parseBrazilianAmount(item.str),
                    verticalDistance: Math.abs(item.transform[5] - label.transform[5]),
                    horizontalDistance: item.transform[4] - label.transform[4]
                }))
                .filter(candidate =>
                    candidate.value !== null
                    && candidate.item.page === label.page
                    && candidate.horizontalDistance >= 0
                    && candidate.verticalDistance <= (sameRowOnly ? 2 : 18)
                );
            if (!candidates.length) return null;

            if (sameRowOnly) {
                candidates.sort((left, right) => right.item.transform[4] - left.item.transform[4]);
            } else {
                candidates.sort((left, right) =>
                    left.verticalDistance * 50 + Math.abs(left.horizontalDistance)
                    - (right.verticalDistance * 50 + Math.abs(right.horizontalDistance))
                );
            }
            return candidates[0].value;
        }

        function extractBillMonth(items) {
            const monthNumbers = {
                JAN: '01', FEV: '02', MAR: '03', ABR: '04',
                MAI: '05', JUN: '06', JUL: '07', AGO: '08',
                SET: '09', OUT: '10', NOV: '11', DEZ: '12'
            };
            for (const item of items) {
                const match = normalizeBillText(item.str).match(/\b(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\s*\/\s*(\d{2}|\d{4})\b/);
                if (!match) continue;
                const year = match[2].length === 2 ? `20${match[2]}` : match[2];
                return `${year}-${monthNumbers[match[1]]}`;
            }
            return '';
        }

        async function loadPdfLibrary() {
            if (window.pdfjsLib) {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc =
                    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                return window.pdfjsLib;
            }
            if (!pdfLibraryPromise) {
                pdfLibraryPromise = new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
                    script.onload = () => {
                        if (!window.pdfjsLib) {
                            reject(new Error('A biblioteca de leitura de PDF não foi carregada corretamente.'));
                            return;
                        }
                        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
                            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                        resolve(window.pdfjsLib);
                    };
                    script.onerror = () => reject(new Error('Não foi possível carregar o leitor de PDF. Verifique sua conexão e tente novamente.'));
                    document.head.appendChild(script);
                });
            }
            return pdfLibraryPromise;
        }

        function collectPdfItems(pages) {
            return pages.flatMap(page => page.items.map(item => ({
                str: item.str,
                page: page.number,
                transform: item.transform
            })));
        }

        async function parseUtilityPdf(file, pdfLibrary) {
            const pdf = await pdfLibrary.getDocument({
                data: new Uint8Array(await file.arrayBuffer())
            }).promise;
            try {
                const pages = [];
                for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
                    const page = await pdf.getPage(pageNumber);
                    const content = await page.getTextContent();
                    pages.push({ number: pageNumber, items: content.items });
                }

                const items = collectPdfItems(pages);
                const fullText = normalizeBillText(items.map(item => item.str).join(' '));
                const enelCodePattern = /(?:INSTALACAO\s*N\s*O?\s*:?\s*|\bUC\s*:?\s*)([0-9.]{6,})|^\s*([0-9.]{6,})\s*\/\s*[0-9.]{6,}/;
                const hasEnelInstallation = enelCodePattern.test(fullText);
                const utility = /SABESP|FATURA DE SERVICOS DE AGUA/.test(fullText)
                    ? 'sabesp'
                    : /ENEL/.test(fullText) || hasEnelInstallation
                        ? 'enel'
                        : 'unknown';

                const bill = {
                    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                    fileName: file.name,
                    utility,
                    accountCode: '',
                    propertyId: '',
                    amount: null,
                    month: '',
                    dueDate: '',
                    selected: false,
                    errors: []
                };

                if (utility === 'sabesp') {
                    const codeMatch = fullText.match(/\bCOD(?:IGO)?\.?\s*(?:DE\s+)?FORNECIMENTO\s*:?\s*([0-9.]{6,})/);
                    bill.accountCode = normalizeUtilityCode(codeMatch?.[1]);
                    const totalLabel = findPdfTextItem(items, /^TOTAL:$/);
                    bill.amount = findNearbyPdfAmount(items, totalLabel, true);
                    const dueLabel = findPdfTextItem(items, /^VENCIMENTO:$/);
                    bill.dueDate = findNearbyPdfDate(items, dueLabel);
                } else if (utility === 'enel') {
                    const codeMatch = fullText.match(enelCodePattern);
                    bill.accountCode = normalizeUtilityCode(codeMatch?.[1] || codeMatch?.[2]);
                    const dueLabel = findPdfTextItem(items, /DATA\s+DE\s+VENCIMENTO/);
                    bill.dueDate = findNearbyPdfDate(items, dueLabel);
                    const amountLabel = findPdfTextItem(items, /VALOR\s+DO\s+DOCUMENTO/);
                    bill.amount = findNearbyPdfAmount(items, amountLabel);
                } else {
                    bill.errors.push('Não foi possível identificar a Sabesp ou a Enel neste PDF.');
                }

                bill.month = extractBillMonth(items)
                    || (bill.dueDate ? bill.dueDate.slice(0, 7) : currentMonth);

                if (utility !== 'unknown' && !bill.accountCode) {
                    bill.errors.push('O número de fornecimento ou de instalação não foi encontrado no PDF.');
                }
                if (bill.amount === null || !Number.isFinite(bill.amount)) {
                    bill.amount = '';
                    bill.errors.push('Confira e informe o valor da fatura; ele não pôde ser lido com segurança.');
                }
                if (!bill.dueDate) {
                    bill.errors.push('A data de vencimento não foi detectada; confira a competência antes de importar.');
                }

                const configuredCode = property => normalizeUtilityCode(
                    utility === 'sabesp' ? property.sabespCustomerCode : property.enelInstallationCode
                );
                const match = properties.find(property =>
                    utility !== 'unknown'
                    && bill.accountCode
                    && configuredCode(property) === bill.accountCode
                );
                if (match) bill.propertyId = String(match.id);
                bill.selected = Boolean(match && bill.amount !== '');
                return bill;
            } finally {
                await pdf.destroy();
            }
        }

        function setUtilityImportMessage(message, isError = false) {
            const element = document.getElementById('utility-import-message');
            if (!element) return;
            element.textContent = message;
            element.className = `text-sm ${isError ? 'text-rose-600' : 'text-slate-600'}`;
        }

        function createUtilityReviewField(labelText, control) {
            const wrapper = document.createElement('label');
            wrapper.className = 'block text-xs font-medium text-slate-600';
            const label = document.createElement('span');
            label.className = 'mb-1 block';
            label.textContent = labelText;
            wrapper.append(label, control);
            return wrapper;
        }

        function renderUtilityBillDrafts() {
            const review = document.getElementById('utility-import-review');
            const actions = document.getElementById('utility-import-actions');
            const count = document.getElementById('utility-import-count');
            if (!review || !actions || !count) return;

            review.replaceChildren();
            actions.classList.toggle('hidden', utilityBillDrafts.length === 0);

            utilityBillDrafts.forEach(bill => {
                const card = document.createElement('article');
                card.className = 'rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3';
                const heading = document.createElement('div');
                heading.className = 'flex items-start justify-between gap-3';

                const fileBlock = document.createElement('div');
                fileBlock.className = 'min-w-0';
                const fileName = document.createElement('p');
                fileName.className = 'break-all text-sm font-semibold text-slate-800';
                fileName.textContent = bill.fileName;
                const identification = document.createElement('p');
                identification.className = 'mt-1 text-xs text-slate-500';
                const companyNames = { sabesp: 'Sabesp', enel: 'Enel', unknown: 'Empresa não identificada' };
                identification.textContent = `${companyNames[bill.utility]} · Conta terminada em ${bill.accountCode ? bill.accountCode.slice(-4) : 'não identificada'}`;
                fileBlock.append(fileName, identification);

                const selectionLabel = document.createElement('label');
                selectionLabel.className = 'flex shrink-0 items-center gap-2 text-xs font-semibold text-slate-700';
                const selection = document.createElement('input');
                selection.type = 'checkbox';
                selection.checked = bill.selected;
                selection.setAttribute('aria-label', `Importar ${bill.fileName}`);
                selection.addEventListener('change', () => {
                    bill.selected = selection.checked;
                    updateUtilityImportCount();
                });
                selectionLabel.append(selection, document.createTextNode('Importar'));
                heading.append(fileBlock, selectionLabel);
                card.append(heading);

                const fields = document.createElement('div');
                fields.className = 'grid grid-cols-1 sm:grid-cols-3 gap-3';

                const propertySelect = document.createElement('select');
                propertySelect.className = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
                const emptyOption = document.createElement('option');
                emptyOption.value = '';
                emptyOption.textContent = 'Selecione a casa';
                propertySelect.appendChild(emptyOption);
                properties.forEach(property => {
                    const option = document.createElement('option');
                    option.value = String(property.id);
                    option.textContent = property.name;
                    propertySelect.appendChild(option);
                });
                propertySelect.value = bill.propertyId;
                propertySelect.addEventListener('change', () => {
                    bill.propertyId = propertySelect.value;
                    updateUtilityImportCount();
                });
                fields.appendChild(createUtilityReviewField('Casa', propertySelect));

                const monthInput = document.createElement('input');
                monthInput.type = 'month';
                monthInput.value = bill.month;
                monthInput.className = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
                monthInput.addEventListener('change', () => {
                    bill.month = monthInput.value;
                    updateUtilityImportCount();
                });
                fields.appendChild(createUtilityReviewField('Competência', monthInput));

                const amountInput = document.createElement('input');
                amountInput.type = 'number';
                amountInput.min = '0';
                amountInput.step = '0.01';
                amountInput.value = bill.amount;
                amountInput.placeholder = 'Informe o valor';
                amountInput.className = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
                amountInput.addEventListener('input', () => {
                    bill.amount = amountInput.value === '' ? '' : Number(amountInput.value);
                    bill.errors = bill.errors.filter(error => !error.startsWith('Confira e informe o valor'));
                    updateUtilityImportCount();
                });
                fields.appendChild(createUtilityReviewField(bill.utility === 'sabesp' ? 'Valor da água (R$)' : 'Valor da luz (R$)', amountInput));
                card.appendChild(fields);

                if (bill.errors.length) {
                    const errors = document.createElement('ul');
                    errors.className = 'space-y-1 text-xs text-amber-700';
                    bill.errors.forEach(message => {
                        const item = document.createElement('li');
                        item.textContent = message;
                        errors.appendChild(item);
                    });
                    card.appendChild(errors);
                } else {
                    const confirmation = document.createElement('p');
                    confirmation.className = 'text-xs text-emerald-700';
                    confirmation.textContent = bill.dueDate
                        ? `Vencimento detectado: ${new Date(`${bill.dueDate}T12:00:00`).toLocaleDateString('pt-BR')}. Confira os campos antes de importar.`
                        : 'Confira os campos detectados antes de importar.';
                    card.appendChild(confirmation);
                }
                review.appendChild(card);
            });

            review.classList.toggle('hidden', utilityBillDrafts.length === 0);
            updateUtilityImportCount();
        }

        function updateUtilityImportCount() {
            const count = document.getElementById('utility-import-count');
            if (!count) return;
            const selected = utilityBillDrafts.filter(bill => bill.selected);
            const invalid = selected.filter(bill =>
                !bill.propertyId
                || !/^\d{4}-(0[1-9]|1[0-2])$/.test(bill.month)
                || !Number.isFinite(Number(bill.amount))
                || Number(bill.amount) < 0
                || bill.utility === 'unknown'
            );
            count.textContent = invalid.length
                ? `${selected.length} selecionada(s); corrija os campos destacados antes de importar.`
                : `${selected.length} fatura(s) selecionada(s) para revisão e importação.`;
            const button = document.getElementById('utility-import-button');
            if (button) button.disabled = selected.length === 0 || invalid.length > 0;
        }

        async function analyzeUtilityPdfs() {
            const input = document.getElementById('utility-pdf-files');
            const button = document.getElementById('utility-analyze-button');
            const files = Array.from(input?.files || []);
            if (!files.length) {
                setUtilityImportMessage('Selecione pelo menos um arquivo PDF.', true);
                return;
            }

            button.disabled = true;
            button.textContent = 'Analisando...';
            setUtilityImportMessage('Lendo os arquivos localmente neste navegador...');
            utilityBillDrafts = [];
            try {
                const pdfLibrary = await loadPdfLibrary();
                for (const file of files) {
                    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
                        utilityBillDrafts.push({
                            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                            fileName: file.name,
                            utility: 'unknown',
                            accountCode: '',
                            propertyId: '',
                            amount: '',
                            month: currentMonth,
                            dueDate: '',
                            selected: false,
                            errors: ['Este arquivo não é um PDF.']
                        });
                        continue;
                    }
                    try {
                        utilityBillDrafts.push(await parseUtilityPdf(file, pdfLibrary));
                    } catch (error) {
                        utilityBillDrafts.push({
                            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                            fileName: file.name,
                            utility: 'unknown',
                            accountCode: '',
                            propertyId: '',
                            amount: '',
                            month: currentMonth,
                            dueDate: '',
                            selected: false,
                            errors: [`Não foi possível ler este PDF: ${error.message}`]
                        });
                    }
                }
                renderUtilityBillDrafts();
                const recognized = utilityBillDrafts.filter(bill => bill.utility !== 'unknown').length;
                setUtilityImportMessage(
                    `Análise concluída: ${recognized} de ${utilityBillDrafts.length} fatura(s) reconhecida(s). Revise cada casa, competência e valor antes de importar.`
                );
            } catch (error) {
                pdfLibraryPromise = null;
                setUtilityImportMessage(`Não foi possível iniciar a leitura: ${error.message}`, true);
            } finally {
                button.disabled = false;
                button.textContent = 'Analisar PDFs';
            }
        }

        function importReviewedUtilityBills() {
            const selected = utilityBillDrafts.filter(bill => bill.selected);
            if (!selected.length) {
                setUtilityImportMessage('Selecione pelo menos uma fatura para importar.', true);
                return;
            }

            const duplicate = selected.find((bill, index) =>
                selected.some((other, otherIndex) =>
                    otherIndex < index
                    && other.propertyId === bill.propertyId
                    && other.month === bill.month
                    && other.utility === bill.utility
                )
            );
            if (duplicate) {
                setUtilityImportMessage('Há duas faturas selecionadas para a mesma casa, empresa e competência. Importe-as separadamente após conferir.', true);
                return;
            }

            const invalid = selected.find(bill =>
                !bill.propertyId
                || !/^\d{4}-(0[1-9]|1[0-2])$/.test(bill.month)
                || !Number.isFinite(Number(bill.amount))
                || Number(bill.amount) < 0
                || bill.utility === 'unknown'
            );
            if (invalid) {
                setUtilityImportMessage('Confira a empresa, casa, competência e valor de todas as faturas selecionadas.', true);
                return;
            }

            const chargeFieldByUtility = { sabesp: 'waterValue', enel: 'electricityValue' };
            const conflicts = selected.filter(bill => {
                const field = chargeFieldByUtility[bill.utility];
                const existing = records[bill.month]?.[bill.propertyId]?.[field];
                return Number.isFinite(Number(existing))
                    && Number(existing) !== 0
                    && Number(existing) !== Number(bill.amount);
            });
            if (conflicts.length) {
                const descriptions = conflicts.map(bill => {
                    const property = properties.find(item => String(item.id) === bill.propertyId);
                    return `${property?.name || 'Casa'} - ${bill.utility === 'sabesp' ? 'água' : 'luz'} (${bill.month})`;
                }).join('\n');
                if (!confirm(`Estas faturas substituirão valores já lançados:\n${descriptions}\n\nDeseja continuar?`)) return;
            }

            selected.forEach(bill => {
                const field = chargeFieldByUtility[bill.utility];
                const record = records[bill.month]?.[bill.propertyId]
                    || getMonthRecordForPeriod(bill.month, bill.propertyId);
                record[field] = Number(bill.amount);
            });

            saveData();
            const importedMonths = new Set(selected.map(bill => bill.month));
            if (importedMonths.size === 1) {
                currentMonth = selected[0].month;
                localStorage.setItem('rental_current_month', currentMonth);
            }
            const monthSelector = document.getElementById('select-month');
            if (monthSelector) monthSelector.value = currentMonth;
            renderStatement();
            renderProperties();

            selected.forEach(bill => {
                bill.selected = false;
            });
            renderUtilityBillDrafts();
            const monthNotice = importedMonths.size === 1
                ? ''
                : ' As competências são diferentes; use o seletor de mês para conferir cada uma.';
            setUtilityImportMessage(`${selected.length} fatura(s) importada(s). Confira o status de pagamento no extrato.${monthNotice}`);
            showToast(`${selected.length} fatura(s) importada(s) com sucesso!`);
        }
