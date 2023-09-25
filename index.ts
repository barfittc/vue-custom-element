import { type App, type Component as VueComponent, createApp, watch, type ComponentPublicInstance, type MethodOptions } from "vue";
const camelizeRE = /-(\w)/g;
const camelize = (str:string):string => str.replace(camelizeRE, (_, c) => c ? c.toUpperCase() : "");
const capitalize = (str:string):string => str.charAt(0).toUpperCase() + str.slice(1);
const toHandlerKey = (str:string):string => str ? `on${capitalize(str)}` : ``;

/**
* Gets a strongly typed array of keys of the provided object
* @param o object to retrieve the keys from
* @returns a array list of keys
*/
export function keysOf<T extends object>(o:T):(keyof T)[]{
    return <(keyof T)[]>Object.keys(o);
}

/**
 *
 */
export type ComponentMap = {
    [k: string]: Component
}

/**
 *
 */
export type Component = VueComponent & {
    styles?: string[]
}


/**
 * Adds a Components tree to the Vue App
 * @param app the Vue App to register the components to
 * @param components the map of components to register
 */
export function addComponents(app: App, components: ComponentMap): void {
    Object.keys(components).forEach((componentName) => {
        app.component(componentName, <Component>(<any>components)[componentName]);
    });
}

/**
 *
 * @param props
 * @param key
 * @param onChange
 * @returns
 */
export function watchProp<TProps,TType>(props:TProps, key:keyof TProps, onChange: (newValue:TType) => any):(newValue:TType) => any {

    watch(() => props[key], <(newValue:TProps[keyof TProps]) => any>onChange);
    return onChange;
}

/**
 *
 */
export type VueMethodFromMap<Map extends Record<string, unknown>> = {
    [k in keyof Map]: (value:Map[k]) => void | PromiseLike<any>
}

/**
 *
 */
export abstract class VueElement<
VueComponent extends Component,
Props extends Record<string, unknown> = {},
Methods extends Record<string, unknown> = {},
Emits extends Record<string, unknown> = {}
> extends HTMLElement {

    private readonly _app: App;
    private readonly _component:ComponentPublicInstance<Props, {}, {}, {}, VueMethodFromMap<Methods>, VueMethodFromMap<Emits>>;

    public readonly properties:Props;

    public readonly actions:VueMethodFromMap<Methods>;

    constructor(component: Component, attrs?:Props, registerComponents?:ComponentMap) {
        super();

        const properties:Props = attrs ?? <any>{};
        for (const index in Object.keys(this.attributes)) {
            properties[<keyof Props>this.attributes[index].name] = <Props[keyof Props]>this.attributes[index].value;
        }

        this._app = createApp(component, properties);
        if (registerComponents !== undefined) {
            addComponents(this._app, registerComponents);
        }

        this.install(this._app, properties);
        this.addStyles(component, this._app._context.components);
        this._component = <any>this._app.mount(this);

        this.properties = new Proxy(<Props>this._component.$.props, {
            get(target, name) {
                return target[name.toString()];
            },
            set(target, name, newValue) {
                const key:keyof Props = <any>name;
                target[key] = newValue;
                return true;
            }
        });
        this.actions = <{[k in keyof Methods]: (value:Methods[keyof Methods]) => void }>this._component.$.exposeProxy;

        for(const emit of (<{ emits?: (keyof Emits)[] }>component).emits ?? []) {
            this.registerListener(emit);
        }
    }

    addEventListener<K extends keyof HTMLElementEventMap>(type: K, listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener<K extends keyof Emits>(type: K, listener: (this: HTMLElement, ev: CustomEvent<Emits[K]>) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener<KE extends keyof Emits, KH extends keyof HTMLElementEventMap>(
        type: KE | KH | string,
        listener: (this: HTMLElement, ev: CustomEvent<Emits[KE]>) => any | HTMLEvent<KH> | EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions): void {

        // @ts-ignore
        super.addEventListener(type, listener, options);
    }

    protected abstract install(app:App<VueComponent>, props:Props): void;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected uninstall(_:App<VueComponent>): void {}

    protected connectedCallback() { }

    protected disconnectedCallback() {
        this.uninstall(this._app);
    }

    protected adoptedCallback() { }

    protected attributeChangedCallback<Key extends keyof Props>(name:Key, oldValue:Props[Key], newValue:Props[Key]) {
        this.properties[name] = newValue;
    }

    private addStyles(component:Component, components:ComponentMap):void {

        const idStyle = this.nodeName + "-Styles";
        let style = document.getElementById(idStyle);
        if (style === null) {

            const head = document.getElementsByTagName("head")[0];

            if (head === null || head === undefined) return;
            style = document.createElement("style");

            style.id = idStyle;
            head.insertBefore(style, head.firstChild);

            let stylesToInclude:string[] = [];

            for(const componentName of keysOf(components)) {
                const childComponent= components[componentName];
                if(childComponent.styles) {
                    stylesToInclude = [...stylesToInclude, ...childComponent.styles];
                }
            }

            if(component.styles) {
                stylesToInclude = [...stylesToInclude, ...component.styles];
            }

            style.innerHTML = stylesToInclude.join("");
        }
    }

    private registerListener<Key extends keyof Emits>(type: Key) {

        if (!this._component.$.vnode.props) {
            return;
        }

        const handlerName = toHandlerKey(camelize(type.toString()));
        this._component.$.vnode.props[handlerName] = (data:Emits[Key]) => {
            this.dispatchEvent(new CustomEvent<Emits[Key]>(type.toString(), {
                detail: data
            }));
        }
    }
}
export type HTMLEvent<K extends keyof HTMLElementEventMap> =  (this: HTMLElement, ev: HTMLElementEventMap[K]) => any