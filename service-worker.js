// Service Worker para Sistema de Vendas
const CACHE_NAME = 'vendas-mercearia-v1.0.0';
const API_CACHE_NAME = 'vendas-api-v1.0.0';

// Arquivos para cache imediato (App Shell)
const STATIC_CACHE_URLS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  // Font Awesome
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2'
];

// URLs da API para cache
const API_URLS = [
  '/api/produtos',
  '/api/clientes',
  '/api/vendas',
  '/api/relatorios/diario',
  '/api/relatorios/vendas-pendentes'
];

// Instalar Service Worker
self.addEventListener('install', event => {
  console.log('Service Worker: Instalando...');

  event.waitUntil(
    Promise.all([
      // Cache dos arquivos estáticos
      caches.open(CACHE_NAME).then(cache => {
        console.log('Service Worker: Fazendo cache dos arquivos estáticos');
        return cache.addAll(STATIC_CACHE_URLS);
      }),

      // Cache inicial da API
      caches.open(API_CACHE_NAME).then(cache => {
        console.log('Service Worker: Fazendo cache inicial da API');
        // Cache inicial pode falhar se API não estiver disponível
        return Promise.allSettled(
          API_URLS.map(url =>
            fetch(`http://localhost:3000${url}`)
              .then(response => (response.ok ? cache.put(url, response) : null))
              .catch(() => null)
          )
        );
      })
    ]).then(() => {
      console.log('Service Worker: Instalação completa');
      return self.skipWaiting();
    })
  );
});

// Ativar Service Worker
self.addEventListener('activate', event => {
  console.log('Service Worker: Ativando...');

  event.waitUntil(
    Promise.all([
      // Limpar caches antigos
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
              console.log('Service Worker: Removendo cache antigo:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),

      // Tomar controle de todas as abas
      self.clients.claim()
    ]).then(() => {
      console.log('Service Worker: Ativado e assumiu controle');
    })
  );
});

// Interceptar requisições
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  // Estratégias diferentes para diferentes tipos de requisição
  if (requestUrl.pathname.startsWith('/api/')) {
    // Requisições da API: Network First com cache fallback
    event.respondWith(handleApiRequest(event.request));
  } else if (STATIC_CACHE_URLS.includes(requestUrl.pathname) || requestUrl.pathname === '/') {
    // Arquivos estáticos: Cache First
    event.respondWith(handleStaticRequest(event.request));
  } else if (requestUrl.origin === 'https://cdnjs.cloudflare.com') {
    // CDN externos: Cache First com Network Fallback
    event.respondWith(handleCdnRequest(event.request));
  } else {
    // Outras requisições: Network First
    event.respondWith(handleNetworkFirst(event.request));
  }
});

// Estratégia Network First para API (dados sempre atualizados quando online)
async function handleApiRequest(request) {
  const cache = await caches.open(API_CACHE_NAME);

  try {
    // Tentar buscar da rede primeiro
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      // Se sucesso, atualizar cache e retornar resposta da rede
      cache.put(request, networkResponse.clone());
      return networkResponse;
    } else {
      throw new Error('Network response not ok');
    }
  } catch (error) {
    // Se falhar, tentar buscar do cache
    console.log('Service Worker: Rede falhou, buscando do cache:', request.url);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    // Se não há cache, retornar resposta de erro offline
    return new Response(
      JSON.stringify({
        error: 'Sem conexão com internet',
        message: 'Esta funcionalidade requer conexão com internet',
        offline: true
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}

// Estratégia Cache First para arquivos estáticos
async function handleStaticRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  // Se não estiver em cache, buscar da rede
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // Se for o index.html e falhar, retornar versão offline básica
    if (request.url.endsWith('/') || request.url.includes('index.html')) {
      return new Response(getOfflinePage(), {
        headers: {
          'Content-Type': 'text/html'
        }
      });
    }

    throw error;
  }
}

// Estratégia Cache First para CDNs
async function handleCdnRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // Para CDNs, se falhar completamente, não há muito o que fazer
    return new Response('', { status: 404 });
  }
}

