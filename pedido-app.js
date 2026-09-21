(function () {
    var products = {
        'x-burguer': { name: 'Combo X-Burguer', description: 'X-Burguer + Coca-Cola 250ml', price: 50 },
        macarronada: { name: 'Macarronada do dia', description: 'Molho caseiro e queijo ralado', price: 50 },
        guarana: { name: 'Guaraná 250ml', description: 'Bebida gelada', price: 50 },
        suco: { name: 'Suco natural', description: '300ml', price: 40 },
        salada: { name: 'Salada de frutas', description: 'Frutas da estação', price: 30 }
    };

    function formatCredits(value) {
        return value.toLocaleString('pt-BR') + ' créditos';
    }

    function toggleDetails() {
        document.querySelectorAll('.details-toggle').forEach(function (button) {
            button.addEventListener('click', function () {
                var details = button.closest('.order-card').querySelector('.order-details');
                var expanded = button.getAttribute('aria-expanded') === 'true';
                button.setAttribute('aria-expanded', String(!expanded));
                button.textContent = expanded ? 'Ver detalhes' : 'Ocultar detalhes';
                details.hidden = expanded;
            });
        });
    }

    function createOrderCard(order) {
        var article = document.createElement('article');
        var itemCount = order.items.reduce(function (total, item) { return total + item.quantity; }, 0);
        var summary = order.items.map(function (item) { return item.quantity + 'x ' + item.name; }).join(' + ');
        var statusClass = { 'Recebido': 'status-received', 'Em preparação': 'status-preparing', 'Pronto para retirada': 'status-ready', 'Finalizado': 'status-finished' }[order.status] || 'status-received';
        var detailItems = order.items.map(function (item) { return '<li>' + item.quantity + 'x ' + item.name + ' — ' + formatCredits(item.price * item.quantity) + '</li>'; }).join('');
        article.className = 'order-card';
        article.innerHTML = '<div class="order-card-header"><div><span class="order-number">Pedido #' + order.id + '</span><span class="order-date">' + order.date + '</span></div><span class="status-chip ' + statusClass + '">' + order.status + '</span></div>' +
            '<div class="order-card-body"><div class="order-items"><strong>' + itemCount + ' ' + (itemCount === 1 ? 'item' : 'itens') + '</strong><span>' + summary + '</span></div><div class="order-total"><small>Total</small><strong>' + formatCredits(order.total) + '</strong></div></div>' +
            '<div class="order-card-footer"><span class="pickup-note">Retire no balcão da cantina</span><button class="details-toggle" type="button" aria-expanded="false">Ver detalhes</button></div>' +
            '<div class="order-details" hidden><ul>' + detailItems + '<li>Pagamento: créditos UDESC</li></ul></div>';
        return article;
    }

    function initOrdersPage() {
        var lastOrder;
        try { lastOrder = JSON.parse(localStorage.getItem('alimenta-campus-last-order')); } catch (error) { lastOrder = null; }

        if (new URLSearchParams(window.location.search).has('confirmado')) {
            document.getElementById('confirmation-notice').hidden = false;
        }

        if (lastOrder) {
            document.getElementById('order-list').prepend(createOrderCard(lastOrder));
        }
        toggleDetails();
    }

    function initNewOrderPage() {
        var quantities = {};
        var cartItems = document.getElementById('cart-items');
        var cartEmpty = document.getElementById('cart-empty');
        var cartCount = document.getElementById('cart-count');
        var subtotal = document.getElementById('cart-subtotal');
        var total = document.getElementById('cart-total');
        var confirm = document.getElementById('confirm-order');
        var message = document.getElementById('cart-message');

        function totalItems() {
            return Object.keys(quantities).reduce(function (sum, id) { return sum + quantities[id]; }, 0);
        }

        function render() {
            var count = totalItems();
            var value = Object.keys(quantities).reduce(function (sum, id) { return sum + products[id].price * quantities[id]; }, 0);
            cartItems.innerHTML = '';
            cartEmpty.hidden = count > 0;
            cartCount.textContent = count + ' ' + (count === 1 ? 'item' : 'itens');
            subtotal.textContent = formatCredits(value);
            total.textContent = formatCredits(value);
            confirm.disabled = count === 0;

            Object.keys(quantities).forEach(function (id) {
                var product = products[id];
                var item = document.createElement('div');
                item.className = 'cart-item';
                item.innerHTML = '<div><span class="cart-item-name">' + product.name + '</span><span class="cart-item-price">' + formatCredits(product.price) + ' cada</span></div><div class="quantity-control"><button class="quantity-button" type="button" data-minus="' + id + '" aria-label="Remover uma unidade de ' + product.name + '">−</button><span class="quantity-value">' + quantities[id] + '</span><button class="quantity-button" type="button" data-plus="' + id + '" aria-label="Adicionar uma unidade de ' + product.name + '">+</button></div>';
                cartItems.appendChild(item);
            });

            document.querySelectorAll('[data-product-id]').forEach(function (card) {
                var id = card.getAttribute('data-product-id');
                var button = card.querySelector('[data-add]');
                if (button) button.textContent = quantities[id] ? 'Adicionar mais' : 'Adicionar';
            });
        }

        function change(id, amount) {
            quantities[id] = (quantities[id] || 0) + amount;
            if (quantities[id] <= 0) delete quantities[id];
            message.textContent = '';
            render();
        }

        document.querySelectorAll('[data-add]').forEach(function (button) {
            button.addEventListener('click', function () { change(button.getAttribute('data-add'), 1); });
        });

        cartItems.addEventListener('click', function (event) {
            var button = event.target.closest('[data-minus], [data-plus]');
            if (!button) return;
            change(button.getAttribute('data-minus') || button.getAttribute('data-plus'), button.hasAttribute('data-minus') ? -1 : 1);
        });

        confirm.addEventListener('click', function () {
            var items = Object.keys(quantities).map(function (id) { return { name: products[id].name, price: products[id].price, quantity: quantities[id] }; });
            var order = {
                id: 'AC-' + String(Date.now()).slice(-4),
                date: 'Hoje, ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                status: 'Recebido',
                items: items,
                total: items.reduce(function (sum, item) { return sum + item.price * item.quantity; }, 0)
            };
            localStorage.setItem('alimenta-campus-last-order', JSON.stringify(order));
            window.location.href = 'pedidos.html?confirmado=1';
        });

        render();
    }

    if (document.body.dataset.page === 'pedidos') initOrdersPage();
    if (document.body.dataset.page === 'novo-pedido') initNewOrderPage();
})();
