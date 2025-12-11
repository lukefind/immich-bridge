const { createApp, ref, reactive, onMounted } = Vue;

createApp({
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
            const res = await fetch(`/apps/immich_bridge/api${path}`, {
                credentials: "same-origin",
                ...options
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
            window.open(`/apps/immich_bridge/api/assets/${assetId}/original`, '_blank');
        };

        onMounted(async () => {
            await loadConfig();
            if (configured.value) {
                await loadAlbums();
            }
        });

        return {
            loading,
            configured,
            error,
            config,
            albums,
            selectedAlbum,
            assets,
            saveConfig,
            selectAlbum,
            openOriginal
        };
    },

    template: `
    <div class="immich-wrapper">
        <div v-if="loading" class="immich-loading">Loading...</div>

        <div v-if="error" class="immich-error">
            {{ error }}
        </div>

        <div v-if="!loading && !configured" class="immich-setup">
            <h2>Immich Bridge Setup</h2>
            <p class="immich-setup-desc">Connect your Immich instance to browse your photo library.</p>

            <label>
                Immich Base URL:
                <input v-model="config.baseUrl" placeholder="https://immich.example.com/api" />
            </label>

            <label>
                Immich API Key:
                <input type="password" v-model="config.apiKey" placeholder="Your Immich API key" />
            </label>

            <button @click="saveConfig">Save Configuration</button>
        </div>

        <div v-if="configured && !loading" class="immich-browser">
            <div class="immich-sidebar">
                <h3>Albums</h3>
                <ul>
                    <li 
                      v-for="album in albums" 
                      :key="album.id" 
                      @click="selectAlbum(album)"
                      :class="{ active: selectedAlbum && selectedAlbum.id === album.id }"
                    >
                        {{ album.title }} ({{ album.assetCount }})
                    </li>
                </ul>
                <p v-if="albums.length === 0" class="immich-no-albums">No albums found.</p>
            </div>

            <div class="immich-assets">
                <div v-if="!selectedAlbum" class="immich-placeholder">
                    <p>Select an album to view photos</p>
                </div>
                <div v-else>
                    <h3>{{ selectedAlbum.title }}</h3>
                    <div class="immich-grid">
                        <div 
                          class="immich-thumb" 
                          v-for="asset in assets" 
                          :key="asset.id"
                          @click="openOriginal(asset.id)"
                        >
                            <img 
                              :src="'/apps/immich_bridge/api/assets/' + asset.id + '/thumbnail'"
                              :alt="asset.fileName"
                              loading="lazy"
                            />
                        </div>
                    </div>
                    <p v-if="assets.length === 0" class="immich-no-assets">No photos in this album.</p>
                </div>
            </div>
        </div>
    </div>
    `
}).mount("#immich-bridge-app");
