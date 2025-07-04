// Configuração da API
const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:3000/api' 
  : 'https://vendas-mercearia.onrender.com/api';

// Estado da aplicação
let produtos = [];
let clientes = [];
let vendas = [];
let itensVenda = [];
let editandoProduto = null;
let editandoCliente = null;

// Elementos DOM
const elements = {
    navTabs: document.querySelectorAll('.nav-tab'),
    tabContents: document.querySelectorAll('.tab-content'),
    statusIndicator: document.getElementById('statusIndicator'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    tipoVenda: document.getElementById('tipoVenda'),
    dataPagamento: document.getElementById('dataPagamento'),
    dataPagamentoGroup: document.getElementById('dataPagamentoGroup'),
    formaPagamento: document.getElementById('formaPagamento'),
    clienteVenda: document.getElementById('clienteVenda'),
    produtoSelect: document.getElementById('produtoSelect'),
    quantidadeProduto: document.getElementById('quantidadeProduto'),
    adicionarProduto: document.getElementById('adicionarProduto'),
    itensVenda: document.getElementById('itensVenda'),
    totalVenda: document.getElementById('totalVenda'),
    observacoesVenda: document.getElementById('observacoesVenda'),
    finalizarVenda: document.getElementById('finalizarVenda'),
    limparVenda: document.getElementById('limparVenda'),
    vendasLista: document.getElementById('vendasLista'),
    novoProdutoBtn: document.getElementById('novoProdutoBtn'),
    produtosLista: document.getElementById('produtosLista'),
    modalProduto: document.getElementById('modalProduto'),
    formProduto: document.getElementById('formProduto'),
    novoClienteBtn: document.getElementById('novoClienteBtn'),
    clientesLista: document.getElementById('clientesLista'),
    modalCliente: document.getElementById('modalCliente'),
    formCliente: document.getElementById('formCliente'),
    relatorioDia: document.getElementById('relatorioDia'),
    vendasPendentes: document.getElementById('vendasPendentes'),
    toastContainer: document.getElementById('toastContainer')
};

// Inicializar aplicação
document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    setupPWA();
    await carregarDadosIniciais();
    showToast('Sistema carregado com sucesso!', 'success');
});

// Configurar event listeners
function setupEventListeners() {
    // Navigation
    if (elements.navTabs) {
        elements.navTabs.forEach(tab => {
            tab.addEventListener('click', () => switchTab(tab.dataset.tab));
        });
    }
    
    // Vendas
    if (elements.adicionarProduto) {
        elements.adicionarProduto.addEventListener('click', adicionarProdutoVenda);
    }
    if (elements.finalizarVenda) {
        elements.finalizarVenda.addEventListener('click', finalizarVenda);
    }
    if (elements.limparVenda) {
        elements.limparVenda.addEventListener('click', limparVenda);
    }
    if (elements.tipoVenda) {
        elements.tipoVenda.addEventListener('change', function() {
            atualizarPrecos();
            toggleDataPagamento();
        });
    }
    if (elements.dataPagamento) {
        elements.dataPagamento.addEventListener('change', function() {
            atualizarPrecos();
        });
    }
    
    // Produtos
    if (elements.novoProdutoBtn) {
        elements.novoProdutoBtn.addEventListener('click', () => abrirModalProduto());
    }
    if (elements.formProduto) {
        elements.formProduto.addEventListener('submit', salvarProduto);
    }
    
    // Clientes
    if (elements.novoClienteBtn) {
        elements.novoClienteBtn.addEventListener('click', () => abrirModalCliente());
    }
    if (elements.formCliente) {
        elements.formCliente.addEventListener('submit', salvarCliente);
    }
    
    // Modals
    document.querySelectorAll('.close, [data-modal]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (e.target.dataset.modal) {
                fecharModal(e.target.dataset.modal);
            } else {
                const modal = e.target.closest('.modal');
                if (modal) {
                    fecharModal(modal.id);
                }
            }
        });
    });
    
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                fecharModal(modal.id);
            }
        });
    });
    
    // Enter para adicionar produto
    if (elements.quantidadeProduto) {
        elements.quantidadeProduto.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                adicionarProdutoVenda();
            }
        });
    }
    
    // Verificar conexão
    setInterval(verificarConexao, 30000);
}

