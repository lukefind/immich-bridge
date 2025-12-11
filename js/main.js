const { createApp, ref, reactive, onMounted, h } = Vue;

const ImmichBridgeApp = {
    setup() {
        const loading = ref(true);
        const configured = ref(false);
        const error = ref(null);
        const successMessage = ref(null);

        const config = reactive({
            baseUrl: "",
            apiKey: ""
        });

        const albums = ref([]);
        const selectedAlbum = ref(null);
        const assets = ref([]);
        
        // Lightbox state
        const lightboxOpen = ref(false);
        const lightboxAsset = ref(null);
        const lightboxIndex = ref(0);

        const api = async (path, options = {}) => {
            // Add CSRF token for POST/DELETE requests
            const headers = options.headers || {};
            if ((options.method === 'POST' || options.method === 'DELETE') && typeof OC !== 'undefined') {
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
            successMessage.value = null;
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
                successMessage.value = "Configuration saved successfully!";
                await loadAlbums();
            } catch (err) {
                error.value = err.message;
            } finally {
                loading.value = false;
            }
        };

        const logout = async () => {
            if (!confirm('Are you sure you want to disconnect from Immich?')) {
                return;
            }
            loading.value = true;
            error.value = null;
            try {
                await api(`/config/delete`, { method: "POST" });
                configured.value = false;
                config.baseUrl = "";
                config.apiKey = "";
                albums.value = [];
                selectedAlbum.value = null;
                assets.value = [];
            } catch (err) {
                error.value = err.message;
            } finally {
                loading.value = false;
            }
        };

        const loadAlbums = async () => {
            try {
                albums.value = await api(`/albums`);
                error.value = null;
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

        const openLightbox = (asset, index) => {
            lightboxAsset.value = asset;
            lightboxIndex.value = index;
            lightboxOpen.value = true;
        };

        const closeLightbox = () => {
            lightboxOpen.value = false;
            lightboxAsset.value = null;
        };

        const nextImage = () => {
            if (lightboxIndex.value < assets.value.length - 1) {
                lightboxIndex.value++;
                lightboxAsset.value = assets.value[lightboxIndex.value];
            }
        };

        const prevImage = () => {
            if (lightboxIndex.value > 0) {
                lightboxIndex.value--;
                lightboxAsset.value = assets.value[lightboxIndex.value];
            }
        };

        const handleKeydown = (e) => {
            if (!lightboxOpen.value) return;
            if (e.key === 'Escape') closeLightbox();
            if (e.key === 'ArrowRight') nextImage();
            if (e.key === 'ArrowLeft') prevImage();
        };

        const openInNewTab = () => {
            if (lightboxAsset.value) {
                window.open(`/apps/immich_nc_app/api/assets/${lightboxAsset.value.id}/original`, '_blank');
            }
        };

        const refreshAlbums = async () => {
            error.value = null;
            await loadAlbums();
        };

        onMounted(async () => {
            await loadConfig();
            if (configured.value) {
                await loadAlbums();
            }
            // Add keyboard listener for lightbox
            document.addEventListener('keydown', handleKeydown);
        });

        return () => {
            const children = [];

            // Header with actions (only when configured)
            if (configured.value && !loading.value) {
                children.push(
                    h('div', { class: 'immich-header' }, [
                        h('div', { class: 'immich-header-title' }, [
                            h('span', { class: 'immich-logo' }, '📷'),
                            h('span', null, 'Immich Bridge')
                        ]),
                        h('div', { class: 'immich-header-actions' }, [
                            h('button', { 
                                class: 'immich-btn immich-btn-secondary',
                                onClick: refreshAlbums,
                                title: 'Refresh albums'
                            }, '↻ Refresh'),
                            h('button', { 
                                class: 'immich-btn immich-btn-danger',
                                onClick: logout,
                                title: 'Disconnect from Immich'
                            }, 'Disconnect')
                        ])
                    ])
                );
            }

            // Loading state
            if (loading.value) {
                children.push(h('div', { class: 'immich-loading' }, 'Loading...'));
            }

            // Error display
            if (error.value) {
                children.push(h('div', { class: 'immich-error' }, error.value));
            }

            // Success message
            if (successMessage.value) {
                children.push(h('div', { class: 'immich-success' }, successMessage.value));
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
                                placeholder: 'https://photos.example.com/api',
                                onInput: (e) => { config.baseUrl = e.target.value; }
                            })
                        ]),
                        h('p', { class: 'immich-hint' }, 'Include /api at the end of your Immich URL'),
                        h('label', null, [
                            'Immich API Key:',
                            h('input', {
                                type: 'password',
                                value: config.apiKey,
                                placeholder: 'Your Immich API key',
                                onInput: (e) => { config.apiKey = e.target.value; }
                            })
                        ]),
                        h('p', { class: 'immich-hint' }, 'Generate an API key in Immich: Account Settings → API Keys'),
                        h('button', { class: 'immich-btn immich-btn-primary', onClick: saveConfig }, 'Connect to Immich')
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
                    albums.value.length === 0 ? h('p', { class: 'immich-no-albums' }, 'No albums found. Create albums in Immich first.') : null
                ]);

                let assetsContent;
                if (!selectedAlbum.value) {
                    assetsContent = h('div', { class: 'immich-placeholder' }, [
                        h('p', null, 'Select an album to view photos')
                    ]);
                } else {
                    const assetItems = assets.value.map((asset, index) =>
                        h('div', {
                            key: asset.id,
                            class: 'immich-thumb',
                            onClick: () => openLightbox(asset, index)
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

            // Lightbox modal
            if (lightboxOpen.value && lightboxAsset.value) {
                children.push(
                    h('div', { 
                        class: 'immich-lightbox',
                        onClick: (e) => { if (e.target.classList.contains('immich-lightbox')) closeLightbox(); }
                    }, [
                        h('div', { class: 'immich-lightbox-content' }, [
                            h('img', {
                                src: `/apps/immich_nc_app/api/assets/${lightboxAsset.value.id}/original`,
                                alt: lightboxAsset.value.fileName
                            }),
                            h('div', { class: 'immich-lightbox-info' }, [
                                h('span', null, lightboxAsset.value.fileName),
                                h('span', null, `${lightboxIndex.value + 1} / ${assets.value.length}`)
                            ])
                        ]),
                        h('button', { 
                            class: 'immich-lightbox-close',
                            onClick: closeLightbox
                        }, '✕'),
                        h('button', { 
                            class: 'immich-lightbox-prev',
                            onClick: prevImage,
                            disabled: lightboxIndex.value === 0
                        }, '‹'),
                        h('button', { 
                            class: 'immich-lightbox-next',
                            onClick: nextImage,
                            disabled: lightboxIndex.value === assets.value.length - 1
                        }, '›'),
                        h('button', { 
                            class: 'immich-lightbox-newtab',
                            onClick: openInNewTab,
                            title: 'Open in new tab'
                        }, '↗')
                    ])
                );
            }

            return h('div', { class: 'immich-wrapper' }, children);
        };
    }
};

createApp(ImmichBridgeApp).mount("#immich-bridge-app");
