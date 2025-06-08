import { Deferred, DeferredUtil } from '../common/Deferred';
import { readResAsString, defaultGetPublicPath, isInlineCode } from './importHtml/utils';
import processTpl from './importHtml/processTpl';
import { noop } from '../common/common';

export interface LoadContext {
    loaded: Deferred;
    clean: () => void;
}

export interface LoadHtmlContext extends LoadContext {
    scripts: HTMLScriptElement[];
    styles: HTMLStyleElement[];
}

export interface LoadScriptContext extends LoadContext {
    script?: HTMLScriptElement;
}

export interface LoadParams {
    timeout?: number;
}

export interface LoadHtmlParams extends LoadParams {
    html: string | (() => Promise<string> | string);
}

export interface LoadScriptParams extends LoadParams {
    url: string | (() => string);
}

const DEFAULT_LOAD_TIMEOUT = 60000;

export class LoadUtil {
    private static async _loadHtml(html: LoadHtmlParams['html'], context: LoadHtmlContext) {
        if (typeof html === 'function') {
            html = await html();
        }
        let content = '';
        let url = '';
        if (html.startsWith('http') || html.startsWith('/')) {
            url = html;
        } else if (html.indexOf('<script') >= 0 || html.indexOf('<link') >= 0) {
            content = html;
        } else {
            url = html;
        }
        
        if (url) {
            const fetch = window.fetch;
            if (fetch) {
                content = await fetch(url)
                    .then((response) => readResAsString(response, false));
            } else {
                const xhrDeferred = DeferredUtil.create<string>();
                const xhr = new window.XMLHttpRequest();
                xhr.open('GET', url, true);
                xhr.timeout = DEFAULT_LOAD_TIMEOUT;
                xhr.responseType = 'text';

                xhr.onload = (res) => {
                    xhrDeferred.resolve(xhr.responseText);
                };
                         
                xhr.onabort = () => {
                    xhrDeferred.reject(new Error('abort'));
                };
                xhr.onerror = () => {
                    xhrDeferred.reject(new Error(
                        'request failed with ' + xhr.status + ' ' + xhr.statusText));
                };
                    
                xhr.ontimeout = () => {
                    xhrDeferred.reject(new Error('timeout'));
                };

                xhr.send();

                content = await xhrDeferred;
            }
        }

        if (!content) {
            return Promise.reject(new Error('[SERVKIT] html is invalid for html loader'));
        }

        const assets = processTpl(content, defaultGetPublicPath(url || window.location.href));

        const cleanElement = (el: HTMLElement) => {
            el.onload = null;
            el.onerror = null;
        };
        
        const waits = assets.styles
        .filter((item) => !isInlineCode(item))
        .map((href: string) => {
            const deferred = DeferredUtil.create();
        
            const el = document.createElement('link');

            el.rel = 'stylesheet';
            el.href = href;

            if (document.head) {
                document.head.appendChild(el);
            } else if (document.body) {
                document.body.appendChild(el);
            } else {
                document.appendChild(el);
            }

            el.onload = () => {
                cleanElement(el);
                deferred.resolve();
            };

            el.onerror = (e) => {
                cleanElement(el);
                deferred.resolve(); // Don't care about fail of styles
            };

            context.styles.push(el);

            return deferred;
        });

        assets.scripts
            .filter((item) => !isInlineCode(item))
            .forEach((meta: string | { async: boolean; src: string; crossorigin?: string }) => {
            if (typeof meta === 'string') {
                return;
            }

            const deferred = DeferredUtil.create();
        
            const el = document.createElement('script');

            if (meta.crossorigin !== undefined) {
                el.setAttribute('crossorigin', meta.crossorigin);
            }
            
            el.src = meta.src;

            if (document.head) {
                document.head.appendChild(el);
            } else if (document.body) {
                document.body.appendChild(el);
            } else {
                document.appendChild(el);
            }

            el.onload = () => {
                cleanElement(el);
                deferred.resolve();
            };

            el.onerror = (e) => {
                cleanElement(el);
                deferred.reject(e);
            };

            context.scripts.push(el);

            waits.push(deferred);
        });

        context.clean = () => {
            context.styles.forEach((item) => {
                if (item.parentElement) {
                    item.parentElement.removeChild(item);
                }
            });
            context.scripts.forEach((item) => {
                if (item.parentElement) {
                    item.parentElement.removeChild(item);
                }
            });

            context.styles = [];
            context.scripts = [];
        };

        await Promise.all(waits).then(() => {
            context.loaded.resolve();
        }, (error) => {
            context.clean();
            context.loaded.reject(error);
        });
    }

    static loadHtml(params: LoadHtmlParams): LoadHtmlContext {
        const timeout = params.timeout || DEFAULT_LOAD_TIMEOUT;
        const loaded = DeferredUtil.create({ timeout });
            
        const context: LoadHtmlContext = {
            scripts: [],
            styles: [],
            loaded,
            clean: noop,
        };

        LoadUtil._loadHtml(params.html, context);

        return context;
    }

    static async _loadScript(url: LoadScriptParams['url'], context: LoadScriptContext) {
        if (typeof url === 'function') {
            url = url();
        }
        
        const el = document.createElement('script');
        el.setAttribute('crossorigin', '');

        el.src = url;

        if (document.head) {
            document.head.appendChild(el);
        } else if (document.body) {
            document.body.appendChild(el);
        } else {
            document.appendChild(el);
        }

        context.script = el;
        context.clean = () => {
            if (context.script && context.script.parentElement) {
                    context.script.parentElement.removeChild(context.script);
            }

            delete context.script;
        };

        el.onload = () => {
            context.loaded.resolve();
        };

        el.onerror = (error) => {
            context.clean();
            context.loaded.reject(error);
        };
    }

    static loadScript(params: LoadScriptParams): LoadScriptContext {
        const timeout = params.timeout || DEFAULT_LOAD_TIMEOUT;
        const loaded = DeferredUtil.create({ timeout });
            
        const context: LoadScriptContext = {
            loaded,
            clean: noop,
        };

        LoadUtil._loadScript(params.url, context);

        return context;
    }
}