// Estratégia Network First genérica
async function handleNetworkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    return cachedResponse || new Response('', { status: 404 });
  }
}

// Página offline básica
function getOfflinePage() {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Sistema de Vendas - Offline</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #2563eb, #1d4ed8);
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                text-align: center;
                padding: 2rem;
            }
            .offline-container {
                background: rgba(255, 255, 255, 0.1);
                padding: 3rem;
                border-radius: 16px;
                backdrop-filter: blur(10px);
                max-width: 500px;
            }
            .offline-icon {
                font-size: 4rem;
                margin-bottom: 1rem;
            }
            .offline-title {
                font-size: 2rem;
                margin-bottom: 1rem;
                font-weight: 700;
            }
            .offline-message {
                font-size: 1.125rem;
                margin-bottom: 2rem;
                opacity: 0.9;
                line-height: 1.6;
            }
            .retry-btn {
                background: rgba(255, 255, 255, 0.2);
                border: 1px solid rgba(255, 255, 255, 0.3);
                color: white;
                padding: 1rem 2rem;
                border-radius: 8px;
                cursor: pointer;
                font-size: 1rem;
                font-weight: 600;
                transition: all 0.2s ease;
            }
            .retry-btn:hover {
                background: rgba(255, 255, 255, 0.3);
                transform: translateY(-2px);
            }
            .features {
                margin-top: 2rem;
                opacity: 0.8;
                font-size: 0.875rem;
            }
        </style>
    </head>
    <body>
        <div class="offline-container">
            <div class="offline-icon">📶❌</div>
            <h1 class="offline-title">Você está offline</h1>
            <p class="offline-message">
                O Sistema de Vendas requer conexão com internet para funcionar completamente.
                Verifique sua conexão e tente novamente.
            </p>
            <button class="retry-btn" onclick="window.location.reload()">
                🔄 Tentar Novamente
            </button>
            <div class="features">
                <p>✓ App instalado e pronto para uso</p>
                <p>✓ Cache offline configurado</p>
                <p>✓ Dados serão sincronizados quando conectar</p>
            </div>
        </div>
        
        <script>
            // Verificar conexão a cada 30 segundos
            setInterval(() => {
                if (navigator.onLine) {
                    window.location.reload();
                }
            }, 30000);
            
            // Listener para mudança de status de conexão
            window.addEventListener('online', () => {
                window.location.reload();
            });
        </script>
    </body>
    </html>
  `;
}

// Sincronização em background (quando conectar novamente)
self.addEventListener('sync', event => {
  console.log('Service Worker: Evento de sincronização:', event.tag);

  if (event.tag === 'background-sync') {
    event.waitUntil(syncData());
  }
});

// Função para sincronizar dados quando voltar online
async function syncData() {
  console.log('Service Worker: Sincronizando dados...');

  try {
    // Revalidar cache da API
    const cache = await caches.open(API_CACHE_NAME);

    for (const url of API_URLS) {
      try {
        const response = await fetch(`http://localhost:3000${url}`);
        if (response.ok) {
          await cache.put(url, response);
          console.log('Service Worker: Cache atualizado para:', url);
        }
      } catch (error) {
        console.log('Service Worker: Falha ao sincronizar:', url);
      }
    }

    // Notificar clientes sobre a sincronização
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        message: 'Dados sincronizados com sucesso!'
      });
    });
  } catch (error) {
    console.error('Service Worker: Erro na sincronização:', error);
  }
}

// Listener para mensagens dos clientes
self.addEventListener('message', event => {
  console.log('Service Worker: Mensagem recebida:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({
      version: CACHE_NAME
    });
  }
});

// Atualizar cache quando necessário
self.addEventListener('notificationclick', event => {
  event.notification.close();

  // Abrir ou focar na aba da aplicação
  event.waitUntil(
    clients.matchAll().then(clientList => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow('/');
    })
  );
});

console.log('Service Worker: Carregado e pronto!');
