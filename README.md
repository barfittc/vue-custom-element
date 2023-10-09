better html customElements api for vue apps.


to use

```ts
customElements.define("example", class extends VueElement<
    VueComponent extends Component,/** main Vue Component */
    {
        /** main Vue Component's properties */
        definedPropNameInVueComponet:string
    },
    {
        /** main Vue Component's exposed methods */
       definedMethodNameInVueComponet: (/*definedMethodParamsInVueComponet*/) => void
    },
    {
        /** main Vue Component's emits */
        definedEmitNameInVueComponet: string
    }
>{
    protected install(app:App<VueComponent>, props:Props): void{
        // define your vue App here
    }
});
```

```html
<example id="hello-world" />
```

```ts
const helloWorld = document.getElementById("hello-world");
helloWorld.addEventListener("definedEmitNameInVueComponet", (e) => {
    console.log(e.detail)
});
helloWorld.properties["definedPropNameInVueComponet"] = "helloWorld";
helloWrold.actions["definedMethodNameInVueComponet"](/*definedMethodParamsInVueComponet*/);
```