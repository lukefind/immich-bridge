const { createApp, ref, reactive, onMounted, h, Teleport } = Vue;

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
        const tags = ref([]);

        const activeView = ref('albums');
        const albumSearch = ref('');
        const albumSort = ref('name');

        // All Photos filters
        const photoFilter = reactive({
            isFavorite: false,
            rating: 0,
            tagId: '',
            year: null // For timeline slider
        });

        // Available years for timeline slider
        const availableYears = ref([]);
        
        // Pagination
        const currentPage = ref(1);
        const hasMore = ref(false);
        const totalPhotos = ref(0);
        const loadingMore = ref(false);

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

        const loadTags = async () => {
            try {
                tags.value = await api(`/tags`);
            } catch (err) {
                // Tags may not be available in all Immich versions
                tags.value = [];
            }
        };

        const loadAllPhotos = async (append = false) => {
            error.value = null;
            if (append) {
                loadingMore.value = true;
            }
            try {
                const params = new URLSearchParams();
                if (photoFilter.isFavorite) params.set('isFavorite', 'true');
                if (photoFilter.year) params.set('year', photoFilter.year);
                if (photoFilter.rating) params.set('rating', photoFilter.rating);
                params.set('page', append ? currentPage.value + 1 : 1);
                
                const result = await api(`/albums/timeline?${params.toString()}`);
                const newAssets = result.assets || [];
                
                if (append) {
                    assets.value = [...assets.value, ...newAssets];
                    currentPage.value++;
                } else {
                    assets.value = newAssets;
                    currentPage.value = 1;
                }
                
                hasMore.value = result.hasMore || false;
                totalPhotos.value = result.total || assets.value.length;
                
                // Extract available years from assets for timeline slider
                const years = new Set();
                assets.value.forEach(a => {
                    if (a.fileDate) {
                        const year = new Date(a.fileDate).getFullYear();
                        if (year > 1970) years.add(year);
                    }
                });
                // Add common years if we don't have data yet
                if (years.size === 0) {
                    const currentYear = new Date().getFullYear();
                    for (let y = currentYear; y >= currentYear - 20; y--) {
                        years.add(y);
                    }
                }
                availableYears.value = Array.from(years).sort((a, b) => b - a);
            } catch (err) {
                error.value = err.message;
                toastError(err.message);
            } finally {
                loadingMore.value = false;
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

        const saveToNextcloud = async () => {
            if (!lightboxAsset.value) return;
            
            // Capture asset info before any async operations (lightbox may close)
            const assetId = lightboxAsset.value.id;
            const fileName = lightboxAsset.value.fileName;
            
            // Temporarily hide lightbox so file picker is visible
            const lightboxEl = document.querySelector('.immich-lightbox');
            if (lightboxEl) lightboxEl.style.display = 'none';
            
            const doSave = async (targetPath) => {
                // Restore lightbox
                if (lightboxEl) lightboxEl.style.display = '';
                
                try {
                    const response = await fetch(`/apps/immich_nc_app/api/assets/${assetId}/save-to-nextcloud`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'requesttoken': typeof OC !== 'undefined' ? OC.requestToken : ''
                        },
                        body: JSON.stringify({ targetPath, fileName })
                    });
                    if (response.ok) {
                        const data = await response.json();
                        toast(`Saved to ${data.path || targetPath}`);
                    } else {
                        const data = await response.json();
                        toastError(data.error || 'Failed to save');
                    }
                } catch (err) {
                    toastError('Failed to save: ' + err.message);
                }
            };
            
            const onCancel = () => {
                // Restore lightbox on cancel
                if (lightboxEl) lightboxEl.style.display = '';
            };

            // Try Nextcloud file picker
            if (typeof OC !== 'undefined' && OC.dialogs && OC.dialogs.filepicker) {
                OC.dialogs.filepicker(
                    'Select folder to save image',
                    (targetPath) => doSave(targetPath),
                    false,
                    'httpd/unix-directory',
                    true,
                    OC.dialogs.FILEPICKER_TYPE_CHOOSE,
                    '',
                    { cancel: onCancel }
                );
            } else {
                // Fallback: save to root
                if (confirm('Save image to your Nextcloud files root folder?')) {
                    doSave('/');
                }
            }
        };

        const shareViaTalk = () => {
            if (!lightboxAsset.value) return;
            toast('Share via Talk - coming soon!');
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
            selectedAlbum.value = null;
            if (isMobile.value) {
                sidebarOpen.value = false;
            }
        };

        const showAllPhotos = async () => {
            activeView.value = 'photos';
            selectedAlbum.value = null;
            if (isMobile.value) {
                sidebarOpen.value = false;
            }
            await loadTags();
            await loadAllPhotos();
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
                            class: ['immich-nav-link', activeView.value === 'photos' ? 'active' : null, !configured.value ? 'disabled' : null],
                            onClick: configured.value ? showAllPhotos : null
                        }, 'All Photos'),
                        h('div', {
                            class: ['immich-nav-link', activeView.value === 'albums' ? 'active' : null, !configured.value ? 'disabled' : null],
                            onClick: configured.value ? showAlbums : null
                        }, 'Albums'),
                        h('div', {
                            class: ['immich-nav-link', activeView.value === 'settings' ? 'active' : null],
                            onClick: showSettings
                        }, 'Settings'),
                    ])
                ]);

                const sidebarHeader = h('div', { class: 'immich-sidebar-header' }, [
                    h('div', { class: 'immich-sidebar-title' }, 'Immich Bridge'),
                    isMobile.value ? h('button', { class: 'immich-sidebar-close', onClick: closeSidebar, title: 'Close menu' }, '×') : null
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
                            h('div', { class: 'immich-album-controls' }, [
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
                                    h('option', { value: 'name' }, 'Name'),
                                    h('option', { value: 'date' }, 'Date'),
                                    h('option', { value: 'count' }, 'Count'),
                                ]),
                            ]),
                            h('ul', null, albumItems),
                            sortedAlbums.length === 0 ? h('p', { class: 'immich-no-albums' }, 'No matching albums.') : null
                        ])
                    );

                    if (!selectedAlbum.value) {
                        // On mobile, show album list in main content area
                        if (isMobile.value) {
                            mainContent = [
                                h('div', { class: 'immich-mobile-albums' }, [
                                    h('div', { class: 'immich-album-controls' }, [
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
                                            h('option', { value: 'name' }, 'Name'),
                                            h('option', { value: 'date' }, 'Date'),
                                            h('option', { value: 'count' }, 'Count'),
                                        ]),
                                    ]),
                                    h('ul', { class: 'immich-album-list' }, albumItems),
                                    sortedAlbums.length === 0 ? h('p', { class: 'immich-no-albums' }, 'No matching albums.') : null
                                ])
                            ];
                        } else {
                            mainContent = [
                                h('div', { class: 'immich-placeholder' }, [
                                    h('p', null, 'Select an album to view photos')
                                ])
                            ];
                        }
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

                // All Photos view with filters
                if (activeView.value === 'photos' && configured.value) {
                    // Rating filter (1-5 stars)
                    const ratingFilter = h('div', { class: 'immich-rating-filter' }, [
                        h('span', { class: 'immich-filter-label' }, 'Rating:'),
                        h('select', {
                            class: 'immich-select',
                            value: photoFilter.rating || '',
                            onChange: (e) => {
                                photoFilter.rating = e.target.value ? parseInt(e.target.value) : 0;
                                loadAllPhotos();
                            }
                        }, [
                            h('option', { value: '' }, 'Any'),
                            h('option', { value: '1' }, '≥1★'),
                            h('option', { value: '2' }, '≥2★'),
                            h('option', { value: '3' }, '≥3★'),
                            h('option', { value: '4' }, '≥4★'),
                            h('option', { value: '5' }, '5★'),
                        ])
                    ]);

                    // Compact filter bar - all on one line
                    const filterBar = h('div', { class: 'immich-filter-bar' }, [
                        h('label', { class: 'immich-filter-checkbox' }, [
                            h('input', {
                                type: 'checkbox',
                                checked: photoFilter.isFavorite,
                                onChange: (e) => { photoFilter.isFavorite = e.target.checked; loadAllPhotos(); }
                            }),
                            '♥'
                        ]),
                        ratingFilter,
                        h('select', {
                            class: 'immich-select immich-select-small',
                            value: photoFilter.year || '',
                            onChange: (e) => {
                                photoFilter.year = e.target.value || null;
                                loadAllPhotos();
                            }
                        }, [
                            h('option', { value: '' }, 'All Years'),
                            ...availableYears.value.map(year => h('option', { value: year }, year))
                        ]),
                        (photoFilter.isFavorite || photoFilter.year || photoFilter.rating) ? h('button', {
                            class: 'immich-filter-btn',
                            onClick: () => { photoFilter.isFavorite = false; photoFilter.year = null; photoFilter.rating = 0; loadAllPhotos(); }
                        }, '✕') : null
                    ]);

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

                    // Build timeline scroller - vertical list of years/months on the right side
                    const timelineScroller = h('div', { class: 'immich-timeline-scroller' }, 
                        availableYears.value.map(year => 
                            h('div', {
                                key: year,
                                class: ['immich-timeline-year', photoFilter.year == year ? 'active' : ''].filter(Boolean).join(' '),
                                onClick: () => {
                                    photoFilter.year = photoFilter.year == year ? null : year;
                                    loadAllPhotos();
                                }
                            }, year)
                        )
                    );

                    // Load more button
                    const loadMoreBtn = hasMore.value ? h('div', { class: 'immich-load-more' }, [
                        h('button', {
                            class: 'immich-btn immich-btn-secondary',
                            onClick: () => loadAllPhotos(true),
                            disabled: loadingMore.value
                        }, loadingMore.value ? 'Loading...' : `Load More (${assets.value.length} of ${totalPhotos.value})`)
                    ]) : null;

                    mainContent = [
                        h('div', { class: 'immich-main-header' }, [
                            h('h3', null, 'All Photos'),
                            h('span', { class: 'immich-photo-count' }, `${assets.value.length}${totalPhotos.value > assets.value.length ? ' of ' + totalPhotos.value : ''} photos`)
                        ]),
                        filterBar,
                        h('div', { class: 'immich-photos-container' }, [
                            h('div', { class: 'immich-photos-grid-wrapper' }, [
                                h('div', { class: 'immich-grid' }, assetItems),
                                loadMoreBtn
                            ]),
                            availableYears.value.length > 0 ? timelineScroller : null
                        ]),
                        assets.value.length === 0 ? h('p', { class: 'immich-no-assets' }, 'No photos found with current filters.') : null
                    ];
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

            // Lightbox modal (teleported to body to avoid Nextcloud stacking contexts)
            if (lightboxOpen.value && lightboxAsset.value) {
                const base = `/apps/immich_nc_app/api/assets/${lightboxAsset.value.id}`;
                // Load preview (large ~1440px) first, fall back to original if preview fails
                const previewSrc = `${base}/preview`;
                const originalSrc = `${base}/original`;
                const candidates = [previewSrc, originalSrc];

                const lightbox = h('div', {
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
                    }, '↗'),
                    h('div', { class: 'immich-lightbox-actions' }, [
                        h('button', {
                            class: 'immich-lightbox-action',
                            onClick: saveToNextcloud,
                            title: 'Save to Nextcloud'
                        }, [h('span', null, '💾'), ' Save']),
                        h('button', {
                            class: 'immich-lightbox-action',
                            onClick: shareViaTalk,
                            title: 'Share via Talk'
                        }, [h('span', null, '💬'), ' Share'])
                    ])
                ]);

                children.push(h(Teleport, { to: 'body' }, [lightbox]));
            }

            return h('div', { class: 'immich-wrapper' }, children);
        };
    }
};

createApp(ImmichBridgeApp).mount("#immich-bridge-app");
