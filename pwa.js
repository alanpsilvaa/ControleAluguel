(() => {
    if (!('serviceWorker' in navigator)) return;

    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .catch(error => console.error('Não foi possível ativar o modo de aplicativo:', error));
    });

    let installPrompt = null;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true;

    if (isStandalone) return;

    const installButton = document.createElement('button');
    installButton.type = 'button';
    installButton.textContent = 'Instalar aplicativo';
    installButton.setAttribute('aria-label', 'Instalar Controle de Aluguéis no celular');
    Object.assign(installButton.style, {
        position: 'fixed',
        right: '16px',
        bottom: '16px',
        zIndex: '40',
        display: 'none',
        border: '0',
        borderRadius: '12px',
        padding: '12px 16px',
        background: '#4f46e5',
        color: '#fff',
        font: '600 14px Inter, sans-serif',
        boxShadow: '0 8px 20px rgb(15 23 42 / 22%)',
        cursor: 'pointer'
    });

    installButton.addEventListener('click', async () => {
        if (isIos && !installPrompt) {
            window.alert('Para instalar no iPhone ou iPad: toque em Compartilhar no Safari e escolha "Adicionar à Tela de Início".');
            return;
        }
        if (!installPrompt) return;

        installPrompt.prompt();
        await installPrompt.userChoice;
        installPrompt = null;
        installButton.style.display = 'none';
    });

    window.addEventListener('beforeinstallprompt', event => {
        event.preventDefault();
        installPrompt = event;
        installButton.style.display = 'block';
    });

    window.addEventListener('appinstalled', () => {
        installPrompt = null;
        installButton.style.display = 'none';
    });

    if (isIos) installButton.style.display = 'block';
    document.body.appendChild(installButton);
})();
