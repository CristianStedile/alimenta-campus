(function () {
    var nav = document.querySelector('.nav');
    if (!nav) return;

    var link = nav.querySelector('a[href="pedidos.html"]');
    if (!link) {
        link = document.createElement('a');
        link.className = 'nav-link';
        link.href = 'pedidos.html';
        link.innerHTML = '<img src="img/icon-garfoefaca.png" alt="">Pedidos';
    }

    var links = Array.from(nav.querySelectorAll('.nav-link'));
    var find = function (label) {
        return links.find(function (item) { return item.textContent.trim() === label; });
    };
    var inicio = find('Início');
    var recarregar = find('Recarregar');
    var cardapio = find('Cardápio');
    var ajuda = find('Ajuda');
    var cardapioIcon = cardapio && cardapio.querySelector('img');
    if (cardapioIcon) cardapioIcon.src = 'img/icon-cardapio.png';

    [inicio, recarregar, link, cardapio, ajuda].forEach(function (item) {
        if (item) nav.appendChild(item);
    });
})();
