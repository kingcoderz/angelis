// Sistema POS - Cliente JavaScript
class POSSystem {
    constructor() {
        this.socket = null;
        this.orders = [];
        this.tables = [];
        this.currentSection = 'tables';
        this.orderItems = [];
        this.init();
    }

    init() {
        this.connectSocket();
        this.setupEventListeners();
        this.updateTime();
        this.showSection('tables');
        setInterval(() => this.updateTime(), 1000);
    }

    connectSocket() {
        // Conectar usando o protocolo e host atual
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        
        this.socket = io({
            transports: ['websocket', 'polling'],
            upgrade: true,
            rememberUpgrade: true
        });

        this.socket.on('connect', () => {
            console.log('Conectado ao servidor');
            this.updateConnectionStatus(true);
            this.showNotification('Conectado ao servidor', 'success');
        });

        this.socket.on('disconnect', () => {
            console.log('Desconectado do servidor');
            this.updateConnectionStatus(false);
            this.showNotification('Conexão perdida', 'error');
        });

        this.socket.on('connect_error', (error) => {
            console.error('Erro de conexão:', error);
            this.updateConnectionStatus(false);
            this.showNotification('Erro de conexão', 'error');
        });

        // Eventos do sistema
        this.socket.on('tables-update', (tables) => {
            this.tables = tables;
            this.renderTables();
            this.updateTableSelect();
        });

        this.socket.on('orders-update', (orders) => {
            this.orders = orders;
            this.renderOrders();
            this.updateFinancialSummary();
        });

        this.socket.on('new-order-notification', (order) => {
            this.showNotification(`Novo pedido da Mesa ${order.tableId}`, 'info');
            this.playNotificationSound();
        });

        this.socket.on('order-status-changed', (data) => {
            const statusText = this.getStatusText(data.status);
            this.showNotification(`Pedido #${data.orderId} ${statusText}`, 'info');
        });

        this.socket.on('print-notification', (order) => {
            this.showNotification(`Imprimindo pedido #${order.id}`, 'info');
            this.printOrder(order);
        });
    }

    updateConnectionStatus(connected) {
        const indicator = document.getElementById('connectionIndicator');
        const text = document.getElementById('connectionText');
        
        if (connected) {
            indicator.className = 'w-3 h-3 bg-green-500 rounded-full pulse-animation';
            text.textContent = 'Conectado';
            text.className = 'text-sm text-green-600 font-medium';
        } else {
            indicator.className = 'w-3 h-3 bg-red-500 rounded-full';
            text.textContent = 'Desconectado';
            text.className = 'text-sm text-red-600 font-medium';
        }
    }

    setupEventListeners() {
        // Formulário de pedido
        document.getElementById('orderForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitOrder();
        });

