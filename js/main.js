const { createApp, ref, reactive, onMounted, h } = Vue;

const ImmichBridgeApp = {
    setup() {
        const loading = ref(true);
        const configured = ref(false);
        const error = ref(null);

        const config = reactive({
            baseUrl: "",
            apiKey: ""
        });

        const albums = ref([]);
        const selectedAlbum = ref(null);
        const assets = ref([]);

        const api = async (path, options = {}) => {
            // Add CSRF token for POST requests
            const headers = options.headers || {};
            if (options.method === 'POST' && typeof OC !== 'undefined') {
                headers['requesttoken'] = OC.requestToken;
            }
            
            const res = await fetch(`/apps/immich_nc_app/api${path}`, {
                credentials: "same-origin",
                ...options,
                headers
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || `API error: ${res.status}`);
            }

            const ct = res.headers.get("content-type") || "";
            if (ct.includes("application/json")) {
                return res.json();
            }
            return res.blob();
        };

        const loadConfig = async () => {
            try {
                const data = await api(`/config`);
                config.baseUrl = data.baseUrl || "";
                configured.value = data.configured;
            } catch (err) {
                error.value = err.message;
            } finally {
                loading.value = false;
            }
        };

        const saveConfig = async () => {
            loading.value = true;
            error.value = null;
            try {
                await api(`/config`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        baseUrl: config.baseUrl,
                        apiKey: config.apiKey
                    })
                });
                configured.value = true;
                await loadAlbums();
            } catch (err) {
                error.value = err.message;
            } finally {
                loading.value = false;
            }
        };

        const loadAlbums = async () => {
            try {
                albums.value = await api(`/albums`);
            } catch (err) {
                error.value = err.message;
            }
        };

        const selectAlbum = async (album) => {
            selectedAlbum.value = album;
            error.value = null;
            try {
                assets.value = await api(`/albums/${album.id}/assets`);
            } catch (err) {
                error.value = err.message;
            }
        };

        const openOriginal = (assetId) => {
            window.open(`/apps/immich_nc_app/api/assets/${assetId}/original`, '_blank');
        };

        onMounted(async () => {
            await loadConfig();
            if (configured.value) {
                await loadAlbums();
            }
        });

        return () => {
            const children = [];

            // Loading state
            if (loading.value) {
                children.push(h('div', { class: 'immich-loading' }, 'Loading...'));
            }

            // Error display
            if (error.value) {
                children.push(h('div', { class: 'immich-error' }, error.value));
            }

            // Setup form
            if (!loading.value && !configured.value) {
                children.push(
                    h('div', { class: 'immich-setup' }, [
                        h('h2', null, 'Immich Bridge Setup'),
                        h('p', { class: 'immich-setup-desc' }, 'Connect your Immich instance to browse your photo library.'),
                        h('label', null, [
                            'Immich Base URL:',
                            h('input', {
                                value: config.baseUrl,
                                placeholder: 'https://immich.example.com/api',
                                onInput: (e) => { config.baseUrl = e.target.value; }
                            })
                        ]),
                        h('label', null, [
                            'Immich API Key:',
                            h('input', {
                                type: 'password',
                                value: config.apiKey,
                                placeholder: 'Your Immich API key',
                                onInput: (e) => { config.apiKey = e.target.value; }
                            })
                        ]),
                        h('button', { onClick: saveConfig }, 'Save Configuration')
                    ])
                );
            }

            // Browser view
            if (configured.value && !loading.value) {
                const albumItems = albums.value.map(album =>
                    h('li', {
                        key: album.id,
                        class: { active: selectedAlbum.value && selectedAlbum.value.id === album.id },
                        onClick: () => selectAlbum(album)
                    }, `${album.title} (${album.assetCount})`)
                );

                const sidebar = h('div', { class: 'immich-sidebar' }, [
                    h('h3', null, 'Albums'),
                    h('ul', null, albumItems),
                    albums.value.length === 0 ? h('p', { class: 'immich-no-albums' }, 'No albums found.') : null
                ]);

                let assetsContent;
                if (!selectedAlbum.value) {
                    assetsContent = h('div', { class: 'immich-placeholder' }, [
                        h('p', null, 'Select an album to view photos')
                    ]);
                } else {
                    const assetItems = assets.value.map(asset =>
                        h('div', {
                            key: asset.id,
                            class: 'immich-thumb',
                            onClick: () => openOriginal(asset.id)
                        }, [
                            h('img', {
                                src: `/apps/immich_nc_app/api/assets/${asset.id}/thumbnail`,
                                alt: asset.fileName,
                                loading: 'lazy'
                            })
                        ])
                    );

                    assetsContent = h('div', null, [
                        h('h3', null, selectedAlbum.value.title),
                        h('div', { class: 'immich-grid' }, assetItems),
                        assets.value.length === 0 ? h('p', { class: 'immich-no-assets' }, 'No photos in this album.') : null
                    ]);
                }

                const assetsPanel = h('div', { class: 'immich-assets' }, [assetsContent]);

                children.push(h('div', { class: 'immich-browser' }, [sidebar, assetsPanel]));
            }

            return h('div', { class: 'immich-wrapper' }, children);
        };
    }
};

createApp(ImmichBridgeApp).mount("#immich-bridge-app");