// Setup PWA
function setupPWA() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js')
            .then(() => console.log('Service Worker registrado'))
            .catch(err => console.log('Erro no Service Worker:', err));
    }
    
    let deferredPrompt;
    const installBtn = document.getElementById('installBtn');
    
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        installBtn.style.display = 'block';
    });
    
    installBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const result = await deferredPrompt.userChoice;
            if (result.outcome === 'accepted') {
                showToast('App instalado com sucesso!', 'success');
            }
            deferredPrompt = null;
            installBtn.style.display = 'none';
        }
    });
}

// API Functions
async function apiRequest(endpoint, options = {}) {
    try {
        showLoading(true);
        const fullUrl = `${API_BASE_URL}${endpoint}`;
        console.log('Fazendo requisição para:', fullUrl);
        
        const config = {
            headers: { 'Content-Type': 'application/json' },
            ...options
        };
        
        const response = await fetch(fullUrl, config);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || `Erro ${response.status}: ${response.statusText}`);
        }
        
        updateConnectionStatus(true);
        return data;
    } catch (error) {
        console.error('Erro na API:', error);
        updateConnectionStatus(false);
        showToast(error.message, 'error');
        throw error;
    } finally {
        showLoading(false);
    }
}

// Carregar dados iniciais
async function carregarDadosIniciais() {
    try {
        await Promise.all([
            carregarProdutos(),
            carregarClientes(),
            carregarVendas(),
            carregarRelatorioDia(),
            carregarVendasPendentes()
        ]);
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
    }
}

// Produtos
async function carregarProdutos() {
    try {
        const response = await apiRequest('/produtos');
        produtos = response.produtos || [];
        renderizarProdutos();
        atualizarSelectProdutos();
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
    }
}

function renderizarProdutos() {
    const container = elements.produtosLista;
    
    if (produtos.length === 0) {
        container.innerHTML = '<div class="loading">Nenhum produto cadastrado</div>';
        return;
    }
    
    container.innerHTML = produtos.map(produto => `
        <div class="produto-card">
            <div class="produto-nome">${produto.nome}</div>
            <div class="produto-precos">
                <div class="preco-item">
                    <div class="preco-label">Normal</div>
                    <div class="preco-valor">R$ ${produto.preco_normal.toFixed(2)}</div>
                </div>
                <div class="preco-item">
                    <div class="preco-label">Nota</div>
                    <div class="preco-valor">R$ ${produto.preco_nota.toFixed(2)}</div>
                </div>
            </div>
            <div class="card-actions">
                <button class="btn btn-primary btn-sm" onclick="editarProduto(${produto.id})">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button class="btn btn-danger btn-sm" onclick="excluirProduto(${produto.id})">
                    <i class="fas fa-trash"></i> Excluir
                </button>
            </div>
        </div>
    `).join('');
}

function atualizarSelectProdutos() {
    const select = elements.produtoSelect;
    select.innerHTML = '<option value="">Selecione um produto...</option>' +
        produtos.map(produto => 
            `<option value="${produto.id}">${produto.nome} - R$ ${produto.preco_normal.toFixed(2)}</option>`
        ).join('');
}

function abrirModalProduto(produto = null) {
    editandoProduto = produto;
    const titulo = document.getElementById('modalProdutoTitulo');
    const form = elements.formProduto;
    
    titulo.textContent = produto ? 'Editar Produto' : 'Novo Produto';
    
    if (produto) {
        document.getElementById('nomeProduto').value = produto.nome;
        document.getElementById('precoNormal').value = produto.preco_normal;
        document.getElementById('precoNota').value = produto.preco_nota;
    } else {
        form.reset();
    }
    
    abrirModal('modalProduto');
}

async function salvarProduto(e) {
    e.preventDefault();
    
    const dados = {
        nome: document.getElementById('nomeProduto').value,
        preco_normal: parseFloat(document.getElementById('precoNormal').value),
        preco_nota: parseFloat(document.getElementById('precoNota').value)
    };
    
    try {
        if (editandoProduto) {
            await apiRequest(`/produtos/${editandoProduto.id}`, {
                method: 'PUT',
                body: JSON.stringify(dados)
            });
            showToast('Produto atualizado com sucesso!', 'success');
        } else {
            await apiRequest('/produtos', {
                method: 'POST',
                body: JSON.stringify(dados)
            });
            showToast('Produto cadastrado com sucesso!', 'success');
        }
        
        fecharModal('modalProduto');
        await carregarProdutos();
    } catch (error) {
        console.error('Erro ao salvar produto:', error);
    }
}