        // Navegação
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.nav-btn').forEach(b => {
                    b.classList.remove('border-white', 'bg-blue-700');
                });
                e.target.closest('button').classList.add('border-white', 'bg-blue-700');
            });
        });
    }

    showSection(sectionName) {
        // Esconder todas as seções
        document.querySelectorAll('.section').forEach(section => {
            section.classList.add('hidden');
        });

        // Mostrar seção selecionada
        document.getElementById(`${sectionName}-section`).classList.remove('hidden');
        this.currentSection = sectionName;

        // Atualizar dados da seção
        this.renderCurrentSection();
    }

    renderCurrentSection() {
        switch(this.currentSection) {
            case 'tables':
                this.renderTables();
                break;
            case 'waiter':
                this.renderWaiterOrders();
                break;
            case 'kitchen':
                this.renderKitchenOrders();
                break;
            case 'cashier':
                this.renderCashierOrders();
                break;
        }
    }

    renderTables() {
        const grid = document.getElementById('tablesGrid');
        if (!grid) return;

        grid.innerHTML = '';
        
        this.tables.forEach(table => {
            const tableElement = document.createElement('div');
            const isOccupied = table.status === 'occupied';
            
            tableElement.className = `
                ${isOccupied ? 'table-occupied' : 'table-available'}
                rounded-lg p-6 text-white text-center cursor-pointer
                transform transition-all duration-200 hover:scale-105
                fade-in
            `;
            
            tableElement.innerHTML = `
                <div class="text-2xl font-bold mb-2">
                    <i class="fas fa-table mb-2"></i>
                    <br>Mesa ${table.id}
                </div>
                <div class="text-sm opacity-90">
                    ${isOccupied ? 'Ocupada' : 'Disponível'}
                </div>
                ${isOccupied ? `
                    <div class="mt-3 space-y-1">
                        <button onclick="posSystem.viewTableOrder(${table.id})" 
                                class="w-full px-3 py-1 bg-white bg-opacity-20 rounded text-xs hover:bg-opacity-30 transition-colors">
                            Ver Pedido
                        </button>
                        <button onclick="posSystem.resetTable(${table.id})" 
                                class="w-full px-3 py-1 bg-white bg-opacity-20 rounded text-xs hover:bg-opacity-30 transition-colors">
                            Liberar Mesa
                        </button>
                    </div>
                ` : ''}
            `;
            
            if (!isOccupied) {
                tableElement.addEventListener('click', () => {
                    this.selectTable(table.id);
                });
            }
            
            grid.appendChild(tableElement);
        });
    }

    updateTableSelect() {
        const select = document.getElementById('tableSelect');
        if (!select) return;

        select.innerHTML = '<option value="">Selecione uma mesa</option>';
        
        this.tables.filter(table => table.status === 'available').forEach(table => {
            const option = document.createElement('option');
            option.value = table.id;
            option.textContent = `Mesa ${table.id}`;
            select.appendChild(option);
        });
    }

    selectTable(tableId) {
        this.showSection('waiter');
        document.getElementById('tableSelect').value = tableId;
    }

    addOrderItem() {
        const container = document.getElementById('orderItems');
        const newItem = document.createElement('div');
        newItem.className = 'flex space-x-2';
        newItem.innerHTML = `
            <input type="text" placeholder="Item" class="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
            <input type="number" placeholder="Qtd" class="w-20 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
            <input type="number" placeholder="Preço" step="0.01" class="w-24 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
            <button type="button" onclick="this.parentElement.remove(); posSystem.calculateTotal()" class="px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
                <i class="fas fa-trash"></i>
            </button>
        `;
        
        container.appendChild(newItem);
        
        // Adicionar listeners para cálculo automático
        newItem.querySelectorAll('input[type="number"]').forEach(input => {
            input.addEventListener('input', () => this.calculateTotal());
        });
    }

    calculateTotal() {
        let total = 0;
        const itemRows = document.querySelectorAll('#orderItems > div');
        
        itemRows.forEach(row => {
            const qty = parseFloat(row.children[1].value) || 0;
            const price = parseFloat(row.children[2].value) || 0;
            total += qty * price;
        });
        
        document.getElementById('orderTotal').textContent = total.toFixed(2);
    }

    submitOrder() {
        const tableId = parseInt(document.getElementById('tableSelect').value);
        if (!tableId) {
            this.showNotification('Selecione uma mesa', 'error');
            return;
        }

        const items = [];
        const itemRows = document.querySelectorAll('#orderItems > div');
        
        itemRows.forEach(row => {
            const name = row.children[0].value.trim();
            const qty = parseInt(row.children[1].value) || 0;
            const price = parseFloat(row.children[2].value) || 0;
            
            if (name && qty > 0 && price > 0) {
                items.push({ name, quantity: qty, price, total: qty * price });
            }
        });

        if (items.length === 0) {
            this.showNotification('Adicione pelo menos um item', 'error');
            return;
        }

        const total = items.reduce((sum, item) => sum + item.total, 0);
        
        const orderData = {
            tableId,
            items,
            total,
            waiter: 'Garçom Principal'
        };

        this.socket.emit('new-order', orderData);
        
        // Limpar formulário
        document.getElementById('orderForm').reset();
        document.getElementById('orderItems').innerHTML = `
            <div class="flex space-x-2">
                <input type="text" placeholder="Item" class="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                <input type="number" placeholder="Qtd" class="w-20 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                <input type="number" placeholder="Preço" step="0.01" class="w-24 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                <button type="button" onclick="addOrderItem()" class="px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors">
                    <i class="fas fa-plus"></i>
                </button>
            </div>
        `;
        document.getElementById('orderTotal').textContent = '0.00';
        
        this.showNotification('Pedido enviado com sucesso!', 'success');
    }

    renderOrders() {
        this.renderWaiterOrders();
        this.renderKitchenOrders();
        this.renderCashierOrders();
    }

    renderWaiterOrders() {
        const container = document.getElementById('waiterOrders');
        if (!container) return;

        const activeOrders = this.orders.filter(order => order.status !== 'delivered');
        
        if (activeOrders.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-4">Nenhum pedido ativo</p>';
            return;
        }

        container.innerHTML = activeOrders.map(order => `
            <div class="order-card bg-white p-4 rounded-lg shadow-sm status-${order.status}">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <h4 class="font-semibold">Pedido #${order.id}</h4>
                        <p class="text-sm text-gray-600">Mesa ${order.tableId}</p>
                    </div>
                    <div class="text-right">
                        <span class="status-badge status-${order.status}">${this.getStatusText(order.status)}</span>
                        <p class="text-sm font-semibold text-green-600">R$ ${order.total.toFixed(2)}</p>
                    </div>
                </div>
                <div class="text-xs text-gray-500">
                    ${new Date(order.timestamp).toLocaleString('pt-BR')}
                </div>
            </div>
        `).join('');
    }

    renderKitchenOrders() {
        const pendingContainer = document.getElementById('pendingOrders');
        const preparingContainer = document.getElementById('preparingOrders');
        const readyContainer = document.getElementById('readyOrders');

        if (!pendingContainer || !preparingContainer || !readyContainer) return;

        const pendingOrders = this.orders.filter(order => order.status === 'pending');
        const preparingOrders = this.orders.filter(order => order.status === 'preparing');
        const readyOrders = this.orders.filter(order => order.status === 'ready');

        this.renderKitchenOrderGroup(pendingContainer, pendingOrders, 'pending');
        this.renderKitchenOrderGroup(preparingContainer, preparingOrders, 'preparing');
        this.renderKitchenOrderGroup(readyContainer, readyOrders, 'ready');
    }

    renderKitchenOrderGroup(container, orders, status) {
        if (orders.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-4 text-sm">Nenhum pedido</p>';
            return;
        }

        container.innerHTML = orders.map(order => `
            <div class="bg-white p-4 rounded-lg shadow-sm border-l-4 border-${this.getStatusColor(status)}-500">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <h4 class="font-semibold text-sm">Pedido #${order.id}</h4>
                        <p class="text-xs text-gray-600">Mesa ${order.tableId}</p>
                    </div>
                    <div class="text-xs text-gray-500">
                        ${this.getTimeAgo(order.timestamp)}
                    </div>
                </div>
                <div class="space-y-1 mb-3">
                    ${order.items.map(item => `
                        <div class="text-xs flex justify-between">
                            <span>${item.quantity}x ${item.name}</span>
                            <span>R$ ${item.total.toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="flex space-x-2">
                    ${this.getKitchenButtons(order, status)}
                </div>
            </div>
        `).join('');
    }

    getKitchenButtons(order, status) {
        switch(status) {
            case 'pending':
                return `<button onclick="posSystem.updateOrderStatus(${order.id}, 'preparing')" 
                               class="flex-1 px-3 py-2 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors">
                            <i class="fas fa-play mr-1"></i>Iniciar
                        </button>`;
            case 'preparing':
                return `<button onclick="posSystem.updateOrderStatus(${order.id}, 'ready')" 
                               class="flex-1 px-3 py-2 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition-colors">
                            <i class="fas fa-check mr-1"></i>Finalizar
                        </button>`;
            case 'ready':
                return `<button onclick="posSystem.updateOrderStatus(${order.id}, 'delivered')" 
                               class="flex-1 px-3 py-2 bg-gray-500 text-white text-xs rounded hover:bg-gray-600 transition-colors">
                            <i class="fas fa-truck mr-1"></i>Entregar
                        </button>
                        <button onclick="posSystem.printOrder(${order.id})" 
                               class="px-3 py-2 bg-purple-500 text-white text-xs rounded hover:bg-purple-600 transition-colors">
                            <i class="fas fa-print"></i>
                        </button>`;
            default:
                return '';
        }
    }

    renderCashierOrders() {
        const container = document.getElementById('cashierOrders');
        if (!container) return;

        const readyOrders = this.orders.filter(order => order.status === 'ready');
        
        if (readyOrders.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-4">Nenhum pedido pronto para pagamento</p>';
            return;
        }

        container.innerHTML = readyOrders.map(order => `
            <div class="bg-white p-4 rounded-lg shadow-sm border-l-4 border-green-500">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <h4 class="font-semibold">Pedido #${order.id}</h4>
                        <p class="text-sm text-gray-600">Mesa ${order.tableId}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-lg font-bold text-green-600">R$ ${order.total.toFixed(2)}</p>
                    </div>
                </div>
                <div class="space-y-1 mb-3">
                    ${order.items.map(item => `
                        <div class="text-sm flex justify-between">
                            <span>${item.quantity}x ${item.name}</span>
                            <span>R$ ${item.total.toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="flex space-x-2">
                    <button onclick="posSystem.processPayment(${order.id})" 
                            class="flex-1 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors">
                        <i class="fas fa-credit-card mr-2"></i>Processar Pagamento
                    </button>
                    <button onclick="posSystem.printOrder(${order.id})" 
                            class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">
                        <i class="fas fa-print"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    updateOrderStatus(orderId, status) {
        this.socket.emit('update-order-status', { orderId, status });
    }

    processPayment(orderId) {
        this.updateOrderStatus(orderId, 'delivered');
        this.showNotification('Pagamento processado com sucesso!', 'success');
    }

    printOrder(orderId) {
        const order = this.orders.find(o => o.id === orderId);
        if (!order) return;

        this.socket.emit('print-order', orderId);
        
        // Simular impressão
        const printContent = `
            RESTAURANTE DIGITAL
            ==================
            
            Pedido #${order.id}
            Mesa: ${order.tableId}
            Data: ${new Date(order.timestamp).toLocaleString('pt-BR')}
            Garçom: ${order.waiter}
            
            ITENS:
            ${order.items.map(item => 
                `${item.quantity}x ${item.name.padEnd(20)} R$ ${item.total.toFixed(2)}`
            ).join('\n')}
            
            ==================
            TOTAL: R$ ${order.total.toFixed(2)}
            ==================
        `;
        
        console.log('Imprimindo:', printContent);
    }

    resetTable(tableId) {
        if (confirm(`Deseja realmente liberar a Mesa ${tableId}?`)) {
            this.socket.emit('reset-table', tableId);
            this.showNotification(`Mesa ${tableId} liberada`, 'success');
        }
    }

    viewTableOrder(tableId) {
        const table = this.tables.find(t => t.id === tableId);
        if (!table || !table.currentOrder) return;

        const order = this.orders.find(o => o.id === table.currentOrder);
        if (!order) return;

        this.showOrderModal(order);
    }

    showOrderModal(order) {
        const modal = document.getElementById('orderModal');
        const content = document.getElementById('orderModalContent');
        
        content.innerHTML = `
            <div class="space-y-4">
                <div class="flex justify-between items-center">
                    <h4 class="font-semibold">Pedido #${order.id}</h4>
                    <span class="status-badge status-${order.status}">${this.getStatusText(order.status)}</span>
                </div>
                <div class="text-sm text-gray-600">
                    <p>Mesa: ${order.tableId}</p>
                    <p>Garçom: ${order.waiter}</p>
                    <p>Data: ${new Date(order.timestamp).toLocaleString('pt-BR')}</p>
                </div>
                <div class="border-t pt-4">
                    <h5 class="font-medium mb-2">Itens:</h5>
                    <div class="space-y-2">
                        ${order.items.map(item => `
                            <div class="flex justify-between text-sm">
                                <span>${item.quantity}x ${item.name}</span>
                                <span>R$ ${item.total.toFixed(2)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="border-t pt-4 flex justify-between items-center">
                    <span class="font-semibold">Total:</span>
                    <span class="font-bold text-lg text-green-600">R$ ${order.total.toFixed(2)}</span>
                </div>
            </div>
        `;
        
        modal.classList.remove('hidden');
    }

    closeOrderModal() {
        document.getElementById('orderModal').classList.add('hidden');
    }

    updateFinancialSummary() {
        const totalOrdersEl = document.getElementById('totalOrders');
        const totalRevenueEl = document.getElementById('totalRevenue');
        const deliveredOrdersEl = document.getElementById('deliveredOrders');

        if (!totalOrdersEl || !totalRevenueEl || !deliveredOrdersEl) return;

        const deliveredOrders = this.orders.filter(order => order.status === 'delivered');
        const totalRevenue = deliveredOrders.reduce((sum, order) => sum + order.total, 0);

        totalOrdersEl.textContent = this.orders.length;
        totalRevenueEl.textContent = `R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
        deliveredOrdersEl.textContent = deliveredOrders.length;
    }

    showNotification(message, type = 'info') {
        const container = document.getElementById('notifications');
        const notification = document.createElement('div');
        
        const colors = {
            success: 'bg-green-500',
            error: 'bg-red-500',
            info: 'bg-blue-500',
            warning: 'bg-yellow-500'
        };
        
        notification.className = `notification ${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-3`;
        notification.innerHTML = `
            <i class="fas fa-${this.getNotificationIcon(type)}"></i>
            <span>${message}</span>
            <button onclick="this.parentElement.remove()" class="ml-4 text-white hover:text-gray-200">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        container.appendChild(notification);
        
        // Auto remove após 5 segundos
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    getNotificationIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            info: 'info-circle',
            warning: 'exclamation-triangle'
        };
        return icons[type] || 'info-circle';
    }

    playNotificationSound() {
        // Criar um som de notificação simples
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    }

    getStatusText(status) {
        const statusMap = {
            pending: 'Pendente',
            preparing: 'Preparando',
            ready: 'Pronto',
            delivered: 'Entregue'
        };
        return statusMap[status] || status;
    }

    getStatusColor(status) {
        const colorMap = {
            pending: 'yellow',
            preparing: 'blue',
            ready: 'green',
            delivered: 'gray'
        };
        return colorMap[status] || 'gray';
    }

    getTimeAgo(timestamp) {
        const now = new Date();
        const time = new Date(timestamp);
        const diffInMinutes = Math.floor((now - time) / (1000 * 60));
        
        if (diffInMinutes < 1) return 'Agora';
        if (diffInMinutes < 60) return `${diffInMinutes}min`;
        
        const diffInHours = Math.floor(diffInMinutes / 60);
        return `${diffInHours}h ${diffInMinutes % 60}min`;
    }

    updateTime() {
        const timeElement = document.getElementById('currentTime');
        if (timeElement) {
            timeElement.textContent = new Date().toLocaleString('pt-BR');
        }
    }
}

// Funções globais para compatibilidade
function showSection(section) {
    posSystem.showSection(section);
}

function addOrderItem() {
    posSystem.addOrderItem();
}

function closeOrderModal() {
    posSystem.closeOrderModal();
}

// Inicializar sistema
const posSystem = new POSSystem();

// Adicionar estilos CSS dinâmicos
const style = document.createElement('style');
style.textContent = `
    .status-badge {
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 0.75rem;
        font-weight: 500;
        text-transform: uppercase;
    }
    .status-pending { background-color: #fbbf24; color: #92400e; }
    .status-preparing { background-color: #60a5fa; color: #1e40af; }
    .status-ready { background-color: #34d399; color: #065f46; }
    .status-delivered { background-color: #9ca3af; color: #374151; }
`;
document.head.appendChild(style);