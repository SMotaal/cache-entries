if (typeof self === 'object' && typeof navigator === 'object') {
  const serviceWorker = navigator.serviceWorker;
  const activate = async event => self.clients.claim();
  const install = async event => self.skipWaiting();

  const EVENTS = [
    'statechange',
    'updatefound',
    'controllerchange',
    'error',
    'message',
    'install',
    'activate',
  ];

  const events = {
    container: EVENTS,
    registration: EVENTS,
    active: EVENTS,
    controller: EVENTS,
  };

  const listen = (target, handler, events = EVENTS) => {
    for (const event of events) target.addEventListener(event, handler);
  };

  const register = async src => {
    if (!serviceWorker || !serviceWorker.register) return;

    const element = new CachesStatus();

    document.addEventListener('readystatechange', () => document.body.appendChild(element), {
      once: true,
    });

    const log = detail => {
      if (!detail) return;
      const type = detail.type;
      const target = detail.target;
      target && type
        ? console.log('[Client %O %s] %o', target, type, detail)
        : console.log('[Client] %o', detail);
    };
    const notify = event => {
      log(event);
      setTimeout(
        () =>
          (element.statusText =
            (serviceWorker.controller && serviceWorker.controller.state) ||
            event.type ||
            'no controller'),
      );
    };

    listen(serviceWorker, notify, events.container);

    if (!src) src = document.currentScript.src;
    const options = undefined;
    const registration = await serviceWorker.register(src, options);

    listen(registration, notify, events.registration);

    await registration.update();

    const installation = registration.installing;
    const installed = installation && (await installation);
    if (installed) notify({target: registration, type: 'installed', installed});

    const active = registration.active;

    if (active) {
      listen(active, notify, events.active);
      notify({target: active, type: 'active'});
    }

    serviceWorker.ready.then(() => {
      if (!serviceWorker.controller) location = `${location}`;
      listen(serviceWorker.controller, notify, events.controller);
    });

    return registration;
  };

  const initialize = () => {
    const defaultCache = self.caches.open('default');
    const emptyResponse = new Response(new Blob(['']));
    const matching = async (request, cache = defaultCache) => {
      const url = request.url;
      cache = await cache;
      const matched = await cache.match(request.url);
      // console.log({url, matched});
      return matched || emptyResponse;
    };

    self.addEventListener('activate', event => event.waitUntil(activate(event)));
    self.addEventListener('install', event => event.waitUntil(install(event)));
    self.addEventListener('fetch', event => {
      const request = event.request;
      if (!request.url.includes('/caches/')) return;
      event.respondWith(matching(request));
    });
  };

  serviceWorker && serviceWorker.register ? register() : initialize();

  /// WEB COMPONENT ///

  function CachesStatus() {
    const html = String.raw;
    const template = document.createElement('template');
    template.innerHTML = html`
        <div style="display: grid">
          <div>Caches Status <span id=status></span></div>
          <div id=entries style="white-space: pre"></div>
        </div>
      `;

    CachesStatus = class CachesStatus extends HTMLElement {
      constructor() {
        super();
        const root = this.attachShadow ? this.attachShadow({mode: 'open'}) : this;
        root.append(...template.content.cloneNode(true).children);
        const elements = root.querySelectorAll('[id]');
        for (const element of elements) this[`#${element.id}`] = element;
      }

      set statusText(text) {
        this['#status'] && (this['#status'].textContent = text);
      }

      get statusText() {
        return this['#status'] && this['#status'].textContent;
      }
    };

    customElements.define('caches-status', CachesStatus);

    return new CachesStatus(...arguments);
  }
}
