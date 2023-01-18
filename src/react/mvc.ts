import React from 'react';

import { issues } from '../helper/issues';
import { Callback, Class, InstanceOf } from '../helper/types';
import { Model } from '../model';
import { useContext } from './context';
import { useModel } from './useModel';
import { useTap } from './useTap';

export const Global = new WeakMap<Class, MVC>();

export const Oops = issues({
  DoesNotExist: (name) =>
    `Tried to access singleton ${name}, but none exist! Did you forget to initialize?\nCall ${name}.new() before attempting to access, or consider using ${name}.use() instead.`,

  AlreadyExists: (name) =>
    `Shared instance of ${name} already exists! Consider unmounting existing, or use ${name}.reset() to force-delete it.`
})

class MVC extends Model {
  end(force?: boolean): boolean | void {
    const type = this.constructor as typeof MVC;
    
    if(type.keepAlive && !force)
      return false;

    super.end();
    Global.delete(type);

    return true;
  }

  static global?: boolean;
  static keepAlive?: boolean;

  /**
   * Create a new instance of this model and activate its managed state.
   * 
   * @param args - arguments sent to constructor
   */
  static new<T extends Class>(this: T, ...args: ConstructorParameters<T>): InstanceOf<T>;

  static new(...args: []){
    if(Global.has(this))
      if(this.keepAlive)
        return Global.get(this);
      else
        throw Oops.AlreadyExists(this.name);

    const instance = super.new(...args) as MVC;

    if(this.global)
      Global.set(this, instance);

    return instance;
  }

  /**
   * **React Hook** - Fetch most instance of this controller from context, if it exists.
   * 
   * @param required - Unless false, will throw where instance cannot be found.
   */
  static get <T extends MVC> (this: Model.Type<T>, required?: boolean): T;

  /**
   * **React Hook** - Fetch most instance of this controller from context.
   * 
   * @param required - If false, may return undefined.
   */
  static get <T extends MVC> (this: Model.Type<T>, required: false): T | undefined;

  /**
   * **React Hook** - Fetch specific value from instance of this controller in context.
   */
  static get <I extends MVC, K extends Model.Field<I>> (this: Model.Type<I>, key: K): I[K];

  /**
   * **React Hook** - Fetch instance.
   * 
   * Effect callback will run once if found, throw if not found.
   * Returned function is called on unmount.
   */
  static get <I extends MVC> (this: Model.Type<I>, effect: (found: I) => Callback | void): I;

  static get(arg: any){
    let instance: MVC | undefined;
    const required = arg !== false;

    if(this.global){
      instance = Global.get(this);

      if(!instance && required)
        throw Oops.DoesNotExist(this.name);
    }
    else
      instance = useContext(this, required);

    switch(typeof arg){
      case "string":
        return (instance as any)[arg];

      case "function":
        React.useLayoutEffect(() => arg(instance), []);

      default:
        return instance;
    }
  }

  /** 
   * **React Hook** - Fetch and subscribe to instance of this controller within ambient component.
   */
  static tap <T extends MVC> (this: Model.Type<T>): T;

  static tap <T extends MVC, K extends Model.Field<T>> (this: Model.Type<T>, key: K, expect: true): Exclude<T[K], undefined>;
  static tap <T extends MVC, K extends Model.Field<T>> (this: Model.Type<T>, key: K, expect?: boolean): T[K];

  static tap <T extends MVC, R> (this: Model.Type<T>, connect: (this: T, model: T) => () => R): R;
  static tap <T extends MVC, R> (this: Model.Type<T>, connect: (this: T, model: T) => (() => R) | null): R | null;

  static tap <T extends MVC, R> (this: Model.Type<T>, compute: (this: T, model: T) => Promise<R> | R, expect: true): Exclude<R, undefined>;
  static tap <T extends MVC, R> (this: Model.Type<T>, compute: (this: T, model: T) => Promise<R>, expect?: boolean): R | undefined;
  static tap <T extends MVC, R> (this: Model.Type<T>, compute: (this: T, model: T) => R, expect?: boolean): R;

  static tap (key?: string | Function, expect?: boolean): any {
    return useTap(this, key as any, expect);
  }

  static use <I extends MVC> (this: Model.Type<I>, watch: Model.Field<I>[], callback?: (instance: I) => void): I;
  static use <I extends MVC> (this: Model.Type<I>, callback?: (instance: I) => void): I;
  static use <I extends MVC> (this: Model.Type<I>, apply: Model.Compat<I>, keys?: Model.Event<I>[]): I;

  static use <T extends typeof MVC> (this: T, a: any, b?: any){
    return useModel(this, a, b);
  }

  static meta <T extends Class>(this: T): T;
  static meta <T extends Class, K extends keyof T> (this: T, key: K, expect: true): Exclude<T[K], undefined>;
  static meta <T extends Class, K extends keyof T> (this: T, key: K, expect?: boolean): T[K];
  static meta <T, M extends Class> (this: M, from: (this: M, state: M) => Promise<T>, expect: true): Exclude<T, undefined>;
  static meta <T, M extends Class> (this: M, from: (this: M, state: M) => Promise<T>, expect?: boolean): T;
  static meta <T, M extends Class> (this: M, from: (this: M, state: M) => T, expect: true): Exclude<T, undefined>;
  static meta <T, M extends Class> (this: M, from: (this: M, state: M) => T, expect?: boolean): T;

  static meta (path?: string | Function, expect?: boolean): any {
    return useTap(() => this, path as any, expect);
  }
}

export { MVC };