async function editarProduto(id) {
    const produto = produtos.find(p => p.id === id);
    if (produto) {
        abrirModalProduto(produto);
    }
}

async function excluirProduto(id) {
    if (confirm('Tem certeza que deseja excluir este produto?')) {
        try {
            await apiRequest(`/produtos/${id}`, { method: 'DELETE' });
            showToast('Produto excluído com sucesso!', 'success');
            await carregarProdutos();
        } catch (error) {
            console.error('Erro ao excluir produto:', error);
        }
    }
}

// Clientes
async function carregarClientes() {
    try {
        const response = await apiRequest('/clientes');
        clientes = response.clientes || [];
        renderizarClientes();
        atualizarSelectClientes();
    } catch (error) {
        console.error('Erro ao carregar clientes:', error);
    }
}

function renderizarClientes() {
    const container = elements.clientesLista;
    
    if (clientes.length === 0) {
        container.innerHTML = '<div class="loading">Nenhum cliente cadastrado</div>';
        return;
    }
    
    container.innerHTML = clientes.map(cliente => `
        <div class="cliente-card">
            <div class="cliente-nome">${cliente.nome}</div>
            <div class="cliente-info">
                ${cliente.telefone ? `<div><i class="fas fa-phone"></i> ${cliente.telefone}</div>` : ''}
            </div>
            <div class="card-actions">
                <button class="btn btn-primary btn-sm" onclick="editarCliente(${cliente.id})">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button class="btn btn-danger btn-sm" onclick="excluirCliente(${cliente.id})">
                    <i class="fas fa-trash"></i> Excluir
                </button>
            </div>
        </div>
    `).join('');
}

function atualizarSelectClientes() {
    const select = elements.clienteVenda;
    select.innerHTML = '<option value="">Selecione um cliente...</option>' +
        clientes.map(cliente => 
            `<option value="${cliente.id}">${cliente.nome}</option>`
        ).join('');
}

function abrirModalCliente(cliente = null) {
    editandoCliente = cliente;
    const titulo = document.getElementById('modalClienteTitulo');
    const form = elements.formCliente;
    
    titulo.textContent = cliente ? 'Editar Cliente' : 'Novo Cliente';
    
    if (cliente) {
        document.getElementById('nomeCliente').value = cliente.nome;
        document.getElementById('telefoneCliente').value = cliente.telefone || '';
    } else {
        form.reset();
    }
    
    abrirModal('modalCliente');
}

async function salvarCliente(e) {
    e.preventDefault();
    
    const dados = {
        nome: document.getElementById('nomeCliente').value,
        telefone: document.getElementById('telefoneCliente').value || null
    };
    
    try {
        if (editandoCliente) {
            await apiRequest(`/clientes/${editandoCliente.id}`, {
                method: 'PUT',
                body: JSON.stringify(dados)
            });
            showToast('Cliente atualizado com sucesso!', 'success');
        } else {
            await apiRequest('/clientes', {
                method: 'POST',
                body: JSON.stringify(dados)
            });
            showToast('Cliente cadastrado com sucesso!', 'success');
        }
        
        fecharModal('modalCliente');
        await carregarClientes();
    } catch (error) {
        console.error('Erro ao salvar cliente:', error);
    }
}

async function editarCliente(id) {
    const cliente = clientes.find(c => c.id === id);
    if (cliente) {
        abrirModalCliente(cliente);
    }
}

async function excluirCliente(id) {
    if (confirm('Tem certeza que deseja excluir este cliente?')) {
        try {
            await apiRequest(`/clientes/${id}`, { method: 'DELETE' });
            showToast('Cliente excluído com sucesso!', 'success');
            await carregarClientes();
        } catch (error) {
            console.error('Erro ao excluir cliente:', error);
        }
    }
}

