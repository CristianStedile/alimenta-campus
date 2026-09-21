(function () {
    var nav = document.querySelector('.nav');
    if (!nav || nav.querySelector('a[href="pedidos.html"]')) return;

    var link = document.createElement('a');
    link.className = 'nav-link';
    link.href = 'pedidos.html';
    link.innerHTML = '<img src="img/icon-garfoefaca.png" alt="">Pedidos';
    nav.insertBefore(link, nav.lastElementChild);
})();
