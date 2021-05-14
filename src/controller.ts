import type { Controller as Public } from '..';
import type { FunctionComponent } from 'react';

import { createBindAgent } from './binding';
import { derivedConsumer, derivedProvider } from './components';
import { getFromContext } from './context';
import { Dispatch } from './dispatch';
import { useController, useMemoized, usePassive, useSubscriber, useWatcher } from './hooks';
import { assignSpecific, define, entriesIn, getPrototypeOf, memoize } from './util';

import Oops from './issues';

export type Model = typeof Controller;

export interface Controller extends Public {};

export class Controller {
  constructor(){
    const cb = this.didCreate && this.didCreate.bind(this);
    const dispatch = new Dispatch(this, Controller, cb);

    define(this, { get: this, set: this });

    for(const [key, { value }] of entriesIn(dispatch))
      if(typeof value == "function")
        define(this, key, value);
  }

  public tap(path?: string | SelectFunction<any>){
    return useWatcher(this, path) as any;
  }

  public sub(...args: any[]){
    return useSubscriber(this, args) as any;
  }

  public get bind(){
    return createBindAgent(this) as any;
  }

  public destroy(){
    const dispatch = Dispatch.get(this);

    if(this.willDestroy)
      this.willDestroy();

    if(dispatch)
      dispatch.emit("willDestroy");
  }

  static use(...args: any[]){
    return useController(this, args);
  }

  static uses(
    props: BunchOf<any>, 
    only?: string[]){
      
    return useController(this, [], instance => {
      assignSpecific(instance, props, only);
    })
  }

  static using(
    props: BunchOf<any>, 
    only?: string[]){

    function assign(instance: Controller){
      assignSpecific(instance, props, only);
    }

    const subscriber = 
      useController(this, [], assign);

    assign(subscriber);
        
    return subscriber;
  }

  static memo(...args: any[]){
    return useMemoized(this, args);
  }

  static get(key?: string | SelectFunction<any>){
    return usePassive(this.find(), key);
  }

  static tap(key?: string | SelectFunction<any>){
    return this.find().tap(key);
  }

  static has(key: string){
    const value = this.find().tap(key);

    if(value === undefined)
      throw Oops.HasPropertyUndefined(this.name, key);

    return value;
  }

  static sub(...args: any[]){
    return this.find().sub(...args);
  }

  static meta(path: string | SelectFunction<any>): any {
    return useWatcher(() => {
      Dispatch.ensure(this, Controller);
      return this;
    }, path);
  }

  static hoc<P>(Type: Public.Component<P>): FunctionComponent<P> {
    return memoize(derivedConsumer, this, Type);
  }

  static wrap<P>(Type: Public.Component<P>): FunctionComponent<P> {
    return memoize(derivedProvider, this, Type);
  }

  static find(){
    return getFromContext(this);
  }

  static create<T extends Model>(
    this: T,
    args?: any[],
    prepare?: (self: InstanceOf<T>) => void){

    const instance: InstanceOf<T> = 
      new (this as any)(...args || []);

    Dispatch.get(instance);

    if(prepare)
      prepare(instance);

    return instance;
  }

  static isTypeof<T extends Model>(
    this: T, maybe: any): maybe is T {

    return (
      typeof maybe == "function" && 
      maybe.prototype instanceof this
    )
  }

  static get inherits(): Model | undefined {
    const I = getPrototypeOf(this);
    if(I !== Controller)
      return I;
  }
}