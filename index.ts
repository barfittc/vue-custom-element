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
export function watchProp
    <TKey extends keyof TProps, TProps>
    (props:TProps, key:TKey, onChange: (newValue:TProps[TKey]) => any)
    : (newValue:TProps[TKey]) => any {

    watch(() => props[key], onChange);
    return onChange;
}

/**
 *
 */
export type VueMethodFromMap<Map extends Record<string, unknown>> = {
    [k in keyof Map]: (value:Map[k]) => void | PromiseLike<any>
}

export type VueEmitFromMap<Emits extends Record<string, unknown> = {}> = {
    emit<K extends keyof Emits> (evt: K, ...args: Emits[K][]): void
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

    protected readonly _app: App;
    protected readonly _component:ComponentPublicInstance<Props, {}, {}, {}, VueMethodFromMap<Methods>, VueMethodFromMap<Emits>>;

    public readonly properties:Props;

    public readonly actions:VueMethodFromMap<Methods>;

    protected get required():(keyof Props)[] {  return []; }
    protected get defaults():Partial<Props> {  return { }; }

    constructor(component: Component, attrs?:Props, registerComponents?:ComponentMap) {
        super();

        const properties:Props = attrs ?? <any>{};
        const PropsMap =  (<any>component).props;
        const lowerToCamelKeys:Record<string,string> = {};
        for (const index of Object.keys(PropsMap)) {
            lowerToCamelKeys[index.toLowerCase()] = index;
        }

        for (const index in Object.keys(this.attributes)) {
            const key:keyof Props = lowerToCamelKeys[this.attributes[index].name] ?? this.attributes[index].name;
            if (PropsMap[key] && PropsMap[key].type) {
                if (PropsMap[key].type === Boolean) {
                    // if it's set, and a bool, then it's true
                    properties[key] = <any>true;
                }
                else {
                    properties[key] = (PropsMap[key].type(this.attributes[index].value))
                }
            }
            else {
                properties[key] = <any>this.attributes[index].value;
            }
        }

        for(const prop of this.required) {
            if (properties[prop] === undefined || properties[prop] === null || properties[prop] === "" || properties[prop] === "[object Object]") {
                throw new Error(`Required property ${String(prop)} is not valid, or isn't set.`);
            }
        }

        for(const prop of keysOf(this.defaults)) {
            if (properties[prop] === undefined || properties[prop] === null || properties[prop] === "" || properties[prop] === "[object Object]") {
                properties[prop] = <any>this.defaults[prop];
            }
        }

        this._app = createApp(component, properties);
        if (registerComponents !== undefined) {
            addComponents(this._app, registerComponents);
        }

        this.install(this._app, properties);
        this.addStyles(component, this._app._context.components);
        this._component = <any>this._app.mount(this);

        this.properties = <Props>new Proxy(<any>this._component.$.props, {
            get(target, name) {
                return target[name.toString()];
            },
            set(target, name, newValue, oldValue) {

                if (newValue === oldValue) {
                    return false;
                }

                const key:keyof Props = <any>name;
                target[key] = newValue;
                return true;
            }
        });
        this.actions = <VueMethodFromMap<Methods>>this._component.$.exposeProxy;

        for(const emit of (<{ emits?: (keyof Emits)[] }>component).emits ?? []) {
            this.registerListener(emit);
        }
        this.afterMount();
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

    protected afterMount() { }

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
