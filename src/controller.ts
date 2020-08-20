import { Context, createContext, FunctionComponent, ProviderProps, useContext } from 'react';

import { ControllerDispatch, ensureDispatch } from './dispatch';
import { controllerIsGlobalError, OWN_SINGLETON, globalController } from './global';
import { ControlledInput, ControlledValue, createWrappedComponent } from './hoc';
import { getObserver, OBSERVER, Observer } from './observer';
import { CONTEXT_MULTIPROVIDER, ControlProvider } from './provider';
import { useModelController, useSubscriber } from './subscriber';
import { BunchOf, Callback, ModelController, Observable, SubscribeController, Class } from './types';
import { define, defineOnAccess, transferValues } from './util';
import { useWatcher } from './watcher';

export interface Controller 
  extends Observable, ModelController, SubscribeController {

  // Extended classes represent the onion-layers of a given controller.
  // What is accessible depends on the context controller is accessed.

  [OBSERVER]: ControllerDispatch;

  get: this;
  set: this;

  Input: FunctionComponent<{ to: string }>;
  Value: FunctionComponent<{ of: string }>;
  Provider: FunctionComponent<ProviderProps<this>>;

  assign(props: BunchOf<any>): this;
  assign(key: string, props?: BunchOf<any>): any;

  tap(): this;
  tap<K extends keyof this>(key?: K): this[K];
}

export class Controller {
  constructor(){
    this.get = this;
    this.set = this;
  }

  initialize(){
    return ensureDispatch(this);
  }

  tap(key?: string){
    const self = useWatcher(this);
    return key ? self[key] : key;
  }

  sub(...args: any[]){
    return useSubscriber(this, args, false) 
  }
  
  assign(
    a: string | BunchOf<any>, 
    b?: BunchOf<any>){
  
    if(typeof a == "string")
      return (this as any)[a] = b as any;
    else
      return Object.assign(this, a) as this;
  }

  toggle = (key: string) => {
    const self = this as any;
    return self[key] = !self[key];
  }

  export = (
    subset?: string[] | Callback, 
    onChange?: Callback | boolean,
    initial?: boolean) => {

    const dispatch = getObserver(this);

    if(typeof subset == "function"){
      initial = onChange as boolean;
      onChange = subset;
      subset = dispatch.managed;
    }
  
    if(typeof onChange == "function")
      return dispatch.feed(subset!, onChange, initial);
    else 
      return dispatch.pick(subset);
  }

  destroy(){
    const dispatch = this[OBSERVER];

    if(dispatch)
      dispatch.trigger("willDestroy");
    
    if(this.willDestroy)
      this.willDestroy();
  }

  static context?: Context<Controller>;
  static find: () => Controller;
  static meta: <T>(this: T) => T & Observable;

  static create<T extends Class>(
    this: T, args: any[]): InstanceType<T> {

    return new (this as any)(...args);
  }

  static get(key?: string){
    const instance = this.find();
    return key 
      ? (instance as any)[key]
      : instance;
  }

  static tap(): Controller;
  static tap(key?: string){
    return this.find().tap(key);
  }

  static has(key: string){
    const value = this.find().tap(key);

    if(value === undefined)
      throw new Error(`${this.name}.${key} is marked as required for this render.`)

    return value;
  }

  static sub(...args: any[]){
    const instance = this.find();
    return useSubscriber(instance, args, false);
  }

  static hoc = createWrappedComponent;

  static assign(a: string | BunchOf<any>, b?: BunchOf<any>){
    const instance = this.find();
    instance.assign(a, b);
    return instance.tap();
  }

  static use(...args: any[]){
    return useModelController(this, args);
  }

  static uses(
    props: BunchOf<any>, 
    only?: string[]){
      
    return useModelController(this, [], (instance) => {
      transferValues(instance, props, only)
    })
  }

  static using(
    props: BunchOf<any>, 
    only?: string[]){

    function assignTo(instance: Controller){
      transferValues(instance, props, only);
    }

    const subscriber = useModelController(this, [], assignTo);

    assignTo(subscriber);
        
    return subscriber;
  }

  static makeGlobal(...args: any[]){
    this.global = true;
    return globalController(this, args);
  }

  static get Provider(){
    if(this.global)
      throw controllerIsGlobalError(this.name)
    else 
      return useModelController(this).Provider
  }
}

export class Singleton extends Controller {
  static global = true;
}

defineOnAccess(Controller, "context", 
  () => createContext<any>(null)
);

defineOnAccess(Controller, "find", 
  function getterForContext(this: typeof Controller) {
    const { name, context } = this;

    return function useInstanceInContext(){
      const instance = 
        useContext(context!) || 
        useContext(CONTEXT_MULTIPROVIDER)[name];

      if(!instance)
        throw new Error(
          `Can't subscribe to controller; this accessor ` + 
          `can only be used within a Provider keyed to \`${name}\``
        );

      return instance;
    }
  }
);

defineOnAccess(Controller, "meta", 
  function getterForMeta(this: typeof Controller){
    const self = this as unknown as Observable;
    const observer = new Observer(self);

    observer.monitorValues(["prototype", "length", "name"]);
    observer.monitorComputed();

    define(self, {
      get: self,
      set: self
    });

    return () => useWatcher(self);
  }
);

defineOnAccess(Controller.prototype, "Provider", ControlProvider);
defineOnAccess(Controller.prototype, "Value", ControlledValue);
defineOnAccess(Controller.prototype, "Input", ControlledInput);