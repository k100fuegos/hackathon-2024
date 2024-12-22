// Constantes de la API
const URL = 'http://127.0.0.1:5000/';
const INVOICE_KEY = 'c8e9b3e13a3846d68c100b9a0d8b3054';

// Elementos del DOM
const mainBalance = document.getElementById('mainBalance');
const createInvoicesBtn = document.getElementById('createInvoicesBtn');
const pendingInvoicesList = document.getElementById('pendingInvoicesList');
const paidInvoicesList = document.getElementById('paidInvoicesList');
const invoiceModal = document.getElementById('invoiceModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const copyQRBtn = document.getElementById('copyQRBtn');
const searchPending = document.getElementById('searchPending');
const searchPaid = document.getElementById('searchPaid');
const saveNoteBtn = document.getElementById('saveNoteBtn');
const modalNote = document.getElementById('modalNote');

// Almacenar facturas activas y contador
let activeInvoices = [];
let invoiceCounter = 1;
let currentInvoice = null;

// Funciones de la API
async function fetchData(action, type, key, body) {
    const response = await fetch(URL + 'api/v1/' + action, {
        method: type,
        headers: {
            "X-Api-Key": key,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });
    return await response.json();
}

async function getWalletBalance() {
    const data = await fetchData('wallet', 'GET', INVOICE_KEY);
    return data.balance / 1000; // Convertir msat a sat
}

async function createInvoice(amount, memo) {
    return await fetchData('payments', 'POST', INVOICE_KEY, {
        out: false,
        amount: amount,
        memo: memo,
        expiry: 3600
    });
}

async function checkInvoiceStatus(paymentHash) {
    const response = await fetch(`${URL}api/v1/payments/${paymentHash}`, {
        headers: {
            "X-Api-Key": INVOICE_KEY
        }
    });
    return await response.json();
}

// Funciones de UI
function updateBalance() {
    getWalletBalance().then(balance => {
        mainBalance.textContent = `${balance} SATS`;
    });
}

function createQRCode(payment_request) {
    const qrDiv = document.getElementById('qrCode');
    qrDiv.innerHTML = '';
    new QRCode(qrDiv, {
        text: payment_request,
        width: 256,
        height: 256
    });
}

function showInvoiceModal(invoice) {
    currentInvoice = invoice;
    document.getElementById('modalStatus').textContent = invoice.paid ? 'PAGADA' : 'PENDIENTE';
    document.getElementById('modalInvoiceNumber').textContent = `#${invoice.invoiceNumber}`;
    document.getElementById('modalAmount').textContent = `${invoice.amount} SATS`;
    document.getElementById('modalMemo').textContent = invoice.memo;
    modalNote.value = invoice.note || '';
    createQRCode(invoice.payment_request);
    invoiceModal.classList.remove('hidden');
}

function filterInvoices(invoices, searchText) {
    return invoices.filter(invoice => {
        const searchLower = searchText.toLowerCase();
        const noteMatch = invoice.note ? invoice.note.toLowerCase().includes(searchLower) : false;
        return invoice.invoiceNumber.toString().includes(searchText) || noteMatch;
    });
}

function updateInvoicesList() {
    const pendingSearch = searchPending.value;
    const paidSearch = searchPaid.value;

    const pendingInvoices = activeInvoices.filter(invoice => !invoice.paid);
    const paidInvoices = activeInvoices.filter(invoice => invoice.paid);

    const filteredPending = filterInvoices(pendingInvoices, pendingSearch);
    const filteredPaid = filterInvoices(paidInvoices, paidSearch);

    pendingInvoicesList.innerHTML = '';
    paidInvoicesList.innerHTML = '';

    function createInvoiceElement(invoice) {
        const element = document.createElement('div');
        element.className = 'bg-gray-700 p-3 rounded flex justify-between items-center cursor-pointer hover:bg-gray-600';
        element.innerHTML = `
            <div class="flex-1">
                <div class="flex items-center gap-2">
                    <span class="text-gray-400 text-sm">#${invoice.invoiceNumber}</span>
                    <p class="font-bold">${invoice.amount} SATS</p>
                </div>
                <p class="text-sm text-gray-400">${invoice.memo}</p>
                ${invoice.note ? `<p class="text-sm text-gray-300">Nota: ${invoice.note}</p>` : ''}
            </div>
        `;
        element.onclick = () => showInvoiceModal(invoice);
        return element;
    }

    filteredPending.forEach(invoice => {
        pendingInvoicesList.appendChild(createInvoiceElement(invoice));
    });

    filteredPaid.forEach(invoice => {
        paidInvoicesList.appendChild(createInvoiceElement(invoice));
    });
}

// Monitoreo de Estado de Facturas
function startMonitoring() {
    setInterval(async () => {
        for (let i = 0; i < activeInvoices.length; i++) {
            if (!activeInvoices[i].paid) {
                const status = await checkInvoiceStatus(activeInvoices[i].payment_hash);
                if (status.paid) {
                    activeInvoices[i].paid = true;
                    updateInvoicesList();
                    updateBalance();
                    
                    // Actualizar modal si está abierto
                    if (!invoiceModal.classList.contains('hidden') && 
                        currentInvoice?.payment_hash === activeInvoices[i].payment_hash) {
                        document.getElementById('modalStatus').textContent = 'PAGADA';
                    }
                }
            }
        }
    }, 2000);
}

// Event Listeners
createInvoicesBtn.addEventListener('click', async () => {
    const amount = parseInt(document.getElementById('amount').value);
    const memo = document.getElementById('memo').value;
    const count = parseInt(document.getElementById('invoiceCount').value);

    if (!amount || !memo || count < 1 || count > 50) {
        alert('Por favor complete todos los campos correctamente. Máximo 50 facturas.');
        return;
    }

    try {
        for (let i = 0; i < count; i++) {
            const invoice = await createInvoice(amount, memo);
            activeInvoices.push({
                ...invoice,
                memo: memo,
                amount: amount,
                invoiceNumber: invoiceCounter++,
                paid: false,
                note: ''
            });
        }
        updateInvoicesList();
    } catch (error) {
        console.error(error);
        alert('Error al crear las facturas');
    }
});

closeModalBtn.addEventListener('click', () => {
    invoiceModal.classList.add('hidden');
    currentInvoice = null;
});

copyQRBtn.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(currentInvoice.payment_request);
        copyQRBtn.textContent = '¡Copiado!';
        setTimeout(() => {
            copyQRBtn.textContent = 'Copiar Código QR';
        }, 2000);
    } catch (err) {
        alert('Error al copiar al portapapeles');
    }
});

saveNoteBtn.addEventListener('click', () => {
    if (currentInvoice) {
        const noteText = modalNote.value.trim();
        const invoice = activeInvoices.find(inv => inv.payment_hash === currentInvoice.payment_hash);
        if (invoice) {
            invoice.note = noteText;
            updateInvoicesList();
            alert('Nota guardada correctamente');
        }
    }
});

searchPending.addEventListener('input', updateInvoicesList);
searchPaid.addEventListener('input', updateInvoicesList);

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    updateBalance();
    startMonitoring();
});