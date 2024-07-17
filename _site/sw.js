let version = "22"

let cacheName = `v${version}_data`

let cachedAssetPaths = [
    // HTML
    './',
    'index.html',
    // CSS
    'main.css',
    // JS
    'main.js',
    'beagle.js',
    'brightspot.js',
    'fuzzysort.min.js',
    // DATA
    'oplist.json',
    // IMAGES
    'icons/gasper.png',
    'icons/gasper_nobellows.png',
    'icons/gasper_justbellows.png',
    'icons/gasper_favicon.png',
    'icons/gasper_thinking.png',
    'icons/chevron_down.svg',
    'icons/colour_zap.svg',
    'icons/colour_search.svg',
    'icons/colour_bookmark.svg',
    'icons/colour_heart.svg',
    'icons/colour_gas_mask.svg',
    'icons/colour_droplet.svg',
    'icons/colour_pen_tool.svg',
    'icons/colour_life_buoy.svg',
    'icons/colour_pill.svg',
    'icons/colour_check_circle.svg',
    'icons/colour_arrow_down_circle.svg',
    'icons/colour_edit.svg',
    'icons/x_octagon.svg',
    'icons/propeller_hat.svg',
    'icons/github-mark.svg',
    'clinic_data_safety.svg',
    'propofol_molecule.svg',
    'icons/arrow_up.svg',
    'icons/arrow_down.svg',
    'icons/arrow_down_left.svg',
    'icons/menu.svg',
    'icons/info.svg',
]

// install (pre-activation) event
    // waitUntil() accepts a Promise and *waits* for it to resolve
    // alt title: waitForResolutionOfThisPromise(<Promise>)
async function install() {
    console.debug(`SW ${version}: installing`)

    let cache = await caches.open(cacheName)

    for (let p of cachedAssetPaths) {
        try {
            await cache.add(p)
            console.debug(`SW ${version}: pre-downloaded asset @ ${p}`)
        } catch ({name, message}) {
            console.error(`SW ${version}: failed to pre-download asset @ ${p}`)
        } finally {
            continue
        }
    }

    self.skipWaiting()
}
self.addEventListener('install', event => {
    event.waitUntil(install())
})

// activation (post-installation) event
async function activate() {
    console.debug(`SW ${version}: activating`)
    let allCaches = await caches.keys()
    let badCaches = allCaches.filter((key) => { return key != cacheName })
    for (let c of badCaches) {
        caches.delete(c)
    }
    await self.clients.claim()
}
self.addEventListener('activate', (e) => {
    e.waitUntil(activate())
})

// fetch (every request)
self.addEventListener('fetch', async (e) => {
    // https://stackoverflow.com/a/49719964
    // via https://gomakethings.com/toolkit/boilerplates/service-worker/
    if (e.request.cache === 'only-if-cached' && e.request.mode !== 'same-origin') return;

    e.respondWith(cacheBeforeNetwork(e.request))
})

// matching methods
async function cacheBeforeNetwork(request) {
    console.debug(`SW ${version}: running cacheBeforeNetwork for ${request.url}`)

    // match and return
    let match = await caches.match(request)
    if (match) {
        console.debug(`SW ${version}: ${request.url} served from cache 💾`)
        return match
    }
    // fall back to network
    console.debug(`SW ${version}: ${request.url} served from network 🛜`)
    return await fetch(request)
}