// Vendas
async function carregarVendas() {
    try {
        const response = await apiRequest('/vendas');
        vendas = response.vendas || [];
        renderizarVendasRecentes();
    } catch (error) {
        console.error('Erro ao carregar vendas:', error);
    }
}

function renderizarVendasRecentes() {
    const container = elements.vendasLista;
    const vendasRecentes = vendas.slice(0, 10);
    
    if (vendasRecentes.length === 0) {
        container.innerHTML = '<div class="loading">Nenhuma venda realizada hoje</div>';
        return;
    }
    
    container.innerHTML = vendasRecentes.map(venda => `
        <div class="venda-item">
            <div class="venda-info">
                <div>
                    <span class="venda-tipo ${venda.tipo_venda}">${venda.tipo_venda}</span>
                    <span class="venda-pagamento">${formatarFormaPagamento(venda.forma_pagamento)}</span>
                </div>
                <div class="venda-cliente">${venda.cliente_nome || 'Cliente não informado'}</div>
                <div class="venda-itens">${venda.itens || 'Sem itens'}</div>
                <div class="venda-data">${formatarData(venda.created_at)}</div>
            </div>
            <div class="venda-valor">R$ ${venda.valor_total.toFixed(2)}</div>
        </div>
    `).join('');
}

function toggleDataPagamento() {
    if (!elements.tipoVenda || !elements.dataPagamentoGroup || !elements.dataPagamento) return;
    
    const tipoVenda = elements.tipoVenda.value;
    const dataPagamentoGroup = elements.dataPagamentoGroup;
    
    if (tipoVenda === 'nota') {
        dataPagamentoGroup.style.display = 'block';
    } else {
        dataPagamentoGroup.style.display = 'none';
        elements.dataPagamento.value = '';
    }
}

function calcularPrecoVenda(produto, tipoVenda, dataPagamento) {
    if (tipoVenda === 'normal') {
        return produto.preco_normal;
    }
    
    if (tipoVenda === 'nota') {
        if (!dataPagamento) {
            return produto.preco_normal;
        }
        
        const hoje = new Date();
        const dataPageto = new Date(dataPagamento);
        const diffTime = dataPageto - hoje;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 10) {
            return produto.preco_normal;
        } else {
            return produto.preco_nota;
        }
    }
    
    return produto.preco_normal;
}

function adicionarProdutoVenda() {
    const produtoId = parseInt(elements.produtoSelect.value);
    const quantidade = parseInt(elements.quantidadeProduto.value);
    
    if (!produtoId || !quantidade || quantidade <= 0) {
        showToast('Selecione um produto e quantidade válida', 'warning');
        return;
    }
    
    const produto = produtos.find(p => p.id === produtoId);
    if (!produto) {
        showToast('Produto não encontrado', 'error');
        return;
    }
    
    const itemExistente = itensVenda.find(item => item.produto_id === produtoId);
    if (itemExistente) {
        itemExistente.quantidade += quantidade;
    } else {
        itensVenda.push({
            produto_id: produtoId,
            produto_nome: produto.nome,
            quantidade: quantidade,
            preco_normal: produto.preco_normal,
            preco_nota: produto.preco_nota
        });
    }
    
    renderizarItensVenda();
    atualizarTotal();
    
    elements.produtoSelect.value = '';
    elements.quantidadeProduto.value = '';
}

