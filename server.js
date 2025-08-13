const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname)));
app.use(express.json());

// Dados em memória
let orders = [];
let tables = Array.from({length: 12}, (_, i) => ({
  id: i + 1,
  status: 'available', // available, occupied, reserved
  currentOrder: null
}));

// Rota principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// WebSocket connections
io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);

  // Enviar dados iniciais
  socket.emit('tables-update', tables);
  socket.emit('orders-update', orders);

  // Novo pedido do garçom
  socket.on('new-order', (orderData) => {
    const order = {
      id: Date.now(),
      tableId: orderData.tableId,
      items: orderData.items,
      total: orderData.total,
      status: 'pending', // pending, preparing, ready, delivered
      timestamp: new Date(),
      waiter: orderData.waiter || 'Garçom'
    };

    orders.push(order);
    
    // Atualizar status da mesa
    const table = tables.find(t => t.id === orderData.tableId);
    if (table) {
      table.status = 'occupied';
      table.currentOrder = order.id;
    }

    // Notificar todos os clientes
    io.emit('orders-update', orders);
    io.emit('tables-update', tables);
    io.emit('new-order-notification', order);
    
    console.log('Novo pedido criado:', order.id);
  });

  // Atualizar status do pedido
  socket.on('update-order-status', (data) => {
    const order = orders.find(o => o.id === data.orderId);
    if (order) {
      order.status = data.status;
      
      // Se o pedido foi entregue, liberar a mesa
      if (data.status === 'delivered') {
        const table = tables.find(t => t.currentOrder === order.id);
        if (table) {
          table.status = 'available';
          table.currentOrder = null;
        }
      }
      
      io.emit('orders-update', orders);
      io.emit('tables-update', tables);
      io.emit('order-status-changed', { orderId: data.orderId, status: data.status });
    }
  });

  // Imprimir pedido
  socket.on('print-order', (orderId) => {
    const order = orders.find(o => o.id === orderId);
    if (order) {
      console.log('Imprimindo pedido:', orderId);
      io.emit('print-notification', order);
    }
  });

  // Resetar mesa
  socket.on('reset-table', (tableId) => {
    const table = tables.find(t => t.id === tableId);
    if (table) {
      // Remover pedidos da mesa
      orders = orders.filter(o => o.tableId !== tableId);
      
      table.status = 'available';
      table.currentOrder = null;
      
      io.emit('orders-update', orders);
      io.emit('tables-update', tables);
    }
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse: http://localhost:${PORT}`);
});