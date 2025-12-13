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

        const activeView = ref('albums');
        const albumSearch = ref('');
        const albumSort = ref('name');

        const isMobile = ref(false);
        const sidebarOpen = ref(false);
        
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

        const toast = (msg) => {
            if (typeof OC !== 'undefined' && OC.Notification && typeof OC.Notification.showTemporary === 'function') {
                OC.Notification.showTemporary(msg);
            }
        };

        const toastError = (msg) => {
            toast(msg);
        };

        const loadConfig = async () => {
            try {
                const data = await api(`/config`);
                config.baseUrl = data.baseUrl || "";
                configured.value = data.configured;
                if (!data.configured) {
                    activeView.value = 'settings';
                }
            } catch (err) {
                error.value = err.message;
                toastError(err.message);
            } finally {
                loading.value = false;
            }
        };

        const saveConfig = async () => {
            loading.value = true;
            error.value = null;
            try {
                const payload = {
                    baseUrl: config.baseUrl,
                };

                if (config.apiKey && config.apiKey.trim().length > 0) {
                    payload.apiKey = config.apiKey;
                }

                await api(`/config`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                configured.value = true;
                toast('Configuration saved');
                config.apiKey = "";
                activeView.value = 'albums';
                await loadAlbums();
            } catch (err) {
                error.value = err.message;
                toastError(err.message);
            } finally {
                loading.value = false;
            }
        };

        const logout = async () => {
            const confirmFn = (typeof OC !== 'undefined' && OC.dialogs && typeof OC.dialogs.confirm === 'function')
                ? (msg) => new Promise((resolve) => OC.dialogs.confirm(msg, 'Immich Bridge', (result) => resolve(result)))
                : async (msg) => confirm(msg);

            const confirmed = await confirmFn('Are you sure you want to disconnect from Immich?');
            if (!confirmed) return;

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
                activeView.value = 'settings';
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
                toastError(err.message);
            }
        };

        const selectAlbum = async (album) => {
            selectedAlbum.value = album;
            error.value = null;
            try {
                assets.value = await api(`/albums/${album.id}/assets`);
            } catch (err) {
                error.value = err.message;
                toastError(err.message);
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
            if (e.key === 'Escape') {
                if (lightboxOpen.value) {
                    closeLightbox();
                    return;
                }
                if (sidebarOpen.value) {
                    sidebarOpen.value = false;
                }
                return;
            }

            if (!lightboxOpen.value) return;
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
            toast('Albums refreshed');
        };

        const showSettings = () => {
            activeView.value = 'settings';
            if (isMobile.value) {
                sidebarOpen.value = false;
            }
        };

        const showAlbums = () => {
            activeView.value = 'albums';
            if (isMobile.value) {
                sidebarOpen.value = false;
            }
        };

        const toggleSidebar = () => {
            sidebarOpen.value = !sidebarOpen.value;
        };

        const closeSidebar = () => {
            sidebarOpen.value = false;
        };

        onMounted(async () => {
            const updateIsMobile = () => {
                isMobile.value = window.matchMedia('(max-width: 768px)').matches;
                if (!isMobile.value) {
                    sidebarOpen.value = false;
                }
            };
            updateIsMobile();
            window.addEventListener('resize', updateIsMobile);

            await loadConfig();
            if (configured.value) {
                await loadAlbums();
            }
            // Add keyboard listener for lightbox
            document.addEventListener('keydown', handleKeydown);
        });

        return () => {
            const children = [];

            // Loading state
            if (loading.value) {
                children.push(h('div', { class: 'immich-loading' }, 'Loading...'));
            }

            // Main app shell
            if (!loading.value) {
                let sidebarContent = [];
                let mainContent = [];

                if (isMobile.value && sidebarOpen.value) {
                    children.push(h('div', {
                        class: 'immich-drawer-backdrop',
                        onClick: closeSidebar
                    }));
                }

                const nav = h('div', { class: 'immich-nav' }, [
                    h('div', { class: 'immich-nav-list' }, [
                        h('div', {
                            class: ['immich-nav-link', activeView.value === 'albums' ? 'active' : null, !configured.value ? 'disabled' : null],
                            onClick: configured.value ? showAlbums : null
                        }, 'Albums'),
                        h('div', {
                            class: ['immich-nav-link', activeView.value === 'settings' ? 'active' : null],
                            onClick: showSettings
                        }, 'Settings'),
                        h('div', { class: 'immich-nav-sep' }),
                        h('div', { class: ['immich-nav-link', 'disabled'] }, 'Favorites'),
                        h('div', { class: ['immich-nav-link', 'disabled'] }, 'Recents'),
                        h('div', { class: ['immich-nav-link', 'disabled'] }, 'People'),
                    ])
                ]);

                const sidebarHeader = h('div', { class: 'immich-sidebar-header' }, [
                    h('div', { class: 'immich-sidebar-title' }, 'Immich Bridge'),
                    isMobile.value ? h('button', { class: 'immich-sidebar-close', onClick: closeSidebar, title: 'Close menu' }, '✕') : null
                ]);

                sidebarContent.push(sidebarHeader);
                sidebarContent.push(nav);

                if (activeView.value === 'albums' && configured.value) {
                    const q = albumSearch.value.trim().toLowerCase();
                    const filteredAlbums = q.length === 0
                        ? albums.value
                        : albums.value.filter(a => (a.title || '').toLowerCase().includes(q));

                    const sortedAlbums = [...filteredAlbums].sort((a, b) => {
                        if (albumSort.value === 'count') {
                            return (b.assetCount || 0) - (a.assetCount || 0);
                        }
                        if (albumSort.value === 'date') {
                            const ad = new Date(a.updatedAt || a.createdAt || 0).getTime();
                            const bd = new Date(b.updatedAt || b.createdAt || 0).getTime();
                            return bd - ad;
                        }
                        return String(a.title || '').localeCompare(String(b.title || ''));
                    });

                    const albumItems = sortedAlbums.map(album =>
                        h('li', {
                            key: album.id,
                            class: { active: selectedAlbum.value && selectedAlbum.value.id === album.id },
                            onClick: () => {
                                selectAlbum(album);
                                if (isMobile.value) {
                                    sidebarOpen.value = false;
                                }
                            }
                        }, `${album.title} (${album.assetCount})`)
                    );

                    sidebarContent.push(
                        h('div', { class: 'immich-sidebar-section' }, [
                            h('div', { class: 'immich-sidebar-row' }, [
                                h('h3', null, 'Albums'),
                                h('button', { class: 'immich-icon-btn', onClick: refreshAlbums, title: 'Refresh albums' }, '↻')
                            ]),
                            h('input', {
                                class: 'immich-search',
                                value: albumSearch.value,
                                placeholder: 'Search albums…',
                                onInput: (e) => { albumSearch.value = e.target.value; }
                            }),
                            h('select', {
                                class: 'immich-select',
                                value: albumSort.value,
                                onChange: (e) => { albumSort.value = e.target.value; }
                            }, [
                                h('option', { value: 'name' }, 'Sort: Name'),
                                h('option', { value: 'date' }, 'Sort: Date'),
                                h('option', { value: 'count' }, 'Sort: Count'),
                            ]),
                            h('ul', null, albumItems),
                            sortedAlbums.length === 0 ? h('p', { class: 'immich-no-albums' }, 'No matching albums.') : null
                        ])
                    );

                    if (!selectedAlbum.value) {
                        mainContent = [
                            h('div', { class: 'immich-placeholder' }, [
                                h('p', null, 'Select an album to view photos')
                            ])
                        ];
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

                        mainContent = [
                            h('div', { class: 'immich-main-header' }, [
                                h('h3', null, selectedAlbum.value.title)
                            ]),
                            h('div', { class: 'immich-grid' }, assetItems),
                            assets.value.length === 0 ? h('p', { class: 'immich-no-assets' }, 'No photos in this album.') : null
                        ];
                    }
                }

                if (activeView.value === 'settings') {
                    const settingsTitle = configured.value ? 'Settings' : 'Connect Immich';

                    mainContent = [
                        h('div', { class: 'immich-settings' }, [
                            h('h2', null, settingsTitle),
                            h('p', { class: 'immich-setup-desc' }, 'Configure your Immich connection.'),
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
                                    placeholder: configured.value ? 'Leave blank to keep existing key' : 'Your Immich API key',
                                    onInput: (e) => { config.apiKey = e.target.value; }
                                })
                            ]),
                            h('p', { class: 'immich-hint' }, 'Generate an API key in Immich: Account Settings → API Keys'),
                            h('div', { class: 'immich-settings-actions' }, [
                                h('button', { class: 'immich-btn immich-btn-primary immich-btn-wide', onClick: saveConfig }, configured.value ? 'Save' : 'Connect'),
                                configured.value ? h('button', { class: 'immich-btn immich-btn-danger immich-btn-wide', onClick: logout }, 'Disconnect') : null,
                            ])
                        ])
                    ];
                }

                const sidebar = h('div', {
                    class: ['immich-sidebar', isMobile.value ? 'immich-drawer' : null, (isMobile.value && sidebarOpen.value) ? 'open' : null]
                }, sidebarContent);

                const mobileMenuButton = isMobile.value ? h('button', {
                    class: 'immich-hamburger',
                    onClick: toggleSidebar,
                    title: 'Menu'
                }, '☰') : null;

                const main = h('div', { class: 'immich-assets' }, [mobileMenuButton, ...mainContent]);
                children.push(h('div', { class: 'immich-browser' }, [sidebar, main]));
            }

            // Lightbox modal
            if (lightboxOpen.value && lightboxAsset.value) {
                const base = `/apps/immich_nc_app/api/assets/${lightboxAsset.value.id}`;
                const previewSrc = `${base}/thumbnail?key=preview`;
                const thumbSrc = `${base}/thumbnail`;
                const originalSrc = `${base}/original`;
                const candidates = [previewSrc, thumbSrc, originalSrc];

                children.push(
                    h('div', { 
                        class: 'immich-lightbox',
                        onClick: (e) => { if (e.target.classList.contains('immich-lightbox')) closeLightbox(); }
                    }, [
                        h('div', { class: 'immich-lightbox-content' }, [
                            h('img', {
                                key: lightboxAsset.value.id,
                                src: previewSrc,
                                alt: lightboxAsset.value.fileName,
                                'data-fallback-index': '0',
                                onError: (e) => {
                                    const img = e.target;
                                    const idx = parseInt(img.dataset.fallbackIndex || '0', 10);
                                    const next = candidates[idx + 1];
                                    if (!next) return;
                                    img.dataset.fallbackIndex = String(idx + 1);
                                    img.src = next;
                                }
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