function renderizarItensVenda() {
    if (!elements.itensVenda) return;
    
    const container = elements.itensVenda;
    
    if (itensVenda.length === 0) {
        container.innerHTML = '<div class="loading">Nenhum produto adicionado</div>';
        return;
    }
    
    container.innerHTML = itensVenda.map((item, index) => {
        const tipoVenda = elements.tipoVenda ? elements.tipoVenda.value : 'normal';
        const dataPagamento = elements.dataPagamento ? elements.dataPagamento.value : '';
        
        const preco = calcularPrecoVenda(item, tipoVenda, dataPagamento);
        const subtotal = preco * item.quantidade;
        
        let precoInfo = '';
        if (tipoVenda === 'nota') {
            if (!dataPagamento) {
                precoInfo = '(Preço Normal - sem data)';
            } else {
                const hoje = new Date();
                const dataPageto = new Date(dataPagamento);
                const diffDays = Math.ceil((dataPageto - hoje) / (1000 * 60 * 60 * 24));
                
                if (diffDays <= 10) {
                    precoInfo = `(Preço Normal - ${diffDays} dias)`;
                } else {
                    precoInfo = `(Preço Nota - ${diffDays} dias)`;
                }
            }
        } else {
            precoInfo = '(Preço Normal)';
        }
        
        return `
            <div class="item-venda">
                <div class="item-info">
                    <div class="item-nome">${item.produto_nome}</div>
                    <div class="item-detalhes">
                        ${item.quantidade}x R$ ${preco.toFixed(2)} ${precoInfo}
                    </div>
                </div>
                <div class="item-valor">R$ ${subtotal.toFixed(2)}</div>
                <button class="btn-remove" onclick="removerItemVenda(${index})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    }).join('');
}

function removerItemVenda(index) {
    itensVenda.splice(index, 1);
    renderizarItensVenda();
    atualizarTotal();
}

function atualizarPrecos() {
    renderizarItensVenda();
    atualizarTotal();
}

function atualizarTotal() {
    if (!elements.totalVenda || !elements.tipoVenda) return;
    
    const tipoVenda = elements.tipoVenda.value;
    const dataPagamento = elements.dataPagamento ? elements.dataPagamento.value : '';
    
    const total = itensVenda.reduce((sum, item) => {
        const preco = calcularPrecoVenda(item, tipoVenda, dataPagamento);
        return sum + (preco * item.quantidade);
    }, 0);
    
    elements.totalVenda.textContent = `R$ ${total.toFixed(2)}`;
}

async function finalizarVenda() {
    if (itensVenda.length === 0) {
        showToast('Adicione pelo menos um produto à venda', 'warning');
        return;
    }
    
    const dadosVenda = {
        cliente_id: parseInt(elements.clienteVenda.value) || null,
        tipo_venda: elements.tipoVenda.value,
        forma_pagamento: elements.formaPagamento.value,
        data_pagamento: elements.dataPagamento.value || null,
        itens: itensVenda.map(item => ({
            produto_id: item.produto_id,
            quantidade: item.quantidade
        })),
        observacoes: elements.observacoesVenda.value || null
    };
    
    try {
        await apiRequest('/vendas', {
            method: 'POST',
            body: JSON.stringify(dadosVenda)
        });
        
        showToast('Venda registrada com sucesso!', 'success');
        
        if (dadosVenda.tipo_venda === 'nota') {
            showToast('Mensagem WhatsApp enviada para o administrador!', 'info');
        }
        
        limparVenda();
        await carregarVendas();
        await carregarRelatorioDia();
        await carregarVendasPendentes();
    } catch (error) {
        console.error('Erro ao finalizar venda:', error);
    }
}

function limparVenda() {
    itensVenda = [];
    elements.tipoVenda.value = 'normal';
    elements.formaPagamento.value = 'dinheiro';
    elements.clienteVenda.value = '';
    elements.dataPagamento.value = '';
    elements.observacoesVenda.value = '';
    toggleDataPagamento();
    renderizarItensVenda();
    atualizarTotal();
}

// Relatórios
async function carregarRelatorioDia() {
    try {
        const response = await apiRequest('/relatorios/diario');
        renderizarRelatorioDia(response.relatorio);
    } catch (error) {
        console.error('Erro ao carregar relatório:', error);
        elements.relatorioDia.innerHTML = '<div class="loading">Erro ao carregar relatório</div>';
    }
}

function renderizarRelatorioDia(relatorio) {
    elements.relatorioDia.innerHTML = `
        <div class="relatorio-grid">
            <div class="relatorio-item">
                <div class="relatorio-valor">R$ ${relatorio.total_dinheiro.toFixed(2)}</div>
                <div class="relatorio-label">Dinheiro</div>
            </div>
            <div class="relatorio-item">
                <div class="relatorio-valor">R$ ${relatorio.total_cartao.toFixed(2)}</div>
                <div class="relatorio-label">Cartão</div>
            </div>
            <div class="relatorio-item">
                <div class="relatorio-valor">R$ ${relatorio.total_pix.toFixed(2)}</div>
                <div class="relatorio-label">PIX</div>
            </div>
            <div class="relatorio-item">
                <div class="relatorio-valor">R$ ${relatorio.total_geral.toFixed(2)}</div>
                <div class="relatorio-label">Total Geral</div>
            </div>
            <div class="relatorio-item">
                <div class="relatorio-valor">${relatorio.vendas_normais}</div>
                <div class="relatorio-label">Vendas Normais</div>
            </div>
            <div class="relatorio-item">
                <div class="relatorio-valor">${relatorio.vendas_nota}</div>
                <div class="relatorio-label">Vendas na Nota</div>
            </div>
        </div>
    `;
}

async function carregarVendasPendentes() {
    try {
        const response = await apiRequest('/relatorios/vendas-pendentes');
        renderizarVendasPendentes(response);
    } catch (error) {
        console.error('Erro ao carregar vendas pendentes:', error);
        elements.vendasPendentes.innerHTML = '<div class="loading">Erro ao carregar vendas pendentes</div>';
    }
}

function renderizarVendasPendentes(data) {
    if (data.vendas.length === 0) {
        elements.vendasPendentes.innerHTML = '<div class="loading">Nenhuma venda pendente</div>';
        return;
    }
    
    elements.vendasPendentes.innerHTML = `
        <div class="relatorio-resumo">
            <div class="relatorio-item">
                <div class="relatorio-valor">R$ ${data.total_pendente.toFixed(2)}</div>
                <div class="relatorio-label">Total Pendente</div>
            </div>
            <div class="relatorio-item">
                <div class="relatorio-valor">${data.quantidade_vendas}</div>
                <div class="relatorio-label">Vendas Pendentes</div>
            </div>
        </div>
        <div class="vendas-lista">
            ${data.vendas.map(venda => `
                <div class="venda-item">
                    <div class="venda-info">
                        <div class="venda-cliente">${venda.cliente_nome || 'Cliente não informado'}</div>
                        <div class="venda-itens">${venda.itens}</div>
                        <div class="venda-data">${formatarData(venda.created_at)} (${Math.floor(venda.dias_pendente)} dias)</div>
                    </div>
                    <div class="venda-valor">R$ ${venda.valor_total.toFixed(2)}</div>
                </div>
            `).join('')}
        </div>
    `;
}

// Utility Functions
function switchTab(tabName) {
    elements.navTabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    elements.tabContents.forEach(content => {
        content.classList.toggle('active', content.id === tabName);
    });
    
    if (tabName === 'relatorios') {
        carregarRelatorioDia();
        carregarVendasPendentes();
    }
}

function abrirModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function fecharModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('active');
    document.body.style.overflow = '';
    
    const form = modal.querySelector('form');
    if (form) {
        form.reset();
    }
    
    editandoProduto = null;
    editandoCliente = null;
}

function showLoading(show) {
    elements.loadingOverlay.classList.toggle('active', show);
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
            <i class="fas fa-${getToastIcon(type)}"></i>
            <span>${message}</span>
        </div>
    `;
    
    elements.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

function getToastIcon(type) {
    const icons = {
        success: 'check-circle',
        error: 'exclamation-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };
    return icons[type] || 'info-circle';
}

function formatarFormaPagamento(forma) {
    const formas = {
        dinheiro: 'Dinheiro',
        cartao: 'Cartão',
        pix: 'PIX'
    };
    return formas[forma] || forma;
}

function formatarData(dataString) {
    const data = new Date(dataString);
    return data.toLocaleString('pt-BR');
}

function updateConnectionStatus(online) {
    const indicator = elements.statusIndicator;
    if (online) {
        indicator.innerHTML = '<i class="fas fa-circle"></i> Online';
        indicator.className = 'status-indicator online';
    } else {
        indicator.innerHTML = '<i class="fas fa-circle"></i> Offline';
        indicator.className = 'status-indicator offline';
    }
}

async function verificarConexao() {
    try {
        await fetch(`${API_BASE_URL}/`, { method: 'HEAD' });
        updateConnectionStatus(true);
    } catch {
        updateConnectionStatus(false);
    }
}

// Service Worker para cache offline
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
            .then(registration => {
                console.log('SW registrado: ', registration);
            })
            .catch(registrationError => {
                console.log('SW falhou: ', registrationError);
            });
    });
}
